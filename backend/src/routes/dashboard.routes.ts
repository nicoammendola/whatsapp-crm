import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getDashboardStats);

export default router;
