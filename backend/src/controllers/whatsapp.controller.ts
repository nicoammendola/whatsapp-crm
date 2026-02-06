import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { baileysService } from '../services/baileys.service';
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

export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    const session = await prisma.whatsAppSession.findUnique({
      where: { userId },
    });

    res.json({
      connected: baileysService.isConnected(userId),
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
