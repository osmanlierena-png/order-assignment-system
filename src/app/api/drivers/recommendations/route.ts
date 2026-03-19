import { NextRequest, NextResponse } from 'next/server'
import {
  getAllDriverProfiles,
  recommendDrivers,
} from '@/lib/driver-profiles'
import { geocodeAddress } from '@/lib/geocoding'

// V3: Adres bazlı + canlı öğrenme destekli öneri sistemi
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pickupAddress = searchParams.get('pickupAddress') || ''
    const dropoffAddress = searchParams.get('dropoffAddress') || ''
    const pickupZip = searchParams.get('pickupZip') || '' // eski uyumluluk
    const timeSlot = searchParams.get('timeSlot') || 'oglen'
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '8') || 8, 1), 20)
    const dayParam = searchParams.get('day')
    const dayOfWeek = dayParam || getCurrentDayName()

    // Adres veya ZIP'ten çalışabilir
    const addressToGeocode = pickupAddress || pickupZip
    if (!addressToGeocode) {
      return NextResponse.json(
        { error: 'pickupAddress veya pickupZip gerekli' },
        { status: 400 }
      )
    }

    // Geocode pickup
    const pickupGeo = await geocodeAddress(addressToGeocode)
    if (!pickupGeo) {
      return NextResponse.json(
        { error: 'Pickup adresi geocode edilemedi' },
        { status: 400 }
      )
    }

    // Geocode dropoff (opsiyonel)
    let dropoffGeo = null
    if (dropoffAddress) {
      dropoffGeo = await geocodeAddress(dropoffAddress)
    }

    // Profilleri al
    const profiles = await getAllDriverProfiles()

    if (profiles.size === 0) {
      return NextResponse.json({
        success: true,
        recommendations: [],
        message: 'Profiller henüz oluşturulmamış. POST /api/drivers/profiles çağrısı yapın.',
        totalDriversAnalyzed: 0
      })
    }

    // Öneriler
    const recommendations = recommendDrivers(
      profiles,
      pickupGeo,
      dropoffGeo,
      addressToGeocode,
      dropoffAddress || null,
      dayOfWeek,
      timeSlot,
      limit
    )

    return NextResponse.json({
      success: true,
      pickupAddress: addressToGeocode,
      dayOfWeek,
      timeSlot,
      recommendations,
      totalDriversAnalyzed: profiles.size
    })
  } catch (error) {
    console.error('Recommendations API error:', error)
    return NextResponse.json(
      { error: 'Öneriler hesaplanamadı: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

function getCurrentDayName(): string {
  const day = new Date().getDay()
  return ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'][day]
}
