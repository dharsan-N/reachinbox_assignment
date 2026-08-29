import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class SenderController {
  public static async getSenders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const result = await db.query(
        'SELECT * FROM senders WHERE user_id = $1 ORDER BY created_at ASC',
        [userId]
      );
      res.json({ senders: result.rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async createSender(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { name, email, hourly_limit = 200 } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      if (!name || !email) {
        res.status(400).json({ error: 'Name and email are required' });
        return;
      }

      const result = await db.query(
        `INSERT INTO senders (user_id, name, email, hourly_limit)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, name, email, hourly_limit]
      );

      res.status(201).json({ sender: result.rows[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
