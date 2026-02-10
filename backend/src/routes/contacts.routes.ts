import { Router } from 'express';
import {
  getAllContacts,
  getContactById,
  updateContact,
  refreshProfilePicture,
  getContactStats,
} from '../controllers/contacts.controller';
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} from '../controllers/reminders.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllContacts);
router.get('/:id', getContactById);
router.get('/:id/stats', getContactStats);
router.post('/:id/refresh-profile-picture', refreshProfilePicture);
router.patch('/:id', updateContact);

router.get('/:id/reminders', getReminders);
router.post('/:id/reminders', createReminder);
router.patch('/:id/reminders/:reminderId', updateReminder);
router.delete('/:id/reminders/:reminderId', deleteReminder);

export default router;
