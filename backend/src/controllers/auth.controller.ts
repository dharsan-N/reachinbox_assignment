import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { config } from '../config/env';

export class AuthController {
  public static async getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const url = AuthService.getGoogleAuthUrl();
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing code in query params' });
      return;
    }

    try {
      const { user, token } = await AuthService.handleGoogleCallback(code);

      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect(`${config.clientUrl}?token=${token}`);
    } catch (err: any) {
      console.error('Google callback error:', err.message);
      res.redirect(`${config.clientUrl}?error=google_auth_failed`);
    }
  }

  public static async loginWithEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const { user, token } = await AuthService.loginWithEmail(email, name);
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ user, token });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async demoLogin(req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await AuthService.getOrCreateDemoUser();
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ user, token });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    res.json({ user: req.user });
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
  }
}
