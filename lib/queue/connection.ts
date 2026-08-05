import IORedis from "ioredis";

// Shared Redis connection for BullMQ. Module 4 builds queues/workers on top
// of this (see lib/sync/) — other modules should call `enqueueSyncJob` from
// lib/sync rather than using this connection directly.
const globalForRedis = globalThis as unknown as {
  redisConnection: IORedis | undefined;
};

export function getRedisConnection(): IORedis {
  if (!globalForRedis.redisConnection) {
    globalForRedis.redisConnection = new IORedis(
      process.env.REDIS_URL ?? "redis://localhost:6379",
      { maxRetriesPerRequest: null }, // required by BullMQ
    );
  }
  return globalForRedis.redisConnection;
}
