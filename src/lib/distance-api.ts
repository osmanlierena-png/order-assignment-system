/**
 * Google Maps Distance Matrix API Entegrasyonu
 *
 * Bu modül gerçek sürüş sürelerini hesaplar ve gruplama algoritmasında kullanılır.
 * Cache sistemi ile API maliyetini minimize eder.
 */

import {
  getCachedDistanceByAddress,
  setCachedDistanceByAddress,
  CachedDistance
} from './distance-cache'
import { getZipDistance, ZIP_COORDINATES } from './distance'

// Sürüş sonucu tipi
export interface DrivingResult {
  durationMinutes: number      // Gerçek sürüş süresi (dakika)
  durationSeconds: number      // Gerçek sürüş süresi (saniye)
  distanceKm: number           // Mesafe (km)
  distanceMeters: number       // Mesafe (metre)
  cached: boolean              // Cache'den mi geldi?
  source: 'google' | 'cache' | 'zip-estimate' | 'haversine'
  durationText?: string        // "15 mins" gibi
  distanceText?: string        // "8.5 km" gibi
}

// Batch sorgu sonucu
export interface BatchDrivingResult {
  from: string
  to: string
  result: DrivingResult
}

// API yapılandırması
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const GOOGLE_MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'

// Rate limiting
const API_CALLS_PER_SECOND = 10
const API_DELAY_MS = 1000 / API_CALLS_PER_SECOND

// Son API çağrısı zamanı
let lastApiCallTime = 0

/**
 * API rate limiting için bekle
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastCall = now - lastApiCallTime

  if (timeSinceLastCall < API_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, API_DELAY_MS - timeSinceLastCall))
  }

  lastApiCallTime = Date.now()
}

/**
 * Google Maps API'den mesafe bilgisi al
 */
async function fetchFromGoogleMaps(
  origin: string,
  destination: string
): Promise<CachedDistance | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log('[DISTANCE API] Google Maps API key bulunamadı')
    return null
  }

  await waitForRateLimit()

  try {
    const params = new URLSearchParams({
      origins: origin,
      destinations: destination,
      key: GOOGLE_MAPS_API_KEY,
      mode: 'driving',
      language: 'tr',
      units: 'metric'
    })

    const response = await fetch(`${GOOGLE_MAPS_BASE_URL}?${params}`)

    if (!response.ok) {
      console.error('[DISTANCE API] Google Maps API hatası:', response.status)
      return null
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('[DISTANCE API] Google Maps API durumu:', data.status, data.error_message)
      return null
    }

    const element = data.rows?.[0]?.elements?.[0]

    if (!element || element.status !== 'OK') {
      console.error('[DISTANCE API] Element durumu:', element?.status)
      return null
    }

    return {
      durationSeconds: element.duration.value,
      durationText: element.duration.text,
      distanceMeters: element.distance.value,
      distanceText: element.distance.text,
      timestamp: new Date().toISOString(),
      source: 'google'
    }
  } catch (error) {
    console.error('[DISTANCE API] Google Maps API çağrısı başarısız:', error)
    return null
  }
}

/**
 * Adresten ZIP kodu çıkar
 */
