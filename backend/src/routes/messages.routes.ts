import { Router } from 'express';
import { getAllMessages, getContactMessages, getConversations, markAsRead, sendMessage } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/mark-read', markAsRead);
router.post('/send', sendMessage);
router.get('/', getAllMessages);
router.get('/conversations', getConversations);
router.get('/contact/:contactId', getContactMessages);

export default router;
