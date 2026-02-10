import { Router } from 'express';
import { sendScheduledMessages } from '../controllers/cron.controller';

const router = Router();

router.get('/send-scheduled-messages', sendScheduledMessages);
// Allow POST as well for cron services that only support POST
router.post('/send-scheduled-messages', sendScheduledMessages);

export default router;
