import { Router } from 'express';
import { SenderController } from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, SenderController.getSenders);
router.post('/', requireAuth, SenderController.createSender);

export default router;
