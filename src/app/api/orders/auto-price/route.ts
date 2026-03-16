import { NextResponse } from 'next/server'
import { getImportData, setImportData } from '@/lib/import-store'
import { getDrivingTime } from '@/lib/distance-api'
import {
  calculateOrderPrice,
  calculatePricingStats,
  getDistanceMiles,
  PricingResult
} from '@/lib/auto-pricing'

export async function POST(request: Request) {
  try {
    const { date } = await request.json()

    if (!date) {
      return NextResponse.json({ error: 'Tarih gerekli' }, { status: 400 })
    }

    const data = await getImportData(date)
    if (!data || !data.orders || data.orders.length === 0) {
      return NextResponse.json({ error: 'Bu tarih için sipariş bulunamadı' }, { status: 404 })
    }

    const results: PricingResult[] = []
    let updatedCount = 0

    for (const order of data.orders) {
      // Google Maps API ile gerçek mesafe dene
      let distanceMiles: number | null = null
      let distanceSource: 'google' | 'zip' | 'fallback' = 'fallback'

      try {
        const drivingResult = await getDrivingTime(order.pickupAddress, order.dropoffAddress)

        if (drivingResult.source === 'google' || drivingResult.source === 'cache') {
          // km to miles
          distanceMiles = drivingResult.distanceKm * 0.621371
          distanceSource = 'google'
        } else if (drivingResult.source === 'zip-estimate') {
          distanceMiles = drivingResult.distanceKm * 0.621371
          distanceSource = 'zip'
        }
      } catch {
        // Google Maps başarısız, ZIP fallback dene
        distanceMiles = getDistanceMiles(order.pickupAddress, order.dropoffAddress)
        distanceSource = distanceMiles !== null ? 'zip' : 'fallback'
      }

      const result = calculateOrderPrice(
        distanceMiles,
        order.priceAmount || 0,
        order.pickupAddress,
        order.dropoffAddress
      )

      // Override distance source from actual API call
      result.distanceSource = distanceSource

      // Update order price
      order.price = result.price
      updatedCount++

      results.push(result)
    }

    // Save updated data
    await setImportData(data, date)

    // Calculate stats
    const stats = calculatePricingStats(results)
    stats.totalOrders = data.orders.length

    return NextResponse.json({
      success: true,
      message: `${updatedCount} sipariş fiyatlandı`,
      stats,
      details: results.map((r, i) => ({
        orderNumber: data.orders[i].orderNumber,
        price: r.price,
        reason: r.reason,
        distanceMiles: r.distanceMiles?.toFixed(1) || null,
        distanceSource: r.distanceSource,
        priceAmount: r.priceAmount
      }))
    })
  } catch (error) {
    console.error('[AUTO-PRICE] Hata:', error)
    return NextResponse.json(
      { error: 'Fiyatlama sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
