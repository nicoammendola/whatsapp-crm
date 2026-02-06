import { Router } from 'express';
import {
  initializeConnection,
  initializeWithPairingCode,
  getStatus,
  disconnect,
} from '../controllers/whatsapp.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/initialize', initializeConnection);
router.post('/pair', initializeWithPairingCode);
router.get('/status', getStatus);
router.post('/disconnect', disconnect);

export default router;
