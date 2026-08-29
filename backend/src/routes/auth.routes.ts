import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/google', AuthController.getGoogleAuthUrl);
router.get('/google/callback', AuthController.handleGoogleCallback);
router.post('/login', AuthController.loginWithEmail);
router.post('/demo-login', AuthController.demoLogin);
router.get('/me', requireAuth, AuthController.getMe);
router.post('/logout', AuthController.logout);

export default router;
