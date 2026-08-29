import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/auth', requireAuth, SlackController.getAuthUrl);
router.get('/callback', SlackController.handleCallback);
router.get('/status', requireAuth, SlackController.getStatus);
router.delete('/disconnect', requireAuth, SlackController.disconnect);
router.post('/test-notification', requireAuth, SlackController.testNotification);

export default router;
