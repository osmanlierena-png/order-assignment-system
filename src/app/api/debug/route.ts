import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export async function GET() {
  const debugInfo: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasKVUrl: !!process.env.KV_REST_API_URL,
      hasKVToken: !!process.env.KV_REST_API_TOKEN,
      hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      hasStorageUrl: !!process.env.STORAGE_URL,
      hasStorageToken: !!process.env.STORAGE_TOKEN,
      kvUrlPrefix: process.env.KV_REST_API_URL?.substring(0, 30) + '...',
    }
  }

  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_URL || '',
      token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_TOKEN || '',
    })

    // Test Redis connection
    const testKey = 'canvas:debug:test'
    await redis.set(testKey, 'working', { ex: 60 })
    const testValue = await redis.get(testKey)

    debugInfo.redis = {
      connected: true,
      testWrite: testValue === 'working',
    }

    // Check existing data
    const dates = await redis.smembers('canvas:import:dates')
    debugInfo.redis = {
      ...debugInfo.redis as object,
      availableDates: dates,
      datesCount: (dates as string[]).length,
    }

    // Check all keys with canvas prefix
    const allKeys = await redis.keys('canvas:*')
    debugInfo.redis = {
      ...debugInfo.redis as object,
      allCanvasKeys: allKeys,
    }

  } catch (error) {
    debugInfo.redis = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  return NextResponse.json(debugInfo)
}
