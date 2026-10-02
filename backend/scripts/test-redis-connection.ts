import '../src/platform/config/load-root-env.ts';
import { Redis } from 'ioredis';

async function main() {
  const url = process.env.REDIS_URL;
  console.log('Connecting to Redis URL:', url ? url.replace(/:[^:@]+@/, ':****@') : 'UNDEFINED');
  if (!url) {
    throw new Error('REDIS_URL is not set in environment!');
  }
  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
  });

  try {
    const pong = await redis.ping();
    console.log('✅ Redis Ping Result:', pong);

    await redis.set('DINO_FLASH_SALE_STATUS', 'CONNECTED_SUCCESSFULLY_100%');
    console.log('✅ Set key DINO_FLASH_SALE_STATUS successfully!');
    console.log('🚀 Redis connection is 100% WORKING and READY!');
  } catch (err: unknown) {
    console.error('❌ Redis Connection Failed:', err instanceof Error ? err.message : String(err));
  } finally {
    await redis.quit();
  }
}

main();
