import { NextRequest, NextResponse } from 'next/server'
import {
  rebuildAllProfiles,
  getAllDriverProfiles,
  getProfilesLastUpdated,
} from '@/lib/driver-profiles'

// GET: Tüm profilleri getir
export async function GET() {
  try {
    const profiles = await getAllDriverProfiles()
    const lastUpdated = await getProfilesLastUpdated()

    const profileList = Array.from(profiles.values())
      .sort((a, b) => b.stats.totalOrders - a.stats.totalOrders)
      .map(p => ({
        name: p.name,
        totalOrders: p.stats.totalOrders,
        ordersPerDay: p.stats.ordersPerDay,
        locationCount: p.locations.length,
        bestDays: p.stats.bestDays,
        groupRate: p.stats.groupRate,
        updatedAt: p.updatedAt
      }))

    return NextResponse.json({
      success: true,
      profiles: profileList,
      totalDrivers: profileList.length,
      lastUpdated
    })
  } catch (error) {
    console.error('Driver profiles GET error:', error)
    return NextResponse.json({ error: 'Profiller yüklenemedi' }, { status: 500 })
  }
}

// POST: Profilleri geçmiş veriden yeniden oluştur (geocoding ile)
export async function POST() {
  try {
    const startTime = Date.now()
    const count = await rebuildAllProfiles()
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: `${count} sürücü profili yeniden oluşturuldu (geocoding ile)`,
      totalDrivers: count,
      durationMs: duration
    })
  } catch (error) {
    console.error('Profile rebuild error:', error)
    return NextResponse.json(
      { error: 'Profil rebuild başarısız: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
