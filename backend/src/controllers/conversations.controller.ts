import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { baileysService } from '../services/baileys.service';

const LOG_PREFIX = '[Conversations]';

/**
 * POST /api/conversations/:jid/activate
 * Silent chat activation: send presence updates so WhatsApp starts syncing messages for this chat.
 * Called when user opens a conversation in the CRM.
 */
export async function activateChat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const jidRaw = req.params.jid;
    const jid = decodeURIComponent(typeof jidRaw === 'string' ? jidRaw : jidRaw[0] ?? '');
    if (!jid || !jid.includes('@')) {
      res.status(400).json({ error: 'Invalid JID' });
      return;
    }

    const sock = baileysService.getConnection(userId);
    if (!sock) {
      res.status(503).json({ error: 'Not connected to WhatsApp' });
      return;
    }

    await sock.sendPresenceUpdate('composing', jid);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await sock.sendPresenceUpdate('paused', jid);
    await sock.presenceSubscribe(jid);

    console.log(`${LOG_PREFIX} Chat activated: ${jid}`);
    res.json({ success: true, activated: jid });
  } catch (error: unknown) {
    console.error(`${LOG_PREFIX} Chat activation failed:`, error);
    const message = error instanceof Error ? error.message : 'Chat activation failed';
    res.status(500).json({ error: message });
  }
}
