import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { analyticsService } from '../services/analytics.service';
import { parseLimit } from '../utils/helpers';

export async function getNeedsAttention(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = parseLimit(req.query.limit, 10);
    const contacts = await analyticsService.getContactsNeedingAttention(userId, limit);
    res.json({ contacts });
  } catch (error) {
    console.error('Analytics needs-attention error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts needing attention' });
  }
}

export async function getPendingReplies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = parseLimit(req.query.limit, 20);
    const contacts = await analyticsService.getPendingReplies(userId, limit);
    res.json({ contacts });
  } catch (error) {
    console.error('Analytics pending-replies error:', error);
    res.status(500).json({ error: 'Failed to fetch pending replies' });
  }
}

export async function getContactStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = typeof req.params.contactId === 'string' ? req.params.contactId : req.params.contactId[0];
    const stats = await analyticsService.getContactStats(userId, contactId);
    if (!stats) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json(stats);
  } catch (error) {
    console.error('Analytics contact-stats error:', error);
    res.status(500).json({ error: 'Failed to fetch contact stats' });
  }
}

export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const dashboard = await analyticsService.getDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
}
