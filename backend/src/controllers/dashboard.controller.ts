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
