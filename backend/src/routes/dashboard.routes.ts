import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { 
  getDashboardStats, 
  getMessagesGraphData, 
  getActiveContactsGraphData,
  getOldestMessageDate,
  getContactsByHealthStatus,
  getAwaitingRepliesPaginated,
  getUpcomingBirthdaysPaginated,
  getUpcomingImportantDatesPaginated
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getDashboardStats);
router.get('/messages-graph', getMessagesGraphData);
router.get('/active-contacts-graph', getActiveContactsGraphData);
router.get('/oldest-message-date', getOldestMessageDate);
router.get('/contacts-by-health-status', getContactsByHealthStatus);
router.get('/awaiting-replies', getAwaitingRepliesPaginated);
router.get('/upcoming-birthdays', getUpcomingBirthdaysPaginated);
router.get('/upcoming-important-dates', getUpcomingImportantDatesPaginated);

export default router;
