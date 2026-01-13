import { NextRequest, NextResponse } from 'next/server'
import { getImportData, getLatestDate } from '@/lib/import-store'
import { learnFromGrouping, GroupToLearn, saveDailyStats, DailyStats, getLearningMeta } from '@/lib/grouping-history'

// POST - Canvas'taki mevcut gruplamayı kaydet ve öğren
// Body: { date?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const dateParam = body.date

    // Tarih belirle
    const targetDate = dateParam || await getLatestDate()
    if (!targetDate) {
      return NextResponse.json(
        { error: 'Kayıtlı veri bulunamadı' },
        { status: 404 }
      )
    }

    // Canvas verisini al
    const importData = await getImportData(targetDate)
    if (!importData || !importData.orders || importData.orders.length === 0) {
      return NextResponse.json(
        { error: 'Bu tarih için sipariş bulunamadı' },
        { status: 404 }
      )
    }

    const orders = importData.orders

    // Siparişleri gruplara ayır (groupId'ye göre)
    const groupsMap = new Map<string, typeof orders>()
    let soloCount = 0

    for (const order of orders) {
      const groupKey = order.groupId || `solo-${order.id}`

      if (!order.groupId) {
        soloCount++
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, [])
      }
      groupsMap.get(groupKey)!.push(order)
    }

    // Grupları öğrenme formatına dönüştür
    const groupsToLearn: GroupToLearn[] = []
    const groupSizeDistribution: { [size: string]: number } = {}

    for (const [groupId, groupOrders] of groupsMap.entries()) {
      const size = groupOrders.length
      groupSizeDistribution[size.toString()] = (groupSizeDistribution[size.toString()] || 0) + 1

      // Solo siparişleri atla (groupId olmayan)
      if (groupId.startsWith('solo-') || size < 2) continue

      groupsToLearn.push({
        orderIds: groupOrders.map(o => o.id),
        orders: groupOrders.map(o => ({
          id: o.id,
          pickupAddress: o.pickupAddress,
          dropoffAddress: o.dropoffAddress,
          pickupTime: o.pickupTime,
          dropoffTime: o.dropoffTime
        }))
      })
    }

    // Öğrenme işlemi
    const result = await learnFromGrouping(groupsToLearn, targetDate)

    // Günlük istatistikleri kaydet
    const multiOrderGroups = Array.from(groupsMap.values()).filter(g => g.length >= 2)
    const dailyStats: DailyStats = {
      date: targetDate,
      totalOrders: orders.length,
      totalGroups: groupsMap.size,
      soloOrders: soloCount,
      avgGroupSize: orders.length / groupsMap.size,
      groupSizeDistribution
    }
    await saveDailyStats(dailyStats)

    // Öğrenme meta verisini al
    const meta = await getLearningMeta()

    return NextResponse.json({
      success: true,
      message: 'Gruplama başarıyla kaydedildi ve öğrenildi',
      saved: {
        date: targetDate,
        totalOrders: orders.length,
        totalGroups: groupsMap.size,
        groupsWithMultipleOrders: multiOrderGroups.length,
        soloOrders: soloCount,
        pairsLearned: result.pairsLearned,
        routesLearned: result.routesLearned
      },
      learningStats: meta ? {
        totalGroupsLearned: meta.totalGroupsLearned,
        totalPairsLearned: meta.totalPairsLearned,
        lastLearnDate: meta.lastLearnDate
      } : null
    })
  } catch (error) {
    console.error('Grouping save error:', error)
    return NextResponse.json(
      { error: 'Kaydetme işlemi sırasında hata oluştu', details: String(error) },
      { status: 500 }
    )
  }
}

// GET - Öğrenme istatistiklerini getir
export async function GET() {
  try {
    const meta = await getLearningMeta()

    if (!meta) {
      return NextResponse.json({
        hasLearningData: false,
        message: 'Henüz öğrenme verisi yok. Gruplamayı Kaydet butonunu kullanın.'
      })
    }

    return NextResponse.json({
      hasLearningData: true,
      stats: {
        totalGroupsLearned: meta.totalGroupsLearned,
        totalPairsLearned: meta.totalPairsLearned,
        lastLearnDate: meta.lastLearnDate,
        recentHistory: meta.learnHistory.slice(-10)
      }
    })
  } catch (error) {
    console.error('Grouping stats error:', error)
    return NextResponse.json(
      { error: 'İstatistikler alınırken hata oluştu' },
      { status: 500 }
    )
  }
}
