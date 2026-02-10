import { Router } from 'express';
import { analyzeContact } from '../controllers/analysis.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/:contactId', analyzeContact);

export default router;
