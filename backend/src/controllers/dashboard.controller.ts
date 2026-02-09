import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { dashboardService } from '../services/dashboard.service';

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const stats = await dashboardService.getDashboardStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}

export async function getMessagesGraphData(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : new Date();
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    if (fromDate > toDate) {
      res.status(400).json({ error: 'fromDate must be before toDate' });
      return;
    }

    const data = await dashboardService.getMessagesGraphData(userId, fromDate, toDate);
    res.json(data);
  } catch (error) {
    console.error('Messages graph data error:', error);
    res.status(500).json({ error: 'Failed to fetch messages graph data' });
  }
}

export async function getActiveContactsGraphData(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : new Date();
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    if (fromDate > toDate) {
      res.status(400).json({ error: 'fromDate must be before toDate' });
      return;
    }

    const data = await dashboardService.getActiveContactsGraphData(userId, fromDate, toDate);
    res.json(data);
  } catch (error) {
    console.error('Active contacts graph data error:', error);
    res.status(500).json({ error: 'Failed to fetch active contacts graph data' });
  }
}

export async function getOldestMessageDate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const oldestDate = await dashboardService.getOldestMessageDate(userId);
    res.json({ oldestDate: oldestDate?.toISOString() || null });
  } catch (error) {
    console.error('Oldest message date error:', error);
    res.status(500).json({ error: 'Failed to fetch oldest message date' });
  }
}

export async function getContactsByHealthStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const status = req.query.status as 'onTrack' | 'needsAttention' | 'atRisk';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    
    if (!status || !['onTrack', 'needsAttention', 'atRisk'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be onTrack, needsAttention, or atRisk' });
      return;
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: 'Invalid limit. Must be between 1 and 100' });
      return;
    }

    if (isNaN(offset) || offset < 0) {
      res.status(400).json({ error: 'Invalid offset. Must be >= 0' });
      return;
    }

    const result = await dashboardService.getContactsByHealthStatus(userId, status, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Get contacts by health status error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts by health status' });
  }
}

export async function getAwaitingRepliesPaginated(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: 'Invalid limit. Must be between 1 and 100' });
      return;
    }

    if (isNaN(offset) || offset < 0) {
      res.status(400).json({ error: 'Invalid offset. Must be >= 0' });
      return;
    }

    const result = await dashboardService.getAwaitingRepliesPaginated(userId, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Get awaiting replies error:', error);
    res.status(500).json({ error: 'Failed to fetch awaiting replies' });
  }
}

export async function getUpcomingBirthdaysPaginated(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: 'Invalid limit. Must be between 1 and 100' });
      return;
    }

    if (isNaN(offset) || offset < 0) {
      res.status(400).json({ error: 'Invalid offset. Must be >= 0' });
      return;
    }

    const result = await dashboardService.getUpcomingBirthdaysPaginated(userId, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Get upcoming birthdays error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming birthdays' });
  }
}

export async function getUpcomingImportantDatesPaginated(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: 'Invalid limit. Must be between 1 and 100' });
      return;
    }

    if (isNaN(offset) || offset < 0) {
      res.status(400).json({ error: 'Invalid offset. Must be >= 0' });
      return;
    }

    const result = await dashboardService.getUpcomingImportantDatesPaginated(userId, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Get upcoming important dates error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming important dates' });
  }
}
