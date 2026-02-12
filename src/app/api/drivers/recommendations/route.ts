import { NextRequest, NextResponse } from 'next/server'
import { getImportData, getAvailableDates } from '@/lib/import-store'

interface DriverStats {
  driverName: string
  totalOrders: number
  acceptedCount: number
  rejectedCount: number
  zipCounts: Record<string, number>
  regionCounts: Record<string, number>
  timeSlotCounts: Record<string, number>
}

interface Recommendation {
  driverName: string
  score: number
  regionExperience: number
  acceptRate: number
  reasons: string[]
}

// ZIP kodundan bölge çıkar
function getRegionFromAddress(address: string): string | null {
  if (address.includes(', DC ')) return 'DC'
  if (address.includes(', VA ')) return 'VA'
  if (address.includes(', MD ')) return 'MD'
  return null
}

// ZIP kodu çıkar
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

// Tüm geçmiş veriden sürücü istatistiklerini hesapla
async function calculateDriverStats(): Promise<Map<string, DriverStats>> {
  const stats = new Map<string, DriverStats>()

  try {
    const dates = await getAvailableDates()

    for (const date of dates) {
      const data = await getImportData(date)
      if (!data || !data.orders) continue

      for (const order of data.orders) {
        if (!order.driverName) continue

        let driverStats = stats.get(order.driverName)
        if (!driverStats) {
          driverStats = {
            driverName: order.driverName,
            totalOrders: 0,
            acceptedCount: 0,
            rejectedCount: 0,
            zipCounts: {},
            regionCounts: {},
            timeSlotCounts: {}
          }
          stats.set(order.driverName, driverStats)
        }

        driverStats.totalOrders++

        // Kabul/Red
        if (order.driverResponse === 'ACCEPTED') {
          driverStats.acceptedCount++
        } else if (order.driverResponse === 'REJECTED') {
          driverStats.rejectedCount++
        }

        // ZIP
        const zip = extractZip(order.pickupAddress)
        if (zip) {
          driverStats.zipCounts[zip] = (driverStats.zipCounts[zip] || 0) + 1
        }

        // Bölge
        const region = getRegionFromAddress(order.pickupAddress)
        if (region) {
          driverStats.regionCounts[region] = (driverStats.regionCounts[region] || 0) + 1
        }

        // Zaman dilimi
        if (order.timeSlot) {
          driverStats.timeSlotCounts[order.timeSlot] = (driverStats.timeSlotCounts[order.timeSlot] || 0) + 1
        }
      }
    }
  } catch (error) {
    console.error('Error calculating driver stats:', error)
  }

  return stats
}

// Öneri hesapla
function calculateRecommendations(
  stats: Map<string, DriverStats>,
  targetZip: string,
  targetTimeSlot?: string,
  limit: number = 5
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // ZIP'ten bölge belirle
  let targetRegion = 'DC'
  if (targetZip.startsWith('22') || targetZip.startsWith('201')) {
    targetRegion = 'VA'
  } else if (targetZip.startsWith('20') && !targetZip.startsWith('200')) {
    targetRegion = 'MD'
  }

  for (const [_, driverStats] of stats) {
    let score = 0
    const reasons: string[] = []

    // 1. Bölge tecrübesi (max 40 puan)
    const zipCount = driverStats.zipCounts[targetZip] || 0
    const regionCount = driverStats.regionCounts[targetRegion] || 0

    if (zipCount > 0) {
      const zipScore = Math.min(40, zipCount * 8)
      score += zipScore
      reasons.push(`${targetZip}'de ${zipCount} sipariş`)
    } else if (regionCount > 0) {
      const regionScore = Math.min(25, regionCount * 2)
      score += regionScore
      reasons.push(`${targetRegion} bölgesinde ${regionCount} sipariş`)
    }

    // 2. Kabul oranı (max 25 puan)
    const responded = driverStats.acceptedCount + driverStats.rejectedCount
    let acceptRate = 0
    if (responded > 0) {
      acceptRate = driverStats.acceptedCount / responded
      score += acceptRate * 25
      if (acceptRate >= 0.8) {
        reasons.push(`%${Math.round(acceptRate * 100)} kabul`)
      }
    }

    // 3. Zaman dilimi uyumu (max 20 puan)
    if (targetTimeSlot && driverStats.timeSlotCounts[targetTimeSlot]) {
      const slotCount = driverStats.timeSlotCounts[targetTimeSlot]
      const slotScore = Math.min(20, slotCount * 3)
      score += slotScore
    }

    // 4. Genel tecrübe (max 15 puan)
    score += Math.min(15, driverStats.totalOrders * 0.5)

    // Minimum skor eşiği
    if (score >= 30) {
      recommendations.push({
        driverName: driverStats.driverName,
        score: Math.round(score),
        regionExperience: zipCount || regionCount,
        acceptRate: Math.round(acceptRate * 100),
        reasons
      })
    }
  }

  // Puana göre sırala
  recommendations.sort((a, b) => b.score - a.score)

  return recommendations.slice(0, limit)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pickupZip = searchParams.get('pickupZip')
    const timeSlot = searchParams.get('timeSlot') || undefined
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!pickupZip) {
      return NextResponse.json(
        { error: 'pickupZip parametresi gerekli' },
        { status: 400 }
      )
    }

    // İstatistikleri hesapla
    const stats = await calculateDriverStats()

    // Önerileri hesapla
    const recommendations = calculateRecommendations(stats, pickupZip, timeSlot, limit)

    return NextResponse.json({
      success: true,
      pickupZip,
      timeSlot,
      recommendations,
      totalDriversAnalyzed: stats.size
    })
  } catch (error) {
    console.error('Recommendations API error:', error)
    return NextResponse.json(
      { error: 'Öneriler hesaplanamadı' },
      { status: 500 }
    )
  }
}
