import { Redis } from 'ioredis';

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      retryStrategy(times) {
        return Math.min(times * 100, 2000);
      },
    });

    redisInstance.on('connect', () => {
      console.log('[Redis] Connected to Redis cluster/instance successfully.');
    });

    redisInstance.on('error', (err) => {
      console.error('[Redis] Client error:', err.message);
    });
  }

  return redisInstance;
}

export async function closeRedisClient(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
