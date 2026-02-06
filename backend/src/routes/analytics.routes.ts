import { Router } from 'express';
import {
  getNeedsAttention,
  getPendingReplies,
  getContactStats,
  getDashboard,
} from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard', getDashboard);
router.get('/needs-attention', getNeedsAttention);
router.get('/pending-replies', getPendingReplies);
router.get('/contact-stats/:contactId', getContactStats);

export default router;
