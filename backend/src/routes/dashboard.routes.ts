import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { 
  getDashboardStats, 
  getMessagesGraphData, 
  getActiveContactsGraphData,
  getOldestMessageDate,
  getContactsByHealthStatus,
  getAwaitingRepliesPaginated,
  getToRepliesPaginated,
  getAwaitingReplyPaginated,
  getUpcomingBirthdaysPaginated,
  getUpcomingImportantDatesPaginated,
  getUpcomingRemindersPaginated,
  getUpcomingScheduledMessagesPaginated
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getDashboardStats);
router.get('/messages-graph', getMessagesGraphData);
router.get('/active-contacts-graph', getActiveContactsGraphData);
router.get('/oldest-message-date', getOldestMessageDate);
router.get('/contacts-by-health-status', getContactsByHealthStatus);
router.get('/awaiting-replies', getAwaitingRepliesPaginated);
router.get('/to-reply', getToRepliesPaginated);
router.get('/awaiting-reply', getAwaitingReplyPaginated);
router.get('/upcoming-birthdays', getUpcomingBirthdaysPaginated);
router.get('/upcoming-important-dates', getUpcomingImportantDatesPaginated);
router.get('/upcoming-reminders', getUpcomingRemindersPaginated);
router.get('/upcoming-scheduled-messages', getUpcomingScheduledMessagesPaginated);

export default router;
