import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  jidNormalizedUser,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import path from 'path';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from '../config/database';
import { messageService } from './message.service';
import { contactService } from './contact.service';

const LOG_PREFIX = '[Baileys]';
const activeConnections = new Map<string, WASocket>();
const lastConnectionErrors = new Map<
  string,
  { statusCode?: number; message?: string }
>();
// Track whether we're currently trying to connect (prevent duplicate inits)
const pendingInits = new Set<string>();

function log(userId: string, message: string): void {
  console.log(`${LOG_PREFIX} userId=${userId} ${message}`);
}

function isStatusJid(remoteJid: string | null | undefined): boolean {
  if (!remoteJid) return true;
  return (
    remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')
  );
}

export class BaileysService {
  /**
   * Initialize with pairing code (phone number linking).
   * Phone number must be in E.164 format WITHOUT the + sign (e.g. "5491123456789").
   */
  async initializeWithPairingCode(
    userId: string,
    phoneNumber: string
  ): Promise<{ pairingCode: string | null }> {
    if (activeConnections.has(userId)) {
      log(userId, 'already connected; skipping pairing init');
      return { pairingCode: null };
    }

    if (pendingInits.has(userId)) {
      log(userId, 'init already in progress; skipping duplicate');
      return { pairingCode: null };
    }

    pendingInits.add(userId);

    const sessionPath = path.join(
      process.env.SESSION_PATH ?? './whatsapp-sessions',
      userId
    );

    // Always clear session files for pairing — start completely fresh
    log(userId, 'clearing session for fresh pairing');
    await this.resetSession(userId, sessionPath);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'warn' }),
      getMessage: async (key) => {
        // Baileys needs this to retry failed messages
        if (!key.id) return undefined;
        const msg = await prisma.message.findUnique({ where: { whatsappId: key.id } });
        return msg?.body ? { conversation: msg.body } : undefined;
      },
    });

    return new Promise<{ pairingCode: string | null }>((resolve) => {
      let resolved = false;
      let pairingCodeRequested = false;
      const done = (pairingCode: string | null) => {
        if (!resolved) {
          resolved = true;
          pendingInits.delete(userId);
          resolve({ pairingCode });
        }
      };

      const timeout = setTimeout(() => {
        log(userId, 'pairing init timeout — 30s');
        done(null);
      }, 30_000);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Wait for QR event — this means the socket is registered and ready for pairing
        if (qr && !pairingCodeRequested) {
          pairingCodeRequested = true;
          log(userId, `requesting pairing code for ${phoneNumber}`);
          // Small delay to ensure socket is fully ready
          await new Promise((r) => setTimeout(r, 1000));
          try {
            const code = await sock.requestPairingCode(phoneNumber);
            log(userId, `pairing code generated: ${code}`);
            clearTimeout(timeout);
            done(code);
          } catch (err) {
            console.error(`${LOG_PREFIX} Failed to request pairing code:`, err);
            clearTimeout(timeout);
            done(null);
          }
        }

        if (connection === 'close') {
          const error = lastDisconnect?.error as Boom | undefined;
          const statusCode = error?.output?.statusCode;
          const message = error?.message;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
          log(
            userId,
            `connection close; statusCode=${statusCode} message=${message ?? 'n/a'} shouldReconnect=${shouldReconnect}`
          );

          activeConnections.delete(userId);

          if (shouldReconnect) {
            // After pairing code auth, Baileys disconnects and needs to reconnect
            log(userId, 'reconnecting after pairing auth...');
            // Re-initialize with QR flow (it will use existing creds, no new QR needed)
            void this.initializeWhatsApp(userId);
          } else {
            lastConnectionErrors.set(userId, { statusCode, message });
            await this.resetSession(userId, sessionPath);
            try {
              await prisma.whatsAppSession.upsert({
                where: { userId },
                update: { isConnected: false, qrCode: null },
                create: { userId, isConnected: false, qrCode: null },
              });
            } catch (err) {
              console.error(`${LOG_PREFIX} Failed to update session on close:`, err);
            }
          }

          clearTimeout(timeout);
          done(null);
        } else if (connection === 'open') {
          const phone = sock.user?.id?.split(':')[0] ?? null;
          log(userId, `connected phone=${phone ?? 'n/a'}`);
          lastConnectionErrors.delete(userId);

          try {
            await prisma.whatsAppSession.upsert({
              where: { userId },
              update: {
                isConnected: true,
                lastConnected: new Date(),
                phoneNumber: phone,
                qrCode: null,
              },
              create: {
                userId,
                isConnected: true,
                lastConnected: new Date(),
                phoneNumber: phone,
              },
            });
          } catch (err) {
            console.error(`${LOG_PREFIX} Failed to update session on open:`, err);
          }

          activeConnections.set(userId, sock);
          clearTimeout(timeout);
          done(null);
          await this.syncContacts(userId, sock);
        }
      });

      sock.ev.on('creds.update', saveCreds);
      this.setupMessageHandlers(userId, sock);
    });
  }

  async restoreSessions(): Promise<void> {
    const sessions = await prisma.whatsAppSession.findMany({
      where: { isConnected: true },
    });

    console.log(`${LOG_PREFIX} Restoring ${sessions.length} sessions...`);

    for (const session of sessions) {
      // Start initialization in background
      this.initializeWhatsApp(session.userId).catch((err) => {
        console.error(`${LOG_PREFIX} Failed to restore session for ${session.userId}:`, err);
      });
    }
  }

  async initializeWhatsApp(userId: string): Promise<{ qr: string | null }> {
    if (activeConnections.has(userId)) {
      log(userId, 'already connected; skipping init');
      return { qr: null };
    }

    if (pendingInits.has(userId)) {
      log(userId, 'init already in progress; skipping duplicate');
      return { qr: null };
    }

    pendingInits.add(userId);

    const sessionPath = path.join(
      process.env.SESSION_PATH ?? './whatsapp-sessions',
      userId
    );

    // Always clear stale session files so we get a fresh QR
    const lastError = lastConnectionErrors.get(userId);
    if (lastError) {
      log(userId, `clearing stale session (last error: ${lastError.statusCode} ${lastError.message})`);
      await this.resetSession(userId, sessionPath);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'warn' }),
      getMessage: async (key) => {
        if (!key.id) return undefined;
        const msg = await prisma.message.findUnique({ where: { whatsappId: key.id } });
        return msg?.body ? { conversation: msg.body } : undefined;
      },
    });

    // Return a promise that resolves once we get a QR or a connection result
    return new Promise<{ qr: string | null }>((resolve) => {
      let resolved = false;
      const done = (qr: string | null) => {
        if (!resolved) {
          resolved = true;
          pendingInits.delete(userId);
          resolve({ qr });
        }
      };

      // Timeout: if no QR or connection in 30s, resolve with null
      const timeout = setTimeout(() => {
        log(userId, 'init timeout — no QR or connection within 30s');
        done(null);
      }, 30_000);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          log(userId, 'QR code ready');
          try {
            await prisma.whatsAppSession.upsert({
              where: { userId },
              update: { qrCode: qr, isConnected: false },
              create: { userId, qrCode: qr, isConnected: false },
            });
          } catch (err) {
            console.error(`${LOG_PREFIX} Failed to store QR in DB:`, err);
          }
          clearTimeout(timeout);
          done(qr);
        }

        if (connection === 'close') {
          const error = lastDisconnect?.error as Boom | undefined;
          const statusCode = error?.output?.statusCode;
          const message = error?.message;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
          log(
            userId,
            `connection close; statusCode=${statusCode} message=${message ?? 'n/a'} shouldReconnect=${shouldReconnect}`
          );

          activeConnections.delete(userId);

          if (shouldReconnect) {
            // Reconnect (e.g. after QR scan auth, server restart request)
            log(userId, 'reconnecting...');
            void this.initializeWhatsApp(userId);
          } else {
            lastConnectionErrors.set(userId, { statusCode, message });
            await this.resetSession(userId, sessionPath);
            try {
              await prisma.whatsAppSession.upsert({
                where: { userId },
                update: { isConnected: false, qrCode: null },
                create: { userId, isConnected: false, qrCode: null },
              });
            } catch (err) {
              console.error(`${LOG_PREFIX} Failed to update session on close:`, err);
            }
          }

          clearTimeout(timeout);
          done(null);
        } else if (connection === 'open') {
          const phoneNumber = sock.user?.id?.split(':')[0] ?? null;
          log(userId, `connected phone=${phoneNumber ?? 'n/a'}`);
          lastConnectionErrors.delete(userId);

          try {
            await prisma.whatsAppSession.upsert({
              where: { userId },
              update: {
                isConnected: true,
                lastConnected: new Date(),
                phoneNumber,
                qrCode: null,
              },
              create: {
                userId,
                isConnected: true,
                lastConnected: new Date(),
                phoneNumber,
              },
            });
          } catch (err) {
            console.error(`${LOG_PREFIX} Failed to update session on open:`, err);
          }

          activeConnections.set(userId, sock);
          clearTimeout(timeout);
          done(null);
          await this.syncContacts(userId, sock);
        }
      });

      sock.ev.on('creds.update', saveCreds);
      this.setupMessageHandlers(userId, sock);
    });
  }

  private setupMessageHandlers(userId: string, sock: WASocket): void {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Process both real-time ('notify') and catch-up ('append') messages
      if (type === 'notify' || type === 'append') {
        // Filter out status messages (stories)
        const filtered = messages.filter(
          (msg) => !isStatusJid(msg.key.remoteJid)
        );
        for (const msg of filtered) {
          try {
            await messageService.handleIncomingMessage(userId, msg, sock);
            // Self-chat (Saved Messages): label contact with friendly name
            const remoteJid = msg.key.remoteJid;
            const selfJid = sock.user?.id;
            if (remoteJid && selfJid && jidNormalizedUser(remoteJid) === jidNormalizedUser(selfJid)) {
              const normalizedSelfJid = jidNormalizedUser(selfJid);
              await contactService.upsertContact(userId, {
                whatsappId: normalizedSelfJid,
                name: 'Saved Messages',
                pushName: 'Saved Messages',
              });
            }
          } catch (err) {
            console.error(`${LOG_PREFIX} Error handling message:`, err);
          }
        }
      }
    });

    // Handle history sync (delivered after connection for historical messages)
    sock.ev.on('messaging-history.set', async ({ messages: historyMessages, contacts: historyContacts }) => {
      log(userId, `history sync received: ${historyMessages?.length ?? 0} messages, ${historyContacts?.length ?? 0} contacts`);

      if (historyContacts) {
        for (const contact of historyContacts) {
          const jid = contact.id;
          if (!jid) continue;
          const normalizedJid = jidNormalizedUser(jid ?? undefined);
          // Skip @lid (Local ID) contacts - these are temporary
          if (normalizedJid.endsWith('@lid')) {
            log(userId, `Skipping @lid contact in history: ${normalizedJid}`);
            continue;
          }
          try {
            await contactService.upsertContact(userId, {
              whatsappId: normalizedJid,
              name: contact.name,
              pushName: contact.notify,
            });
          } catch (err) {
            console.error(`${LOG_PREFIX} Error upserting history contact ${jid}:`, err);
          }
        }
      }

      if (historyMessages) {
        // Filter out status messages from history sync
        const filtered = historyMessages.filter(
          (msg) => !isStatusJid(msg.key?.remoteJid)
        );
        for (const msg of filtered) {
          try {
            await messageService.handleIncomingMessage(userId, msg, sock);
            const remoteJid = msg.key?.remoteJid;
            const selfJid = sock.user?.id;
            if (remoteJid && selfJid && jidNormalizedUser(remoteJid) === jidNormalizedUser(selfJid)) {
              const normalizedSelfJid = jidNormalizedUser(selfJid);
              await contactService.upsertContact(userId, {
                whatsappId: normalizedSelfJid,
                name: 'Saved Messages',
                pushName: 'Saved Messages',
              });
            }
          } catch (err) {
            console.error(`${LOG_PREFIX} Error handling history message:`, err);
          }
        }
        log(userId, `history sync processed ${filtered.length} messages`);
      }
    });

    sock.ev.on('contacts.upsert', async (contacts) => {
      for (const contact of contacts) {
        const jid = contact.id;
        if (!jid) continue;
        const normalizedJid = jidNormalizedUser(jid ?? undefined);
        // Skip @lid (Local ID) contacts - these are temporary
        if (normalizedJid.endsWith('@lid')) {
          log(userId, `Skipping @lid contact: ${normalizedJid}`);
          continue;
        }
        try {
          await contactService.upsertContact(userId, {
            whatsappId: normalizedJid,
            name: contact.name,
            pushName: contact.notify,
            profilePicUrl: contact.imgUrl ?? undefined,
          });
        } catch (err) {
          console.error(`${LOG_PREFIX} Error upserting contact ${jid}:`, err);
        }
      }
    });

    sock.ev.on('contacts.update', async (updates) => {
      for (const contact of updates) {
        const jid = contact.id;
        if (!jid) continue;
        const normalizedJid = jidNormalizedUser(jid ?? undefined);
        // Skip @lid (Local ID) contacts - these are temporary
        if (normalizedJid.endsWith('@lid')) {
          log(userId, `Skipping @lid contact: ${normalizedJid}`);
          continue;
        }
        try {
          await contactService.upsertContact(userId, {
            whatsappId: normalizedJid,
            name: contact.name,
            pushName: contact.notify,
            profilePicUrl: contact.imgUrl ?? undefined,
          });
        } catch (err) {
          console.error(`${LOG_PREFIX} Error updating contact ${jid}:`, err);
        }
      }
    });

    sock.ev.on('messages.reaction', async (reactions) => {
      if (!Array.isArray(reactions)) return;
      for (const { key, reaction } of reactions) {
        try {
          await messageService.handleReaction(userId, {
            remoteJid: key.remoteJid ?? undefined,
            id: key.id ?? undefined,
            fromMe: key.fromMe ?? false,
            participant: key.participant ?? undefined,
          }, reaction ?? {});
        } catch (err) {
          console.error(`${LOG_PREFIX} Error handling reaction:`, err);
        }
      }
    });
  }

  async syncContacts(userId: string, sock: WASocket): Promise<void> {
    try {
      // Baileys v7: store shape may vary; contacts also come from contacts.upsert event
      const store = sock as unknown as { store?: { contacts?: Record<string, { name?: string; notify?: string }> } };
      const contacts = store.store?.contacts;
      if (contacts && Object.keys(contacts).length > 0) {
        let synced = 0;
        for (const [jid, contact] of Object.entries(contacts)) {
          const normalizedJid = jidNormalizedUser(jid ?? undefined);
          // Skip @lid (Local ID) contacts - these are temporary
          if (normalizedJid.endsWith('@lid')) continue;
          
          await contactService.upsertContact(userId, {
            whatsappId: normalizedJid,
            name: contact.name,
            pushName: contact.notify,
          });
          synced++;
        }
        log(userId, `synced ${synced} contacts from store`);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Error syncing contacts:`, error);
    }
  }

  async disconnectWhatsApp(userId: string): Promise<void> {
    const sock = activeConnections.get(userId);
    if (sock) {
      try {
        await sock.logout();
      } catch (err) {
        console.error(`${LOG_PREFIX} Logout error (continuing cleanup):`, err);
      }
      activeConnections.delete(userId);
      log(userId, 'disconnected');
    }
    try {
      await prisma.whatsAppSession.upsert({
        where: { userId },
        update: { isConnected: false, qrCode: null },
        create: { userId, isConnected: false, qrCode: null },
      });
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to update session on disconnect:`, err);
    }
  }

  getConnection(userId: string): WASocket | undefined {
    return activeConnections.get(userId);
  }

  isConnected(userId: string): boolean {
    return activeConnections.has(userId);
  }

  getLastError(userId: string): { statusCode?: number; message?: string } | null {
    return lastConnectionErrors.get(userId) ?? null;
  }

  private async resetSession(userId: string, sessionPath: string): Promise<void> {
    log(userId, 'resetting session — clearing files and DB row');
    activeConnections.delete(userId);
    lastConnectionErrors.delete(userId);
    try {
      if (existsSync(sessionPath)) {
        await rm(sessionPath, { recursive: true, force: true });
        log(userId, `deleted session dir: ${sessionPath}`);
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to delete session files:`, err);
    }
    try {
      await prisma.whatsAppSession.deleteMany({ where: { userId } });
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to delete session row:`, err);
    }
  }
  async sendMessage(
    userId: string,
    contactId: string,
    content: { body?: string; mediaUrl?: string; mediaType?: 'image' | 'video' | 'audio' | 'document' }
  ): Promise<{ id: string } | null> {
    const sock = activeConnections.get(userId);
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    const contact = await contactService.getContactById(userId, contactId);
    if (!contact || !contact.whatsappId) {
      throw new Error('Contact not found or invalid');
    }

    const jid = contact.whatsappId;
    let sentMsg;

    if (content.mediaUrl && content.mediaType) {
      const media = { url: content.mediaUrl };
      let messageContent: any = {};

      switch (content.mediaType) {
        case 'image':
          messageContent = { image: media, caption: content.body };
          break;
        case 'video':
          messageContent = { video: media, caption: content.body };
          break;
        case 'audio':
          messageContent = { audio: media, mimetype: 'audio/mp4' };
          break;
        case 'document':
          messageContent = { document: media, mimetype: 'application/pdf', fileName: 'file.pdf' }; // TODO: Handle filename/mime
          break;
      }

      sentMsg = await sock.sendMessage(jid, messageContent);
    } else if (content.body) {
      sentMsg = await sock.sendMessage(jid, { text: content.body });
    }

    if (sentMsg) {
      const result = await messageService.handleIncomingMessage(userId, sentMsg, sock);
      return result ?? null;
    }
    return null;
  }

  async refreshProfilePicture(userId: string, contactId: string): Promise<string | null> {
    const sock = activeConnections.get(userId);
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    const contact = await contactService.getContactById(userId, contactId);
    if (!contact || !contact.whatsappId) {
      throw new Error('Contact not found or invalid');
    }

    try {
      const url = await sock.profilePictureUrl(contact.whatsappId, 'image'); // 'image' for high res, 'preview' for low
      if (url) {
        await contactService.upsertContact(userId, {
            whatsappId: contact.whatsappId,
            profilePicUrl: url
        });
        return url;
      }
    } catch (err: any) {
      // 404/401 means no profile picture or privacy settings
      const status = err?.data ?? err?.output?.statusCode;
      if (status === 404 || status === 401) {
          // No profile pic
          return null;
      }
      console.error(`${LOG_PREFIX} Failed to fetch profile picture for ${contact.whatsappId}:`, err);
    }
    return null;
  }
}

export const baileysService = new BaileysService();
