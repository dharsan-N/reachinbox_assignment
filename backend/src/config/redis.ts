import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from './env';

export let redisConnection: any;
export let redisRateLimiter: any;

const isTestingOrDevWithoutRedis = !process.env.DOCKER_ENV && !process.env.USE_LIVE_REDIS;

try {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 1) return null;
      return 200;
    },
  });

  client.on('error', () => {
    // Handled
  });

  redisConnection = client;
  redisRateLimiter = client;
} catch {
  redisConnection = new (RedisMock as any)();
  redisRateLimiter = redisConnection;
}
