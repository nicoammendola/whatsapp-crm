import { Request, Response } from 'express';
import { processDueScheduledMessages } from '../services/scheduled-send-cron.service';

/**
 * Railway cron (or external cron) should call this endpoint every minute.
 * Protect with CRON_SECRET: send header "Authorization: Bearer <CRON_SECRET>" or "x-cron-secret: <CRON_SECRET>".
 */
export async function sendScheduledMessages(req: Request, res: Response): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const cronSecretHeader = req.headers['x-cron-secret'];
  const provided = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cronSecretHeader;

  if (secret && provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await processDueScheduledMessages();
    res.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Cron send scheduled messages error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to process scheduled messages',
    });
  }
}
