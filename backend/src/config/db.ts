import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { config } from './env';

export interface IDbClient {
  query(text: string, params?: any[]): Promise<any>;
  end(): Promise<void>;
}

class ResilientDb implements IDbClient {
  private pgPool: Pool | null = null;
  private memPool: any = null;
  private isMemory = false;

  constructor() {
    this.pgPool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,
    });

    this.pgPool.on('error', () => {
      // Background client error
    });
  }

  private getMemPool() {
    if (!this.memPool) {
      const mem = newDb();
      mem.public.registerFunction({
        name: 'gen_random_uuid',
        implementation: () => require('crypto').randomUUID(),
      });
      const pgAdapter = mem.adapters.createPg();
      this.memPool = new pgAdapter.Pool();
    }
    return this.memPool;
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (this.isMemory) {
      const pool = this.getMemPool();
      return pool.query(text, params);
    }

    try {
      const res = await this.pgPool!.query(text, params);
      return res;
    } catch (err: any) {
      if (
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('connect') ||
        err.message?.includes('timeout') ||
        err.message?.includes('SASL')
      ) {
        console.warn(
          `[PostgreSQL] Live database at ${config.database.host}:${config.database.port} unavailable. Activating in-memory PostgreSQL engine.`
        );
        this.isMemory = true;
        const pool = this.getMemPool();
        return pool.query(text, params);
      }
      throw err;
    }
  }

  async end(): Promise<void> {
    if (this.pgPool) {
      try {
        await this.pgPool.end();
      } catch {}
    }
    if (this.memPool) {
      try {
        await this.memPool.end();
      } catch {}
    }
  }
}

export const db = new ResilientDb();

export const query = async (text: string, params?: any[]) => {
  return db.query(text, params);
};
