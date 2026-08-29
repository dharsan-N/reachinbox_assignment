import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { config } from '../config/env';

export class AuthController {
  public static async getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const host = req.get('host') || 'localhost:5000';
      const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
      const protocol = isHttps ? 'https' : 'http';
      const dynamicCallback = process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

      // Automatically capture the exact frontend origin from the Referer header
      let frontendOrigin = config.clientUrl;
      const referer = req.get('referer');
      if (referer) {
        try {
          const urlObj = new URL(referer);
          frontendOrigin = `${urlObj.protocol}//${urlObj.host}`;
        } catch {}
      }

      const client = new OAuth2Client(
        config.google.clientId,
        config.google.clientSecret,
        dynamicCallback
      );

      const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent',
        state: frontendOrigin, // Passes the exact frontend URL through OAuth state parameter
      });

      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        res.redirect(url);
        return;
      }

      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing code in query params' });
      return;
    }

    try {
      const host = req.get('host') || 'localhost:5000';
      const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
      const protocol = isHttps ? 'https' : 'http';
      const dynamicCallback = process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

      const { user, token } = await AuthService.handleGoogleCallback(code, dynamicCallback);

      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect back to the exact frontend that initiated the login (from state parameter)
      const targetFrontend =
        (typeof state === 'string' && state.startsWith('http') ? state : null) ||
        config.clientUrl ||
        `${protocol}://${host}`;

      res.redirect(`${targetFrontend.replace(/\/$/, '')}/?token=${token}`);
    } catch (err: any) {
      console.error('Google callback error:', err.message);
      const fallbackUrl = (typeof state === 'string' && state.startsWith('http') ? state : config.clientUrl);
      res.redirect(`${fallbackUrl}?error=google_auth_failed`);
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
