import { Router } from 'express';
import {
  initializeConnection,
  initializeWithPairingCode,
  getStatus,
  disconnect,
  heartbeat,
  disconnectClient,
  syncContacts,
  searchAndSyncContact,
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
router.post('/sync-contacts', syncContacts);
router.post('/search-and-sync-contact', searchAndSyncContact);

export default router;
