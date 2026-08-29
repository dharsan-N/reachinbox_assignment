import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/schedule', requireAuth, EmailController.scheduleEmails);
router.get('/scheduled', requireAuth, EmailController.getScheduledEmails);
router.get('/sent', requireAuth, EmailController.getSentEmails);
router.get('/search', requireAuth, EmailController.searchEmails);
router.delete('/:id', requireAuth, EmailController.cancelScheduledEmail);
router.get('/stats', requireAuth, EmailController.getStats);

export default router;
