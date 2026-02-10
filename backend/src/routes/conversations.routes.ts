import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { activateChat } from '../controllers/conversations.controller';

const router = Router();

router.use(authMiddleware);

router.post('/:jid/activate', activateChat);

export default router;
