import { Router } from 'express';
import { getAllMessages, getContactMessages, getConversations } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllMessages);
router.get('/conversations', getConversations);
router.get('/contact/:contactId', getContactMessages);

export default router;
