import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';

export let redisConnection: Redis;
export let redisRateLimiter: Redis;
export let isRedisConnected = false;

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 5000,
  retryStrategy(times) {
    // Retry with exponential backoff capped at 3s
    return Math.min(times * 100, 3000);
  },
};

if (config.redis.url) {
  const isTls = config.redis.url.startsWith('rediss://');
  redisConnection = new Redis(config.redis.url, {
    ...redisOptions,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
  });
} else {
  redisConnection = new Redis({
    ...redisOptions,
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  });
}

redisConnection.on('connect', () => {
  isRedisConnected = true;
  console.log('[Redis] Connected successfully to Redis instance.');
});

redisConnection.on('ready', () => {
  isRedisConnected = true;
});

redisConnection.on('error', (err: any) => {
  isRedisConnected = false;
  // Log once or cleanly without crashing
  if (err.code === 'ECONNREFUSED') {
    // Expected when running in standalone mode without Redis server
  } else {
    console.warn(`[Redis] Connection warning: ${err.message}`);
  }
});

redisConnection.on('close', () => {
  isRedisConnected = false;
});

redisRateLimiter = redisConnection;

export function isRedisAvailable(): boolean {
  return isRedisConnected && redisConnection.status === 'ready';
}

