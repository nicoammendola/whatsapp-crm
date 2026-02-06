import { Router } from 'express';
import { getAllMessages, getContactMessages } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllMessages);
router.get('/contact/:contactId', getContactMessages);

export default router;
