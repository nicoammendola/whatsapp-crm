import { Router } from 'express';
import { autocomplete, placeDetails } from '../controllers/geocode.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/autocomplete', autocomplete);
router.get('/place-details', placeDetails);

export default router;
