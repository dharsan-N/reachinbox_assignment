import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { db } from '../config/db';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

const googleClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.callbackUrl
);

export class AuthService {
  public static getGoogleAuthUrl(): string {
    return googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/gmail.send',
      ],
      prompt: 'consent',
    });
  }

  public static async handleGoogleCallback(code: string): Promise<{ user: User; token: string }> {
    try {
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Failed to retrieve user payload from Google ID Token.');
      }

      const googleId = payload.sub;
      const email = payload.email.trim().toLowerCase();
      const name = payload.name || email.split('@')[0];
      const avatarUrl = payload.picture || '';
      const accessToken = tokens.access_token || null;
      const refreshToken = tokens.refresh_token || null;

      const res = await db.query(
        `INSERT INTO users (id, google_id, email, name, avatar_url, access_token, refresh_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE
         SET google_id = EXCLUDED.google_id, 
             name = EXCLUDED.name, 
             avatar_url = EXCLUDED.avatar_url,
             access_token = COALESCE(EXCLUDED.access_token, users.access_token),
             refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
             updated_at = NOW()
         RETURNING *`,
        [uuidv4(), googleId, email, name, avatarUrl, accessToken, refreshToken]
      );

      const user: User = res.rows[0];

      // Auto-register user's Gmail as a sender
      await db.query(
        `INSERT INTO senders (id, user_id, name, email, hourly_limit)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [uuidv4(), user.id, user.name, user.email, 200]
      );

      const token = this.generateToken(user);
      return { user, token };
    } catch (err: any) {
      console.error('Google OAuth callback error:', err.message);
      throw err;
    }
  }

  public static async loginWithEmail(email: string, name?: string): Promise<{ user: User; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const userName = name || cleanEmail.split('@')[0];
    const res = await db.query(
      `INSERT INTO users (id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, users.name), updated_at = NOW()
       RETURNING *`,
      [
        uuidv4(),
        cleanEmail,
        userName,
        `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=10B981&color=fff`,
      ]
    );

    const user: User = res.rows[0];

    // Auto-register sender
    await db.query(
      `INSERT INTO senders (id, user_id, name, email, hourly_limit)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), user.id, user.name, user.email, 200]
    );

    const token = this.generateToken(user);
    return { user, token };
  }

  public static async getOrCreateDemoUser(): Promise<{ user: User; token: string }> {
    const res = await db.query(
      `INSERT INTO users (id, google_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
       RETURNING *`,
      [
        uuidv4(),
        'demo_google_id_123',
        'oliver.brown@email.io',
        'Oliver Brown',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      ]
    );

    const user: User = res.rows[0];
    const token = this.generateToken(user);
    return { user, token };
  }

  public static generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );
  }

  public static verifyToken(token: string): any {
    return jwt.verify(token, config.jwt.secret);
  }
}
