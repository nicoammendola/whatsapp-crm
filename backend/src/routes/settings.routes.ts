import { Router } from 'express';
import { getSettings, updateSettings, testAnthropicKey } from '../controllers/settings.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/test-anthropic', testAnthropicKey);

export default router;
