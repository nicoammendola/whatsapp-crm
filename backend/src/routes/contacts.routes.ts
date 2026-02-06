import { Router } from 'express';
import {
  getAllContacts,
  getContactById,
  updateContact,
} from '../controllers/contacts.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllContacts);
router.get('/:id', getContactById);
router.patch('/:id', updateContact);

export default router;
