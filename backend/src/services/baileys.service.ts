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
import { emitToUser } from './socket.service';
import { connectionManager } from './connection-manager.service';

const LOG_PREFIX = '[Baileys]';
const activeConnections = new Map<string, WASocket>();
const lastConnectionErrors = new Map<
  string,
  { statusCode?: number; message?: string }
>();
// Track whether we're currently trying to connect (prevent duplicate inits)
const pendingInits = new Set<string>();
// Track sync status per user
const syncStatus = new Map<string, {
  syncing: boolean;
  messageCount: number;
  startTime: number;
  syncTimeout?: NodeJS.Timeout;
}>();

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

    // Get latest message timestamp to determine sync mode
    // Even after clearing session, we may have existing messages in database from previous session
    const latestMessageTimestamp = await messageService.getLatestMessageTimestamp(userId);
    const lastSyncTimestamp = latestMessageTimestamp 
      ? Math.floor(latestMessageTimestamp.getTime() / 1000) // Convert to Unix seconds
      : null;
    
    // Full history sync on first connection, incremental sync on reconnect
    const shouldSyncFullHistory = lastSyncTimestamp === null;
    
    if (lastSyncTimestamp) {
      log(userId, `latest message timestamp: ${new Date(lastSyncTimestamp * 1000).toISOString()} - incremental sync (only newer messages)`);
    } else {
      log(userId, 'no existing messages - full history sync');
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'warn' }),
      syncFullHistory: shouldSyncFullHistory, // Full history on first connection, incremental on reconnect
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
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
          const isUserActive = connectionManager.isUserActive(userId);
          
          // Only auto-reconnect if:
          // 1. Not logged out (session is still valid)
          // 2. User is still active (has sent heartbeat recently)
          // This prevents auto-reconnect when we intentionally disconnect (user closed CRM)
          const shouldReconnect = !isLoggedOut && isUserActive;
          
          log(
            userId,
            `connection close; statusCode=${statusCode} message=${message ?? 'n/a'} isUserActive=${isUserActive} shouldReconnect=${shouldReconnect}`
          );

          activeConnections.delete(userId);

          if (shouldReconnect) {
            // After pairing code auth, Baileys disconnects and needs to reconnect (if user still active)
            log(userId, 'reconnecting after pairing auth... (user still active)');
            // Re-initialize with QR flow (it will use existing creds, no new QR needed)
            void this.initializeWhatsApp(userId);
          } else if (isLoggedOut) {
            // Session invalid - clear it
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
          } else {
            // User inactive - session preserved, will reconnect when user opens CRM again
            log(userId, 'connection closed - session preserved, will resume when user active');
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
          
          // Start tracking sync - will complete when history sync finishes or after timeout
          this.startSyncTracking(userId);
          // Robust sync: backward fill (24h lookback) + last 300 messages for recent chats
          void this.runConnectionSync(userId, sock);
        }
      });

      sock.ev.on('creds.update', saveCreds);
      this.setupMessageHandlers(userId, sock, lastSyncTimestamp);
    });
  }

  async restoreSessions(): Promise<void> {
    const sessions = await prisma.whatsAppSession.findMany({
      where: { isConnected: true },
    });

    console.log(`${LOG_PREFIX} Found ${sessions.length} sessions in database`);
    console.log(`${LOG_PREFIX} Sessions will connect automatically when users open the CRM (via heartbeat)`);
    
    // Don't auto-connect on startup - wait for frontend heartbeats
    // This mimics WhatsApp Desktop behavior where connections are user-initiated
    // Phone notifications will work until users open the CRM
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

    // Get latest message timestamp to determine sync mode
    const latestMessageTimestamp = await messageService.getLatestMessageTimestamp(userId);
    const lastSyncTimestamp = latestMessageTimestamp 
      ? Math.floor(latestMessageTimestamp.getTime() / 1000) // Convert to Unix seconds
      : null;
    
    // Full history sync on first connection, incremental sync on reconnect
    const shouldSyncFullHistory = lastSyncTimestamp === null;
    
    if (lastSyncTimestamp) {
      log(userId, `latest message timestamp: ${new Date(lastSyncTimestamp * 1000).toISOString()} - incremental sync (only newer messages)`);
    } else {
      log(userId, 'no existing messages - full history sync');
    }

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'warn' }),
      syncFullHistory: shouldSyncFullHistory, // Full history on first connection, incremental on reconnect
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
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
          const isUserActive = connectionManager.isUserActive(userId);
          
          // Only auto-reconnect if:
          // 1. Not logged out (session is still valid)
          // 2. User is still active (has sent heartbeat recently)
          // This prevents auto-reconnect when we intentionally disconnect (user closed CRM)
          const shouldReconnect = !isLoggedOut && isUserActive;
          
          log(
            userId,
            `connection close; statusCode=${statusCode} message=${message ?? 'n/a'} isUserActive=${isUserActive} shouldReconnect=${shouldReconnect}`
          );

          activeConnections.delete(userId);

          if (shouldReconnect) {
            // Reconnect (e.g. after network error, server restart) - user is still active
            log(userId, 'reconnecting... (user still active)');
            void this.initializeWhatsApp(userId);
          } else if (isLoggedOut) {
            // Session invalid - clear it
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
          } else {
            // User inactive - session preserved, will reconnect when user opens CRM again
            log(userId, 'connection closed - session preserved, will resume when user active');
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
          
          // Start tracking sync - will complete when history sync finishes or after timeout
          this.startSyncTracking(userId);
          // Robust sync: backward fill (24h lookback) + last 300 messages for recent chats
          void this.runConnectionSync(userId, sock);
        }
      });

      sock.ev.on('creds.update', saveCreds);
      this.setupMessageHandlers(userId, sock, lastSyncTimestamp);
    });
  }

  /**
   * On connection: request on-demand history so we catch messages missed while
   * disconnected (e.g. new contacts, new conversations).
   * Phase 1 (24h lookback): If our last message in DB is older than 24h (or we have none),
   * we run the fetch. Phase 2: Always request last 50 messages for top 6 chats (≈300 messages)
   * to fill any gaps. Results arrive via messaging-history.set.
   */
  private async runConnectionSync(userId: string, sock: WASocket): Promise<void> {
    try {
      const connectionTime = new Date();
      const lookbackMs = 24 * 60 * 60 * 1000;
      const lookbackTime = new Date(connectionTime.getTime() - lookbackMs);

      const lastMessageTimestamp = await messageService.getLatestMessageTimestamp(userId);
      const lastMessageOlderThan24h =
        !lastMessageTimestamp || lastMessageTimestamp < lookbackTime;

      const RECENT_CHATS_LIMIT = 6;
      const MESSAGES_PER_CHAT = 50;
      const refs = await messageService.getRecentConversationRefs(userId, RECENT_CHATS_LIMIT);

      if (refs.length === 0) {
        log(userId, 'connection sync: no conversations yet, nothing to fetch');
        return;
      }

      if (!lastMessageOlderThan24h) {
        log(userId, 'connection sync: last message within 24h; still fetching last 300 for recent chats');
      } else {
        log(userId, 'connection sync: last message older than 24h (or none) - fetching history for recent chats');
      }

      log(
        userId,
        `connection sync: fetching up to ${MESSAGES_PER_CHAT * refs.length} messages (${refs.length} chats, 50 each)`
      );

      for (let i = 0; i < refs.length; i++) {
        const { key, timestampSec } = refs[i];
        try {
          await sock.fetchMessageHistory(MESSAGES_PER_CHAT, key, timestampSec);
          log(userId, `connection sync: requested history for ${key.remoteJid} (${i + 1}/${refs.length})`);
        } catch (fetchErr: unknown) {
          const err = fetchErr as { output?: { statusCode?: number }; message?: string };
          const code = err?.output?.statusCode;
          const msg = err?.message ?? 'unknown';
          log(userId, `connection sync: fetchMessageHistory failed for ${key.remoteJid}: ${msg}`);
          if (code === 479) {
            log(userId, 'WhatsApp rejected history (479) - may be rate limit or invalid reference');
          }
        }
        if (i < refs.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      log(userId, 'connection sync: requests sent; messages will arrive via messaging-history.set');
    } catch (err) {
      console.error(`${LOG_PREFIX} runConnectionSync error:`, err);
    }
  }

  private setupMessageHandlers(userId: string, sock: WASocket, lastSyncTimestamp: number | null): void {
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
    sock.ev.on('messaging-history.set', async ({ messages: historyMessages, contacts: historyContacts, isLatest }) => {
      log(userId, `history sync received: ${historyMessages?.length ?? 0} messages, ${historyContacts?.length ?? 0} contacts, isLatest=${isLatest ?? false}`);

      // Filter messages to only include those newer than our latest message
      let messagesToProcess = historyMessages ?? [];
      
      // Filter by timestamp
      if (lastSyncTimestamp && messagesToProcess.length > 0) {
        const beforeCount = messagesToProcess.length;
        messagesToProcess = messagesToProcess.filter((msg) => {
          // Message timestamp is in Unix seconds (can be number or Long)
          const msgTimestamp = msg.messageTimestamp 
            ? (typeof msg.messageTimestamp === 'number' 
                ? msg.messageTimestamp 
                : Number(msg.messageTimestamp))
            : null;
          if (!msgTimestamp) return true; // Include if no timestamp (shouldn't happen, but be safe)
          return msgTimestamp > lastSyncTimestamp;
        });
        const filteredCount = beforeCount - messagesToProcess.length;
        if (filteredCount > 0) {
          log(userId, `filtered out ${filteredCount} old messages (already in database), processing ${messagesToProcess.length} new messages`);
        }
      }

      // Track sync progress (only count new messages)
      const sync = syncStatus.get(userId);
      if (sync) {
        sync.messageCount += messagesToProcess.length;
      }

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

      if (messagesToProcess.length > 0) {
        // Filter out status messages from history sync
        const filtered = messagesToProcess.filter(
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
        
        log(userId, `history sync processed ${filtered.length} new messages`);
      } else {
        log(userId, 'no new messages to process (all already in database)');
      }

      // If this is the latest sync chunk, mark sync as complete
      if (isLatest === true) {
        log(userId, `history sync complete - ${sync?.messageCount ?? 0} new messages synced`);
        this.completeSync(userId);
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
        // Gracefully close the socket connection WITHOUT logging out
        // This preserves the auth state so the session can be resumed later
        // Similar to closing WhatsApp Desktop - connection closes but session remains valid
        // Use end() if available, otherwise close the WebSocket directly
        if (typeof (sock as any).end === 'function') {
          (sock as any).end();
        } else if (sock.ws && typeof sock.ws.close === 'function') {
          sock.ws.close();
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} Socket close error (continuing cleanup):`, err);
      }
      activeConnections.delete(userId);
      log(userId, 'disconnected gracefully - session preserved for resume');
    }
    
    // Clean up sync tracking
    const sync = syncStatus.get(userId);
    if (sync?.syncTimeout) {
      clearTimeout(sync.syncTimeout);
    }
    syncStatus.delete(userId);
    
    try {
      // Mark as disconnected but keep qrCode null (we don't need QR if session is valid)
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

  /**
   * Start tracking sync status for a user.
   * Called when connection opens.
   */
  private startSyncTracking(userId: string): void {
    // Clear any existing sync tracking
    const existing = syncStatus.get(userId);
    if (existing?.syncTimeout) {
      clearTimeout(existing.syncTimeout);
    }

    // Start new sync tracking
    syncStatus.set(userId, {
      syncing: true,
      messageCount: 0,
      startTime: Date.now(),
    });

    log(userId, 'sync tracking started - waiting for history sync...');

    // Set a timeout - if no history sync happens within 10 seconds, assume sync is complete
    // This handles the case where user was already synced and no history sync event fires
    const syncTimeout = setTimeout(() => {
      const sync = syncStatus.get(userId);
      if (sync && sync.syncing) {
        log(userId, 'sync timeout - no history sync received, assuming already synced');
        this.completeSync(userId);
      }
    }, 10000); // 10 seconds

    const sync = syncStatus.get(userId);
    if (sync) {
      sync.syncTimeout = syncTimeout;
    }
  }

  /**
   * Mark sync as complete and emit event to frontend.
   * Called when history sync finishes or timeout occurs.
   */
  private completeSync(userId: string): void {
    const sync = syncStatus.get(userId);
    if (!sync || !sync.syncing) {
      return;
    }

    // Clear timeout if exists
    if (sync.syncTimeout) {
      clearTimeout(sync.syncTimeout);
    }

    const duration = Date.now() - sync.startTime;
    log(userId, `sync complete - ${sync.messageCount} messages synced in ${duration}ms`);

    // Mark sync as complete
    sync.syncing = false;
    sync.syncTimeout = undefined;

    // Emit socket event to notify frontend
    try {
      emitToUser(userId, 'whatsapp_sync_complete', {
        messageCount: sync.messageCount,
        duration,
      });
      log(userId, 'emitted sync_complete event to frontend');
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to emit sync_complete event:`, err);
    }

    // Clean up after a short delay
    setTimeout(() => {
      syncStatus.delete(userId);
    }, 5000);
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

  /**
   * Manually sync contacts from WhatsApp store.
   * Returns the number of contacts synced.
   */
  async manualSyncContacts(userId: string): Promise<{ synced: number }> {
    const sock = activeConnections.get(userId);
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    await this.syncContacts(userId, sock);
    
    // Count how many contacts were synced by checking the store
    const store = sock as unknown as { store?: { contacts?: Record<string, { name?: string; notify?: string }> } };
    const contacts = store.store?.contacts;
    const synced = contacts ? Object.keys(contacts).filter(jid => {
      const normalizedJid = jidNormalizedUser(jid ?? undefined);
      return !normalizedJid.endsWith('@lid');
    }).length : 0;

    return { synced };
  }

  /**
   * Search for a contact in WhatsApp by phone number or name and sync it.
   * Phone number should be in E.164 format without + (e.g., "393293471494").
   * Returns the synced contact if found, null otherwise.
   */
  async searchAndSyncContact(userId: string, phoneNumber?: string, name?: string): Promise<{ contact: any; synced: boolean } | null> {
    const sock = activeConnections.get(userId);
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    // First, sync all contacts to ensure we have the latest
    await this.syncContacts(userId, sock);

    // Search in the store
    const store = sock as unknown as { store?: { contacts?: Record<string, { name?: string; notify?: string; imgUrl?: string }> } };
    const contacts = store.store?.contacts;
    
    if (!contacts) {
      return null;
    }

    // Normalize phone number for search (remove + and spaces)
    const normalizedPhone = phoneNumber ? phoneNumber.replace(/[+\s\-()]/g, '') : null;
    
    // Search for matching contact
    for (const [jid, contact] of Object.entries(contacts)) {
      const normalizedJid = jidNormalizedUser(jid ?? undefined);
      if (normalizedJid.endsWith('@lid')) continue;

      // Extract phone number from JID (format: 393293471494@s.whatsapp.net)
      const jidPhone = normalizedJid.split('@')[0];
      
      // Check if phone number matches
      if (normalizedPhone && jidPhone === normalizedPhone) {
        // Found by phone number - sync it
        const syncedContact = await contactService.upsertContact(userId, {
          whatsappId: normalizedJid,
          name: contact.name,
          pushName: contact.notify,
          phoneNumber: normalizedPhone,
          profilePicUrl: contact.imgUrl ?? undefined,
        });
        return { contact: syncedContact, synced: true };
      }

      // Check if name matches (case-insensitive)
      if (name) {
        const contactName = contact.name || contact.notify || '';
        if (contactName.toLowerCase().includes(name.toLowerCase())) {
          // Found by name - sync it
          const syncedContact = await contactService.upsertContact(userId, {
            whatsappId: normalizedJid,
            name: contact.name,
            pushName: contact.notify,
            phoneNumber: jidPhone,
            profilePicUrl: contact.imgUrl ?? undefined,
          });
          return { contact: syncedContact, synced: true };
        }
      }
    }

    // If not found in store, try to create contact from phone number if provided
    if (normalizedPhone) {
      const jid = `${normalizedPhone}@s.whatsapp.net`;
      const normalizedJid = jidNormalizedUser(jid);
      
      // Try to fetch contact info from WhatsApp
      try {
        const results = await sock.onWhatsApp(normalizedJid);
        if (results && Array.isArray(results) && results.length > 0) {
          const result = results[0];
          if (result?.exists) {
            // Contact exists on WhatsApp - create it in our DB
            const syncedContact = await contactService.upsertContact(userId, {
              whatsappId: normalizedJid,
              name: name || undefined,
              phoneNumber: normalizedPhone,
            });
            return { contact: syncedContact, synced: true };
          }
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} Error checking contact existence:`, err);
      }
    }

    return null;
  }

  /**
   * Fetch and sync messages from WhatsApp for a specific contact.
   * Fetches the last N messages (default 100) for the contact.
   */
  async syncContactMessages(userId: string, contactId: string, limit: number = 100): Promise<{ synced: number }> {
    const sock = activeConnections.get(userId);
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    const contact = await contactService.getContactById(userId, contactId);
    if (!contact || !contact.whatsappId) {
      throw new Error('Contact not found or invalid');
    }

    const jid = contact.whatsappId;
    log(userId, `syncing messages for contact ${contactId} (${jid}), limit: ${limit}`);

    try {
      // Try to access messages from socket store first
      // Baileys stores messages in sock.store.messages[jid].messages
      const store = sock as unknown as { 
        store?: { 
          messages?: Record<string, { messages?: WAMessage[] }> 
        } 
      };
      
      let messages: WAMessage[] = [];
      
      // Check if messages are available in the store
      if (store.store?.messages?.[jid]?.messages) {
        const storeMessages = store.store.messages[jid].messages || [];
        // Get the most recent messages (limit to requested amount)
        messages = storeMessages.slice(-limit).reverse();
        log(userId, `found ${messages.length} messages in store for ${jid}`);
      }
      
      // If no messages in store, try to get oldest message from database to use as reference
      // fetchMessageHistory can only fetch messages OLDER than a reference message
      if (messages.length === 0) {
        const oldestMessage = await prisma.message.findFirst({
          where: { userId, contactId },
          orderBy: { timestamp: 'asc' },
          select: { whatsappId: true, timestamp: true, fromMe: true },
        });
        
        if (oldestMessage) {
          // We have an existing message - use it as reference to fetch older messages
          try {
            const msgKey = {
              remoteJid: jid,
              id: oldestMessage.whatsappId,
              fromMe: oldestMessage.fromMe,
            };
            const msgTimestamp = Math.floor(oldestMessage.timestamp.getTime() / 1000);
            
            log(userId, `fetching messages older than ${oldestMessage.whatsappId} (timestamp: ${msgTimestamp}) for ${jid}`);
            
            // fetchMessageHistory triggers WhatsApp to send messages via messaging-history.set event
            // The messages will be processed by the existing event handler
            await sock.fetchMessageHistory(limit, msgKey, msgTimestamp);
            
            log(userId, `triggered history fetch for ${jid} - messages will arrive via messaging-history.set event`);
            
            // Note: Messages will be processed asynchronously by the messaging-history.set handler
            // We return 0 here as the sync happens via events, not synchronously
            // The frontend will see new messages through socket events or polling
            return { synced: 0 };
          } catch (fetchErr: any) {
            // Error 479 means WhatsApp rejected the request (invalid parameters or not allowed)
            // This can happen if the message reference is invalid or WhatsApp doesn't allow fetching
            log(userId, `fetchMessageHistory failed for ${jid}: ${fetchErr.message || 'Unknown error'}`);
            if (fetchErr.output?.statusCode === 479 || fetchErr.message?.includes('479')) {
              log(userId, `WhatsApp rejected history fetch (error 479) - may need valid message reference or contact may not have accessible history`);
            }
            return { synced: 0 };
          }
        } else {
          // No messages in database and none in store
          // Historical messages are only synced on initial WhatsApp connection
          // New messages will be synced automatically when sent/received
          log(userId, `no messages found for ${jid} in store or database`);
          return { synced: 0 };
        }
      }
      
      // Process messages from store
      log(userId, `processing ${messages.length} messages from store for ${jid}`);
      let synced = 0;
      for (const msg of messages) {
        try {
          // Process each message through the normal message handler
          // This will create/update the message in the database
          await messageService.handleIncomingMessage(userId, msg, sock);
          synced++;
        } catch (err) {
          console.error(`${LOG_PREFIX} Error syncing message ${msg.key?.id}:`, err);
        }
      }

      log(userId, `synced ${synced} messages from store for contact ${contactId}`);
      return { synced };
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error fetching messages for ${jid}:`, err);
      throw new Error(`Failed to sync messages: ${err.message || 'Unknown error'}`);
    }
  }
}

export const baileysService = new BaileysService();
