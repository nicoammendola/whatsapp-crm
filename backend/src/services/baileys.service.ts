import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import path from 'path';
import { prisma } from '../config/database';
import { messageService } from './message.service';
import { contactService } from './contact.service';

const LOG_PREFIX = '[Baileys]';
const activeConnections = new Map<string, WASocket>();

function log(userId: string, message: string): void {
  console.log(`${LOG_PREFIX} userId=${userId} ${message}`);
}

export class BaileysService {
  async initializeWhatsApp(userId: string): Promise<{ qr: string | null }> {
    if (activeConnections.has(userId)) {
      log(userId, 'already connected; skipping init');
      return { qr: null };
    }

    const sessionPath = path.join(
      process.env.SESSION_PATH ?? './whatsapp-sessions',
      userId
    );

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'silent' }),
    });

    let qrCode: string | null = null;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
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
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        log(userId, `connection close; statusCode=${statusCode} shouldReconnect=${shouldReconnect}`);

        if (shouldReconnect) {
          activeConnections.delete(userId);
          void this.initializeWhatsApp(userId);
        } else {
          activeConnections.delete(userId);
          try {
            await prisma.whatsAppSession.update({
              where: { userId },
              data: { isConnected: false, qrCode: null },
            });
          } catch (err) {
            console.error(`${LOG_PREFIX} Failed to update session on close:`, err);
          }
        }
      } else if (connection === 'open') {
        const phoneNumber = sock.user?.id?.split(':')[0] ?? null;
        log(userId, `connected phone=${phoneNumber ?? 'n/a'}`);

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
        await this.syncContacts(userId, sock);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          try {
            await messageService.handleIncomingMessage(userId, msg);
          } catch (err) {
            console.error(`${LOG_PREFIX} Error handling message:`, err);
          }
        }
      }
    });

    sock.ev.on('contacts.upsert', async (contacts) => {
      for (const contact of contacts) {
        const jid = contact.id;
        if (!jid) continue;
        try {
          await contactService.upsertContact(userId, {
            whatsappId: jid,
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
        try {
          await contactService.upsertContact(userId, {
            whatsappId: jid,
            name: contact.name,
            pushName: contact.notify,
            profilePicUrl: contact.imgUrl ?? undefined,
          });
        } catch (err) {
          console.error(`${LOG_PREFIX} Error updating contact ${jid}:`, err);
        }
      }
    });

    return { qr: qrCode };
  }

  async syncContacts(userId: string, sock: WASocket): Promise<void> {
    try {
      // Baileys v7: store shape may vary; contacts also come from contacts.upsert event
      const store = sock as unknown as { store?: { contacts?: Record<string, { name?: string; notify?: string }> } };
      const contacts = store.store?.contacts;
      if (contacts && Object.keys(contacts).length > 0) {
        for (const [jid, contact] of Object.entries(contacts)) {
          await contactService.upsertContact(userId, {
            whatsappId: jid,
            name: contact.name,
            pushName: contact.notify,
          });
        }
        log(userId, `synced ${Object.keys(contacts).length} contacts from store`);
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
      await prisma.whatsAppSession.update({
        where: { userId },
        data: { isConnected: false, qrCode: null },
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
}

export const baileysService = new BaileysService();
