import { Router } from 'express';
import {
  createScheduledMessage,
  getScheduledMessagesByContact,
  updateScheduledMessage,
  deleteScheduledMessage,
  approveScheduledMessage,
  rejectScheduledMessage,
} from '../controllers/scheduled-messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', createScheduledMessage);
router.get('/contact/:contactId', getScheduledMessagesByContact);
router.put('/:id', updateScheduledMessage);
router.delete('/:id', deleteScheduledMessage);
router.post('/:id/approve', approveScheduledMessage);
router.post('/:id/reject', rejectScheduledMessage);

export default router;
