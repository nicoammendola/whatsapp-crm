import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { baileysService } from '../services/baileys.service';
import { connectionManager } from '../services/connection-manager.service';
import { prisma } from '../config/database';

export async function initializeConnection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    if (baileysService.isConnected(userId)) {
      res.json({
        success: true,
        message: 'Already connected',
        connected: true,
      });
      return;
    }

    const result = await baileysService.initializeWhatsApp(userId);

    res.json({
      success: true,
      qr: result.qr,
      message: result.qr ? 'Scan QR code to connect' : 'Connecting...',
    });
  } catch (error) {
    console.error('Initialize WhatsApp error:', error);
    res.status(500).json({ error: 'Failed to initialize WhatsApp' });
  }
}

export async function initializeWithPairingCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { phoneNumber } = req.body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({ error: 'phoneNumber is required (E.164 without +, e.g. "5491123456789")' });
      return;
    }

    // Strip + and spaces
    const cleaned = phoneNumber.replace(/[+\s\-()]/g, '');

    if (baileysService.isConnected(userId)) {
      res.json({ success: true, message: 'Already connected', connected: true });
      return;
    }

    const result = await baileysService.initializeWithPairingCode(userId, cleaned);

    res.json({
      success: true,
      pairingCode: result.pairingCode,
      message: result.pairingCode
        ? 'Enter this code in WhatsApp → Linked devices → Link with phone number'
        : 'Failed to generate pairing code. Try again.',
    });
  } catch (error) {
    console.error('Initialize with pairing code error:', error);
    res.status(500).json({ error: 'Failed to generate pairing code' });
  }
}

export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    const session = await prisma.whatsAppSession.findUnique({
      where: { userId },
    });

    res.json({
      connected: baileysService.isConnected(userId),
      lastError: baileysService.getLastError(userId),
      session: session
        ? {
            phoneNumber: session.phoneNumber,
            lastConnected: session.lastConnected,
            qrCode: session.qrCode,
          }
        : null,
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
}

export async function disconnect(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    await baileysService.disconnectWhatsApp(userId);
    res.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
}

export async function heartbeat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    // Record heartbeat (will connect if needed)
    connectionManager.recordHeartbeat(userId);

    // Check connection status
    const isConnected = baileysService.isConnected(userId);

    res.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Connected to WhatsApp' : 'Connecting...',
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
}

export async function disconnectClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    // This endpoint is called when user closes browser
    // The timeout in connection manager will handle disconnection
    // This is just for explicit disconnection if needed
    res.json({ success: true, message: 'Disconnect signal received' });
  } catch (error) {
    console.error('Disconnect client error:', error);
    res.status(500).json({ error: 'Failed to process disconnect signal' });
  }
}

export async function syncContacts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    if (!baileysService.isConnected(userId)) {
      res.status(503).json({ error: 'WhatsApp not connected' });
      return;
    }

    const result = await baileysService.manualSyncContacts(userId);
    res.json({ success: true, synced: result.synced });
  } catch (error: any) {
    console.error('Sync contacts error:', error);
    if (error.message === 'WhatsApp not connected') {
      res.status(503).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to sync contacts' });
    }
  }
}

export async function searchAndSyncContact(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { phoneNumber, name } = req.body;

    if (!baileysService.isConnected(userId)) {
      res.status(503).json({ error: 'WhatsApp not connected' });
      return;
    }

    if (!phoneNumber && !name) {
      res.status(400).json({ error: 'Either phoneNumber or name is required' });
      return;
    }

    const result = await baileysService.searchAndSyncContact(userId, phoneNumber, name);
    
    if (result) {
      res.json({ success: true, contact: result.contact, synced: result.synced });
    } else {
      res.status(404).json({ error: 'Contact not found' });
    }
  } catch (error: any) {
    console.error('Search and sync contact error:', error);
    if (error.message === 'WhatsApp not connected') {
      res.status(503).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to search and sync contact' });
    }
  }
}
