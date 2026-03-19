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

// POST: Profilleri batch halinde rebuild et
// Query params: ?offset=0&batch=5 (varsayılan: offset=0, batch=5)
// Vercel 60s timeout'u aşmamak için parçalı çalışır
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offset = parseInt(searchParams.get('offset') || '0')
    const batch = parseInt(searchParams.get('batch') || '5')

    const startTime = Date.now()
    const result = await rebuildAllProfiles(offset, batch)
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: result.done
        ? `Tamamlandı! ${result.processed} sürücü işlendi (toplam ${result.total})`
        : `Batch ${offset}-${offset + batch}: ${result.processed} sürücü işlendi. Devam için offset=${offset + batch} kullanın.`,
      processed: result.processed,
      total: result.total,
      done: result.done,
      nextOffset: result.done ? null : offset + batch,
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
