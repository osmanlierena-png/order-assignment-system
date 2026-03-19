import { NextRequest, NextResponse } from 'next/server'
import { learnFromAssignment, learnFromRejection } from '@/lib/driver-profiles'

// POST: Bir atamadan veya redden öğren — sürücü profilini canlı güncelle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driverName, pickupAddress, dropoffAddress, date, timeSlot, rejected } = body

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

    const actualDate = date || new Date().toISOString().split('T')[0]
    const actualTimeSlot = timeSlot || 'oglen'

    if (rejected) {
      // Red'den öğren — negatif sinyal
      const profile = await learnFromRejection(
        driverName,
        pickupAddress,
        dropoffAddress || '',
        actualDate,
        actualTimeSlot
      )

      return NextResponse.json({
        success: true,
        type: 'rejection',
        driverName: profile.name,
        rejectionCount: profile.rejections?.length || 0,
        totalOrders: profile.stats.totalOrders
      })
    }

    // Normal atamadan öğren
    const profile = await learnFromAssignment(
      driverName,
      pickupAddress,
      dropoffAddress || '',
      actualDate,
      actualTimeSlot
    )

    return NextResponse.json({
      success: true,
      type: 'assignment',
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
