import { Router } from 'express';
import {
  getAllContacts,
  getContactById,
  updateContact,
  refreshProfilePicture,
  getContactStats,
} from '../controllers/contacts.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllContacts);
router.get('/:id', getContactById);
router.get('/:id/stats', getContactStats);
router.post('/:id/refresh-profile-picture', refreshProfilePicture);
router.patch('/:id', updateContact);

export default router;
