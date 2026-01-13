import { NextRequest, NextResponse } from 'next/server'
import {
  getCachedDistance,
  setCachedDistance,
  getCachedDistanceByAddress,
  setCachedDistanceByAddress,
  CachedDistance,
  Coordinate
} from '@/lib/distance-cache'
import { getZipDistance, haversineDistance } from '@/lib/distance'

// Google Maps Distance Matrix API URL
const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'

// Metre → Mile dönüşüm
const METERS_TO_MILES = 0.000621371

function metersToMiles(meters: number): number {
  return Math.round(meters * METERS_TO_MILES * 10) / 10 // 1 ondalık
}

function formatMiles(meters: number): string {
  const miles = metersToMiles(meters)
  return `${miles} mi`
}

// Adres string'inden ZIP kodunu çıkar
function extractZipFromAddress(address: string): string | null {
  // Amerikan ZIP kodu paterni: 5 rakam veya 5+4 format (12345 veya 12345-6789)
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/)
  return zipMatch ? zipMatch[1] : null
}

// Google Maps API'den mesafe hesapla
async function fetchGoogleDistance(
  origin: string | Coordinate,
  destination: string | Coordinate
): Promise<{ success: boolean; data?: Omit<CachedDistance, 'timestamp'>; error?: string }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('[DISTANCE API] Google Maps API key not configured')
    return { success: false, error: 'Google Maps API key not configured' }
  }

  try {
    // Origin ve destination formatla
    const originStr = typeof origin === 'string'
      ? origin
      : `${origin.lat},${origin.lng}`

    const destStr = typeof destination === 'string'
      ? destination
      : `${destination.lat},${destination.lng}`

    const url = new URL(GOOGLE_MAPS_API_URL)
    url.searchParams.set('origins', originStr)
    url.searchParams.set('destinations', destStr)
    url.searchParams.set('mode', 'driving')
    url.searchParams.set('language', 'tr') // Türkçe yanıt
    url.searchParams.set('key', apiKey)

    console.log(`[DISTANCE API] Google Maps request: ${originStr} -> ${destStr}`)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('[DISTANCE API] Google Maps API error:', data.status, data.error_message)
      return { success: false, error: `Google API error: ${data.status}` }
    }

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') {
      console.error('[DISTANCE API] Route not found:', element?.status)
      return { success: false, error: 'Route not found' }
    }

    return {
      success: true,
      data: {
        durationSeconds: element.duration.value,
        durationText: element.duration.text,
        distanceMeters: element.distance.value,
        distanceText: formatMiles(element.distance.value), // Mile olarak göster
        distanceMiles: metersToMiles(element.distance.value),
        source: 'google'
      }
    }
  } catch (error) {
    console.error('[DISTANCE API] Google Maps fetch error:', error)
    return { success: false, error: 'Fetch error' }
  }
}

// POST - Mesafe hesapla
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      origin,           // { lat, lng } veya undefined
      destination,      // { lat, lng } veya undefined
      originAddress,    // string adres
      destinationAddress // string adres
    } = body

    // Koordinat bazlı cache kontrolü
    if (origin?.lat && origin?.lng && destination?.lat && destination?.lng) {
      // 1. Cache'te var mı?
      const cached = await getCachedDistance(origin, destination)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          cached: true
        })
      }

      // 2. Google Maps API dene
      const googleResult = await fetchGoogleDistance(origin, destination)
      if (googleResult.success && googleResult.data) {
        // Cache'e kaydet
        await setCachedDistance(origin, destination, googleResult.data)
        return NextResponse.json({
          success: true,
          data: {
            ...googleResult.data,
            timestamp: new Date().toISOString()
          },
          cached: false
        })
      }
    }

    // Adres bazlı hesaplama
    if (originAddress && destinationAddress) {
      // 1. Adres cache kontrolü
      const cachedByAddress = await getCachedDistanceByAddress(originAddress, destinationAddress)
      if (cachedByAddress) {
        return NextResponse.json({
          success: true,
          data: cachedByAddress,
          cached: true
        })
      }

      // 2. Google Maps API dene (adres ile)
      const googleResult = await fetchGoogleDistance(originAddress, destinationAddress)
      if (googleResult.success && googleResult.data) {
        // Adres bazlı cache'e kaydet
        await setCachedDistanceByAddress(originAddress, destinationAddress, googleResult.data)
        return NextResponse.json({
          success: true,
          data: {
            ...googleResult.data,
            timestamp: new Date().toISOString()
          },
          cached: false
        })
      }

      // 3. ZIP kodu fallback
      const originZip = extractZipFromAddress(originAddress)
      const destZip = extractZipFromAddress(destinationAddress)

      if (originZip && destZip) {
        const zipResult = getZipDistance(originZip, destZip)
        if (zipResult) {
          const distanceMeters = zipResult.distanceKm * 1000
          const data: CachedDistance = {
            durationSeconds: zipResult.drivingMinutes * 60,
            durationText: `~${zipResult.drivingMinutes} dk`,
            distanceMeters: distanceMeters,
            distanceText: formatMiles(distanceMeters), // Mile olarak göster
            distanceMiles: metersToMiles(distanceMeters),
            source: 'zip-estimate',
            timestamp: new Date().toISOString()
          }

          return NextResponse.json({
            success: true,
            data,
            cached: false,
            note: `ZIP tahmini: ${zipResult.fromName} -> ${zipResult.toName}`
          })
        }
      }
    }

    // 4. Son çare: Haversine (koordinat varsa)
    if (origin?.lat && origin?.lng && destination?.lat && destination?.lng) {
      const distanceKm = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng)
      // Kaba tahmin: ortalama 2 dk/km
      const drivingMinutes = Math.max(5, Math.ceil(distanceKm * 2))
      const distanceMeters = distanceKm * 1000

      const data: CachedDistance = {
        durationSeconds: drivingMinutes * 60,
        durationText: `~${drivingMinutes} dk`,
        distanceMeters: distanceMeters,
        distanceText: formatMiles(distanceMeters), // Mile olarak göster
        distanceMiles: metersToMiles(distanceMeters),
        source: 'haversine',
        timestamp: new Date().toISOString()
      }

      return NextResponse.json({
        success: true,
        data,
        cached: false,
        note: 'Haversine tahmini (kuş uçuşu)'
      })
    }

    // Hiçbir şekilde hesaplanamadı
    return NextResponse.json(
      {
        success: false,
        error: 'Mesafe hesaplanamadı - yeterli veri yok'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[DISTANCE API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'API hatası'
      },
      { status: 500 }
    )
  }
}

// GET - Cache durumu kontrolü (debug için)
export async function GET() {
  const hasGoogleKey = !!process.env.GOOGLE_MAPS_API_KEY

  return NextResponse.json({
    success: true,
    config: {
      googleMapsConfigured: hasGoogleKey,
      fallbackMethods: ['zip-estimate', 'haversine']
    }
  })
}
