import { NextRequest, NextResponse } from 'next/server'
import {
  getDriverProfiles,
  recommendDrivers,
  getRegionFromZip
} from '@/lib/driver-profiles'

// V2: Profil tabanlı öneri sistemi
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pickupZip = searchParams.get('pickupZip')
    const dropoffZip = searchParams.get('dropoffZip') || null
    const timeSlot = searchParams.get('timeSlot') || 'oglen'
    const limit = parseInt(searchParams.get('limit') || '8')

    // Gün hesapla — query'den veya bugünden
    const dayParam = searchParams.get('day')
    const dayOfWeek = dayParam || getCurrentDayName()

    if (!pickupZip) {
      return NextResponse.json(
        { error: 'pickupZip parametresi gerekli' },
        { status: 400 }
      )
    }

    const profiles = await getDriverProfiles()
    const recommendations = recommendDrivers(
      profiles, pickupZip, dropoffZip, dayOfWeek, timeSlot, limit
    )

    // Eski format uyumluluğu için dönüştür
    const compatRecommendations = recommendations.map(r => ({
      driverName: r.driverName,
      score: r.score,
      regionExperience: r.regionScore,
      acceptRate: r.profile.acceptRate,
      reasons: r.reasons,
      // V2 ek bilgiler
      regionScore: r.regionScore,
      dayScore: r.dayScore,
      capacityScore: r.capacityScore,
      performanceScore: r.performanceScore,
      profile: {
        totalOrders: r.profile.totalOrders,
        ordersPerDay: r.profile.ordersPerDay,
        topRegions: r.profile.topRegions,
        bestDays: r.profile.bestDays,
        groupRate: r.profile.groupRate
      }
    }))

    return NextResponse.json({
      success: true,
      pickupZip,
      pickupRegion: getRegionFromZip(pickupZip),
      dayOfWeek,
      timeSlot,
      recommendations: compatRecommendations,
      totalDriversAnalyzed: profiles.size
    })
  } catch (error) {
    console.error('Recommendations API error:', error)
    return NextResponse.json(
      { error: 'Öneriler hesaplanamadı' },
      { status: 500 }
    )
  }
}

function getCurrentDayName(): string {
  const day = new Date().getDay()
  return ['Pazar','Pazartesi','Sali','Carsamba','Persembe','Cuma','Cumartesi'][day]
}
