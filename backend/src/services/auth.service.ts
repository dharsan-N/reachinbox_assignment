import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { db } from '../config/db';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  public static getGoogleAuthUrl(redirectUri?: string): string {
    const client = new OAuth2Client(
      config.google.clientId,
      config.google.clientSecret,
      redirectUri || config.google.callbackUrl
    );
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });
  }

  public static async handleGoogleCallback(
    code: string,
    redirectUri?: string
  ): Promise<{ user: User; token: string }> {
    try {
      const client = new OAuth2Client(
        config.google.clientId,
        config.google.clientSecret,
        redirectUri || config.google.callbackUrl
      );
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      let payload: any = null;
      if (tokens.id_token) {
        try {
          const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: config.google.clientId,
          });
          payload = ticket.getPayload();
        } catch {
          // Fallback to userinfo
        }
      }

      if (!payload || !payload.email) {
        const userinfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        payload = userinfoRes.data;
      }

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
    const res = await db.query(`SELECT * FROM users ORDER BY created_at ASC LIMIT 1`);
    let user: User;
    if (res.rowCount > 0) {
      user = res.rows[0];
    } else {
      const created = await db.query(
        `INSERT INTO users (id, email, name, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          uuidv4(),
          'oliver.brown@email.io',
          'Oliver Brown',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
        ]
      );
      user = created.rows[0];
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  public static generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
  }

  public static verifyToken(token: string): any {
    return jwt.verify(token, config.jwt.secret);
  }
}
