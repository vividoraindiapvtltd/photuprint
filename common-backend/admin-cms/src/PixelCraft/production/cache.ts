/**
 * Redis caching utilities for templates, renders, and thumbnails.
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface CacheOptions {
  ttlSeconds?: number;
}

/**
 * Get cached value by key.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value with TTL.
 */
export async function setCached(
  key: string,
  value: any,
  ttlSeconds: number = 3600
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
  }
}

/**
 * Delete cached value.
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
  }
}

/**
 * Invalidate all keys matching pattern.
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    const deleted = await redis.del(...keys);
    return deleted;
  } catch (error) {
    console.error(`Cache invalidate error for pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Cache key generators.
 */
export const cacheKeys = {
  template: (templateId: string, versionId: string) =>
    `template:${templateId}:version:${versionId}`,
  render: (templateVersionId: string, variableHash: string, areaId: string, dpi: number) =>
    `render:${templateVersionId}:${variableHash}:${areaId}:${dpi}`,
  thumbnail: (templateId: string, areaId: string) =>
    `thumbnail:${templateId}:${areaId}`,
};

/**
 * Hash variable values for cache key.
 */
import crypto from 'crypto';

export function hashVariableValues(values: Record<string, string>): string {
  const sorted = Object.keys(values)
    .sort()
    .map((k) => `${k}:${values[k]}`)
    .join('|');
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}
