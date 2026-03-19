import { NextRequest, NextResponse } from 'next/server'
import { learnFromAssignment } from '@/lib/driver-profiles'

// POST: Bir atamadan öğren — sürücü profilini canlı güncelle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driverName, pickupAddress, dropoffAddress, date, timeSlot } = body

    if (!driverName || !pickupAddress) {
      return NextResponse.json(
        { error: 'driverName ve pickupAddress gerekli' },
        { status: 400 }
      )
    }

    // Input validation
    if (driverName.length > 100 || pickupAddress.length > 500) {
      return NextResponse.json(
        { error: 'Geçersiz input uzunluğu' },
        { status: 400 }
      )
    }

    const profile = await learnFromAssignment(
      driverName,
      pickupAddress,
      dropoffAddress || '',
      date || new Date().toISOString().split('T')[0],
      timeSlot || 'oglen'
    )

    return NextResponse.json({
      success: true,
      driverName: profile.name,
      locationCount: profile.locations.length,
      totalOrders: profile.stats.totalOrders
    })
  } catch (error) {
    console.error('Learn API error:', error)
    return NextResponse.json(
      { error: 'Öğrenme başarısız: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
