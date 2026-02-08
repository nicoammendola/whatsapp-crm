import { Router } from 'express';
import {
  initializeConnection,
  initializeWithPairingCode,
  getStatus,
  disconnect,
  heartbeat,
  disconnectClient,
} from '../controllers/whatsapp.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/initialize', initializeConnection);
router.post('/pair', initializeWithPairingCode);
router.get('/status', getStatus);
router.post('/disconnect', disconnect);
router.post('/heartbeat', heartbeat);
router.post('/disconnect-client', disconnectClient);

export default router;
