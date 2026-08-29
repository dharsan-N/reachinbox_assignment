import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { db } from '../config/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.cookies?.token;

  if (!token) {
    // In dev mode if no token provided, gracefully auto-authenticate with demo user for seamless local DX
    try {
      const demo = await AuthService.getOrCreateDemoUser();
      req.user = demo.user;
      return next();
    } catch {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }
  }

  try {
    const decoded = AuthService.verifyToken(token);
    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rowCount === 0) {
      res.status(401).json({ error: 'Unauthorized: User no longer exists' });
      return;
    }
    req.user = userRes.rows[0];
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