function extractZipFromAddress(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

/**
 * ZIP tahmininden mesafe bilgisi oluştur
 */
function getZipEstimate(fromAddress: string, toAddress: string): CachedDistance | null {
  const fromZip = extractZipFromAddress(fromAddress)
  const toZip = extractZipFromAddress(toAddress)

  if (!fromZip || !toZip) {
    return null
  }

  const zipDistance = getZipDistance(fromZip, toZip)

  if (!zipDistance) {
    return null
  }

  return {
    durationSeconds: zipDistance.drivingMinutes * 60,
    durationText: `${zipDistance.drivingMinutes} dk (tahmini)`,
    distanceMeters: zipDistance.distanceKm * 1000,
    distanceText: `${zipDistance.distanceKm} km (tahmini)`,
    timestamp: new Date().toISOString(),
    source: 'zip-estimate'
  }
}

/**
 * Tek bir rota için sürüş süresi al (ana fonksiyon)
 *
 * Fallback zinciri:
 * 1. Cache kontrol
 * 2. Google Maps API
 * 3. ZIP tahmini
 */
export async function getDrivingTime(
  fromAddress: string,
  toAddress: string
): Promise<DrivingResult> {
  // 1. Cache kontrol
  const cached = await getCachedDistanceByAddress(fromAddress, toAddress)

  if (cached) {
    return {
      durationMinutes: Math.ceil(cached.durationSeconds / 60),
      durationSeconds: cached.durationSeconds,
      distanceKm: cached.distanceMeters / 1000,
      distanceMeters: cached.distanceMeters,
      cached: true,
      source: 'cache',
      durationText: cached.durationText,
      distanceText: cached.distanceText
    }
  }

  // 2. Google Maps API
  const googleResult = await fetchFromGoogleMaps(fromAddress, toAddress)

  if (googleResult) {
    // Cache'e kaydet
    await setCachedDistanceByAddress(fromAddress, toAddress, googleResult)

    return {
      durationMinutes: Math.ceil(googleResult.durationSeconds / 60),
      durationSeconds: googleResult.durationSeconds,
      distanceKm: googleResult.distanceMeters / 1000,
      distanceMeters: googleResult.distanceMeters,
      cached: false,
      source: 'google',
      durationText: googleResult.durationText,
      distanceText: googleResult.distanceText
    }
  }

  // 3. ZIP tahmini (fallback)
  const zipEstimate = getZipEstimate(fromAddress, toAddress)

  if (zipEstimate) {
    // ZIP tahminini de cache'le
    await setCachedDistanceByAddress(fromAddress, toAddress, zipEstimate)

    return {
      durationMinutes: Math.ceil(zipEstimate.durationSeconds / 60),
      durationSeconds: zipEstimate.durationSeconds,
      distanceKm: zipEstimate.distanceMeters / 1000,
      distanceMeters: zipEstimate.distanceMeters,
      cached: false,
      source: 'zip-estimate',
      durationText: zipEstimate.durationText,
      distanceText: zipEstimate.distanceText
    }
  }

  // Hiçbir yöntem çalışmadı - varsayılan değer döndür
  console.warn(`[DISTANCE API] Mesafe hesaplanamadı: ${fromAddress} → ${toAddress}`)
  return {
    durationMinutes: 30, // Varsayılan 30 dakika
    durationSeconds: 1800,
    distanceKm: 15,
    distanceMeters: 15000,
    cached: false,
    source: 'zip-estimate',
    durationText: '30 dk (varsayılan)',
    distanceText: '15 km (varsayılan)'
  }
}

/**
 * Batch sorgu - birden fazla rota için sürüş süresi al
 * Google Maps Distance Matrix API tek istekte 10x10 matris destekler
 */
export async function getBatchDrivingTimes(
  pairs: Array<{ from: string; to: string }>
): Promise<Map<string, DrivingResult>> {
  const results = new Map<string, DrivingResult>()
  const uncached: Array<{ from: string; to: string; key: string }> = []

  // 1. Önce cache'i kontrol et
  for (const pair of pairs) {
    const key = `${pair.from}|${pair.to}`
    const cached = await getCachedDistanceByAddress(pair.from, pair.to)

    if (cached) {
      results.set(key, {
        durationMinutes: Math.ceil(cached.durationSeconds / 60),
        durationSeconds: cached.durationSeconds,
        distanceKm: cached.distanceMeters / 1000,
        distanceMeters: cached.distanceMeters,
        cached: true,
        source: 'cache',
        durationText: cached.durationText,
        distanceText: cached.distanceText
      })
    } else {
      uncached.push({ ...pair, key })
    }
  }

  // Tüm sonuçlar cache'de
  if (uncached.length === 0) {
    return results
  }

  // 2. Google Maps API key yoksa ZIP tahmini kullan
  if (!GOOGLE_MAPS_API_KEY) {
    for (const pair of uncached) {
      const result = await getDrivingTime(pair.from, pair.to)
      results.set(pair.key, result)
    }
    return results
  }

  // 3. Google Maps batch sorgusu
  // Not: Distance Matrix API tek istekte birden fazla origin/destination destekler
  // Ama basitlik için şimdilik tek tek sorguluyoruz
  // İleride optimize edilebilir
  for (const pair of uncached) {
    const result = await getDrivingTime(pair.from, pair.to)
    results.set(pair.key, result)
  }

  return results
}

/**
 * Gruplama için birden fazla sipariş çiftinin sürüş sürelerini al
 * Sadece "potansiyel" çiftleri sorgular (buffer > 0 && buffer < maxBuffer)
 */
export async function getDrivingTimesForGrouping(
  orderPairs: Array<{
    order1DropoffAddress: string
    order2PickupAddress: string
    bufferMinutes: number
  }>,
  maxBufferMinutes: number = 120
): Promise<Map<string, DrivingResult>> {
  // Sadece mantıklı buffer'a sahip çiftleri sorgula
  const eligiblePairs = orderPairs.filter(
    pair => pair.bufferMinutes >= 0 && pair.bufferMinutes <= maxBufferMinutes
  )

  // Lazy loading: Buffer çok kısaysa (< 10dk) veya çok uzunsa (> 120dk) sorgulamaya gerek yok
  const pairs = eligiblePairs.map(pair => ({
    from: pair.order1DropoffAddress,
    to: pair.order2PickupAddress
  }))

  return getBatchDrivingTimes(pairs)
}

/**
 * API durumunu kontrol et
 */
export function isGoogleMapsApiConfigured(): boolean {
  return !!GOOGLE_MAPS_API_KEY
}

/**
 * API istatistikleri
 */
export function getApiStats(): {
  configured: boolean
  baseUrl: string
} {
  return {
    configured: isGoogleMapsApiConfigured(),
    baseUrl: GOOGLE_MAPS_BASE_URL
  }
}
