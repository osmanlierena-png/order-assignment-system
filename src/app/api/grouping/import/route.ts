import { NextRequest, NextResponse } from 'next/server'
import { learnFromGrouping, GroupToLearn, saveDailyStats, DailyStats } from '@/lib/grouping-history'
import { extractZipFromAddress } from '@/lib/region-clusters'

// POST - CSV verisinden öğren
// Body: { csvData: string, date: string } veya { orders: Order[], date: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { csvData, orders: rawOrders, date } = body

    let orders: {
      driver: string
      orderNumber: string
      customer?: string
      pickupTime: string
      pickupAddress: string
      dropoffTime: string
      dropoffAddress: string
    }[] = []

    // CSV verisini parse et
    if (csvData) {
      orders = parseCSV(csvData)
    } else if (rawOrders) {
      orders = rawOrders
    } else {
      return NextResponse.json(
        { error: 'CSV verisi veya sipariş listesi gerekli' },
        { status: 400 }
      )
    }

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Geçerli sipariş bulunamadı' },
        { status: 400 }
      )
    }

    // Siparişleri sürücüye göre grupla (aynı sürücü = aynı grup)
    const groupsByDriver = new Map<string, typeof orders>()

    for (const order of orders) {
      const driver = order.driver?.trim() || 'Unassigned'
      if (!groupsByDriver.has(driver)) {
        groupsByDriver.set(driver, [])
      }
      groupsByDriver.get(driver)!.push(order)
    }

    // Grupları öğrenme formatına dönüştür
    const groupsToLearn: GroupToLearn[] = []
    let soloCount = 0
    const groupSizeDistribution: { [size: string]: number } = {}

    for (const [driver, driverOrders] of groupsByDriver.entries()) {
      if (driver === 'Unassigned') continue

      const size = driverOrders.length
      groupSizeDistribution[size.toString()] = (groupSizeDistribution[size.toString()] || 0) + 1

      if (size === 1) {
        soloCount++
        continue
      }

      groupsToLearn.push({
        orderIds: driverOrders.map((o, i) => `${driver}-${i}`),
        orders: driverOrders.map((o, i) => ({
          id: `${driver}-${i}`,
          pickupAddress: o.pickupAddress,
          dropoffAddress: o.dropoffAddress,
          pickupTime: o.pickupTime,
          dropoffTime: o.dropoffTime
        }))
      })
    }

    // Öğrenme işlemi
    const result = await learnFromGrouping(groupsToLearn, date || new Date().toISOString().split('T')[0])

    // Günlük istatistikleri kaydet
    const dailyStats: DailyStats = {
      date: date || new Date().toISOString().split('T')[0],
      totalOrders: orders.length,
      totalGroups: groupsByDriver.size,
      soloOrders: soloCount,
      avgGroupSize: orders.length / groupsByDriver.size,
      groupSizeDistribution
    }
    await saveDailyStats(dailyStats)

    return NextResponse.json({
      success: true,
      imported: {
        totalOrders: orders.length,
        totalGroups: groupsByDriver.size,
        groupsWithMultipleOrders: groupsToLearn.length,
        soloOrders: soloCount,
        pairsLearned: result.pairsLearned,
        routesLearned: result.routesLearned
      },
      dailyStats
    })
  } catch (error) {
    console.error('Grouping import error:', error)
    return NextResponse.json(
      { error: 'Import işlemi sırasında hata oluştu', details: String(error) },
      { status: 500 }
    )
  }
}

// CSV parse fonksiyonu
function parseCSV(csvData: string): {
  driver: string
  orderNumber: string
  customer?: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
}[] {
  const lines = csvData.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

  // Header mapping
  const driverIdx = headers.findIndex(h => h.includes('sürücü') || h.includes('driver'))
  const orderIdx = headers.findIndex(h => h.includes('sipariş') || h.includes('order'))
  const customerIdx = headers.findIndex(h => h.includes('müşteri') || h.includes('customer'))
  const pickupTimeIdx = headers.findIndex(h => h.includes('pickup') && h.includes('saat'))
  const pickupAddrIdx = headers.findIndex(h => h.includes('pickup') && h.includes('adres'))
  const dropoffTimeIdx = headers.findIndex(h => h.includes('dropoff') && h.includes('saat'))
  const dropoffAddrIdx = headers.findIndex(h => h.includes('dropoff') && h.includes('adres'))

  const orders: ReturnType<typeof parseCSV> = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length < 6) continue

    orders.push({
      driver: values[driverIdx] || '',
      orderNumber: values[orderIdx] || `order-${i}`,
      customer: values[customerIdx] || undefined,
      pickupTime: values[pickupTimeIdx] || '',
      pickupAddress: values[pickupAddrIdx] || '',
      dropoffTime: values[dropoffTimeIdx] || '',
      dropoffAddress: values[dropoffAddrIdx] || ''
    })
  }

  return orders
}

// CSV satırını parse et (quoted değerleri handle et)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}
