// Sürüş mesafesi cache modülü - Upstash Redis ile
// Google Maps API sonuçlarını cache'leyerek maliyeti düşürür

import { Redis } from '@upstash/redis'

// Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_TOKEN || '',
})

const CACHE_PREFIX = 'distance'
const CACHE_TTL = 60 * 60 * 24 * 7 // 7 gün

// Cache'lenmiş mesafe verisi
export interface CachedDistance {
  durationSeconds: number
  durationText: string
  distanceMeters: number
  distanceText: string
  timestamp: string
  source: 'google' | 'zip-estimate' | 'haversine'
}

// Koordinat tipi
export interface Coordinate {
  lat: number
  lng: number
}

// Redis bağlantısı var mı kontrol et
function isRedisConfigured(): boolean {
  const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  const hasStorage = !!(process.env.STORAGE_URL && process.env.STORAGE_TOKEN)
  return hasKV || hasUpstash || hasStorage
}

// In-memory fallback (development için)
const memoryCache: Map<string, CachedDistance> = new Map()

// Koordinatları 4 ondalık basamağa yuvarla (yaklaşık 11 metre hassasiyet)
// Bu, benzer noktalar için cache hit oranını artırır
function roundCoordinate(value: number): number {
  return Math.round(value * 10000) / 10000
}

// Cache key oluştur
function getCacheKey(origin: Coordinate, destination: Coordinate): string {
  const o = `${roundCoordinate(origin.lat)},${roundCoordinate(origin.lng)}`
  const d = `${roundCoordinate(destination.lat)},${roundCoordinate(destination.lng)}`
  return `${CACHE_PREFIX}:${o}|${d}`
}

// Adres bazlı cache key (koordinat yoksa kullanılır)
function getAddressCacheKey(originAddress: string, destinationAddress: string): string {
  // Adresleri normalize et (küçük harf, fazla boşlukları kaldır)
  const normalizeAddress = (addr: string) =>
    addr.toLowerCase().replace(/\s+/g, ' ').trim()

  const o = normalizeAddress(originAddress)
  const d = normalizeAddress(destinationAddress)
  return `${CACHE_PREFIX}:addr:${o}|${d}`
}

// Cache'ten mesafe getir (koordinat bazlı)
export async function getCachedDistance(
  origin: Coordinate,
  destination: Coordinate
): Promise<CachedDistance | null> {
  const key = getCacheKey(origin, destination)

  if (isRedisConfigured()) {
    try {
      const data = await redis.get<string>(key)
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        console.log(`[DISTANCE CACHE] HIT: ${key}`)
        return parsed as CachedDistance
      }
    } catch (error) {
      console.error('[DISTANCE CACHE] Redis okuma hatası:', error)
      return memoryCache.get(key) || null
    }
  }

  return memoryCache.get(key) || null
}

// Cache'ten mesafe getir (adres bazlı)
export async function getCachedDistanceByAddress(
  originAddress: string,
  destinationAddress: string
): Promise<CachedDistance | null> {
  const key = getAddressCacheKey(originAddress, destinationAddress)

  if (isRedisConfigured()) {
    try {
      const data = await redis.get<string>(key)
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        console.log(`[DISTANCE CACHE] HIT (address): ${key}`)
        return parsed as CachedDistance
      }
    } catch (error) {
      console.error('[DISTANCE CACHE] Redis okuma hatası:', error)
      return memoryCache.get(key) || null
    }
  }

  return memoryCache.get(key) || null
}

// Cache'e mesafe kaydet (koordinat bazlı)
export async function setCachedDistance(
  origin: Coordinate,
  destination: Coordinate,
  data: Omit<CachedDistance, 'timestamp'>
): Promise<void> {
  const key = getCacheKey(origin, destination)
  const dataWithTimestamp: CachedDistance = {
    ...data,
    timestamp: new Date().toISOString()
  }

  if (isRedisConfigured()) {
    try {
      await redis.set(key, JSON.stringify(dataWithTimestamp), { ex: CACHE_TTL })
      console.log(`[DISTANCE CACHE] SET: ${key}`)
    } catch (error) {
      console.error('[DISTANCE CACHE] Redis kayıt hatası:', error)
      memoryCache.set(key, dataWithTimestamp)
    }
  } else {
    memoryCache.set(key, dataWithTimestamp)
  }
}

// Cache'e mesafe kaydet (adres bazlı)
export async function setCachedDistanceByAddress(
  originAddress: string,
  destinationAddress: string,
  data: Omit<CachedDistance, 'timestamp'>
): Promise<void> {
  const key = getAddressCacheKey(originAddress, destinationAddress)
  const dataWithTimestamp: CachedDistance = {
    ...data,
    timestamp: new Date().toISOString()
  }

  if (isRedisConfigured()) {
    try {
      await redis.set(key, JSON.stringify(dataWithTimestamp), { ex: CACHE_TTL })
      console.log(`[DISTANCE CACHE] SET (address): ${key}`)
    } catch (error) {
      console.error('[DISTANCE CACHE] Redis kayıt hatası:', error)
      memoryCache.set(key, dataWithTimestamp)
    }
  } else {
    memoryCache.set(key, dataWithTimestamp)
  }
}

// Cache istatistiklerini getir (debug için)
export async function getCacheStats(): Promise<{
  configured: boolean
  memorySize: number
}> {
  return {
    configured: isRedisConfigured(),
    memorySize: memoryCache.size
  }
}
