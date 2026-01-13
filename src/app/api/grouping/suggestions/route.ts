import { NextRequest, NextResponse } from 'next/server'
import { getImportData, getLatestDate, ImportedOrder } from '@/lib/import-store'
import {
  calculateGroupingScore,
  getGroupingSuggestions,
  getTopPairsForZip,
  THRESHOLDS,
  OrderForScoring
} from '@/lib/grouping-history'
import {
  extractZipFromAddress,
  getClusterForZip,
  isHighValueHub,
  getClusterGroupRate
} from '@/lib/region-clusters'

// GET - Gruplama önerileri getir
// Query params:
//   - date: Tarih (opsiyonel, default: latest)
//   - orderId: Belirli sipariş için öneriler (opsiyonel)
//   - zip: Belirli ZIP için tarihsel eşleşmeler (opsiyonel)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const orderId = searchParams.get('orderId')
    const zip = searchParams.get('zip')

    // Belirli ZIP için tarihsel eşleşmeleri getir
    if (zip) {
      const topPairs = await getTopPairsForZip(zip)
      const cluster = getClusterForZip(zip)

      return NextResponse.json({
        zip,
        cluster: cluster ? {
          id: cluster.id,
          name: cluster.name,
          region: cluster.region,
          groupRate: cluster.groupRate
        } : null,
        historicalPairs: topPairs.map(p => ({
          zip: p.zip,
          count: p.data.count,
          avgTimeDiff: Math.round(p.data.avgTimeDiff),
          lastSeen: p.data.lastSeen
        }))
      })
    }

    // Tarih belirle
    const targetDate = dateParam || await getLatestDate()
    if (!targetDate) {
      return NextResponse.json({ error: 'Veri bulunamadı' }, { status: 404 })
    }

    // Canvas verisini al
    const importData = await getImportData(targetDate)
    if (!importData || !importData.orders || importData.orders.length === 0) {
      return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
    }

    const orders = importData.orders

    // Belirli sipariş için öneriler
    if (orderId) {
      const targetOrder = orders.find(o => o.id === orderId)
      if (!targetOrder) {
        return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
      }

      // Henüz gruplanmamış siparişleri filtrele
      const ungroupedOrders = orders.filter(o =>
        o.id !== orderId &&
        (!o.groupId || o.groupId === targetOrder.groupId)
      )

      const suggestions = await getSuggestionsForOrder(targetOrder, ungroupedOrders)

      return NextResponse.json({
        orderId,
        orderInfo: {
          orderNumber: targetOrder.orderNumber,
          pickupAddress: targetOrder.pickupAddress,
          dropoffAddress: targetOrder.dropoffAddress,
          pickupTime: targetOrder.pickupTime,
          cluster: getOrderClusterInfo(targetOrder),
          hubInfo: isHighValueHub(targetOrder.pickupAddress)
        },
        suggestions: suggestions.slice(0, 10)
      })
    }

    // Tüm siparişler için önerileri hesapla
    const allSuggestions = await getAllSuggestions(orders)

    return NextResponse.json({
      date: targetDate,
      totalOrders: orders.length,
      suggestions: allSuggestions
    })
  } catch (error) {
    console.error('Grouping suggestions error:', error)
    return NextResponse.json(
      { error: 'Öneriler alınırken hata oluştu', details: String(error) },
      { status: 500 }
    )
  }
}

// Belirli sipariş için öneriler hesapla
async function getSuggestionsForOrder(
  targetOrder: ImportedOrder,
  candidateOrders: ImportedOrder[]
): Promise<{
  orderId: string
  orderNumber: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  pickupAddress: string
  dropoffAddress: string
  pickupTime: string
}[]> {
  const suggestions: Awaited<ReturnType<typeof getSuggestionsForOrder>> = []

  const targetForScoring: OrderForScoring = {
    id: targetOrder.id,
    pickupAddress: targetOrder.pickupAddress,
    dropoffAddress: targetOrder.dropoffAddress,
    pickupTime: targetOrder.pickupTime,
    dropoffTime: targetOrder.dropoffTime
  }

  for (const candidate of candidateOrders) {
    const candidateForScoring: OrderForScoring = {
      id: candidate.id,
      pickupAddress: candidate.pickupAddress,
      dropoffAddress: candidate.dropoffAddress,
      pickupTime: candidate.pickupTime,
      dropoffTime: candidate.dropoffTime
    }

    const { score, reasons } = await calculateGroupingScore(targetForScoring, candidateForScoring)

    if (score >= THRESHOLDS.MIN_SCORE_TO_SUGGEST) {
      suggestions.push({
        orderId: candidate.id,
        orderNumber: candidate.orderNumber,
        score,
        confidence: score >= THRESHOLDS.HIGH_CONFIDENCE ? 'high' :
                   score >= THRESHOLDS.MIN_SCORE_TO_SUGGEST + 20 ? 'medium' : 'low',
        reasons,
        pickupAddress: candidate.pickupAddress,
        dropoffAddress: candidate.dropoffAddress,
        pickupTime: candidate.pickupTime
      })
    }
  }

  // Skora göre sırala
  return suggestions.sort((a, b) => b.score - a.score)
}

// Tüm siparişler için önerileri hesapla
async function getAllSuggestions(orders: ImportedOrder[]): Promise<{
  orderId: string
  orderNumber: string
  cluster: string | null
  groupRate: number
  topSuggestions: {
    orderId: string
    orderNumber: string
    score: number
    confidence: string
  }[]
}[]> {
  const results: Awaited<ReturnType<typeof getAllSuggestions>> = []

  // Henüz gruplanmamış siparişleri al
  const ungroupedOrders = orders.filter(o => !o.groupId)

  for (const order of ungroupedOrders) {
    const otherOrders = ungroupedOrders.filter(o => o.id !== order.id)
    const suggestions = await getSuggestionsForOrder(order, otherOrders)

    const dropoffZip = extractZipFromAddress(order.dropoffAddress)
    const cluster = dropoffZip ? getClusterForZip(dropoffZip) : null

    results.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      cluster: cluster?.name || null,
      groupRate: dropoffZip ? getClusterGroupRate(dropoffZip) : 0.5,
      topSuggestions: suggestions.slice(0, 3).map(s => ({
        orderId: s.orderId,
        orderNumber: s.orderNumber,
        score: s.score,
        confidence: s.confidence
      }))
    })
  }

  // Öneri sayısına ve grup oranına göre sırala
  return results.sort((a, b) => {
    // Önce öneri sayısına göre
    if (b.topSuggestions.length !== a.topSuggestions.length) {
      return b.topSuggestions.length - a.topSuggestions.length
    }
    // Sonra en yüksek skora göre
    const aMaxScore = a.topSuggestions[0]?.score || 0
    const bMaxScore = b.topSuggestions[0]?.score || 0
    return bMaxScore - aMaxScore
  })
}

// Sipariş cluster bilgisi
function getOrderClusterInfo(order: ImportedOrder): {
  dropoffCluster: string | null
  dropoffRegion: string | null
  pickupCluster: string | null
  pickupRegion: string | null
} | null {
  const dropoffZip = extractZipFromAddress(order.dropoffAddress)
  const pickupZip = extractZipFromAddress(order.pickupAddress)

  const dropoffCluster = dropoffZip ? getClusterForZip(dropoffZip) : null
  const pickupCluster = pickupZip ? getClusterForZip(pickupZip) : null

  return {
    dropoffCluster: dropoffCluster?.name || null,
    dropoffRegion: dropoffCluster?.region || null,
    pickupCluster: pickupCluster?.name || null,
    pickupRegion: pickupCluster?.region || null
  }
}
