import { NextRequest, NextResponse } from 'next/server'
import {
  buildDriverProfiles,
  getDriverProfiles,
  getProfilesLastUpdated,
  recommendDrivers,
  getRegionFromZip
} from '@/lib/driver-profiles'

// GET: Profilleri getir veya öneri al
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'

    if (action === 'recommend') {
      // Öneri modu
      const pickupZip = searchParams.get('pickupZip')
      const dropoffZip = searchParams.get('dropoffZip')
      const dayOfWeek = searchParams.get('day') || getCurrentDayName()
      const timeSlot = searchParams.get('timeSlot') || 'oglen'
      const limit = parseInt(searchParams.get('limit') || '8')

      if (!pickupZip) {
        return NextResponse.json({ error: 'pickupZip gerekli' }, { status: 400 })
      }

      const profiles = await getDriverProfiles()
      const recommendations = recommendDrivers(
        profiles, pickupZip, dropoffZip, dayOfWeek, timeSlot, limit
      )

      return NextResponse.json({
        success: true,
        pickupZip,
        pickupRegion: getRegionFromZip(pickupZip),
        dayOfWeek,
        timeSlot,
        recommendations,
        totalDrivers: profiles.size
      })
    }

    // List modu - tüm profilleri getir
    const profiles = await getDriverProfiles()
    const lastUpdated = await getProfilesLastUpdated()

    const profileList = Array.from(profiles.values())
      .sort((a, b) => b.totalOrders - a.totalOrders)

    return NextResponse.json({
      success: true,
      profiles: profileList,
      totalDrivers: profileList.length,
      lastUpdated
    })

  } catch (error) {
    console.error('Driver profiles API error:', error)
    return NextResponse.json({ error: 'Profiller yüklenemedi' }, { status: 500 })
  }
}

// POST: Profilleri yeniden hesapla
export async function POST() {
  try {
    const startTime = Date.now()
    const profiles = await buildDriverProfiles()
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: `${profiles.size} sürücü profili güncellendi`,
      totalDrivers: profiles.size,
      durationMs: duration
    })
  } catch (error) {
    console.error('Profile rebuild error:', error)
    return NextResponse.json({ error: 'Profiller güncellenemedi' }, { status: 500 })
  }
}

function getCurrentDayName(): string {
  const day = new Date().getDay()
  return ['Pazar','Pazartesi','Sali','Carsamba','Persembe','Cuma','Cumartesi'][day]
}
