import { Router } from 'express';
import authRoutes from './auth.routes';
import slackRoutes from './slack.routes';
import emailRoutes from './email.routes';
import senderRoutes from './sender.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/slack', slackRoutes);
router.use('/emails', emailRoutes);
router.use('/senders', senderRoutes);

export default router;
