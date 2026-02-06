import { Router } from 'express';
import {
  initializeConnection,
  getStatus,
  disconnect,
} from '../controllers/whatsapp.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/initialize', initializeConnection);
router.get('/status', getStatus);
router.post('/disconnect', disconnect);

export default router;
