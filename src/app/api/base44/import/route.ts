import { NextRequest, NextResponse } from 'next/server'
import { getTimeSlot, calculateLayeredMergeSuggestions, selectBestMerges, generateId } from '@/lib/utils'
import { setImportData, getImportData, getAvailableDates, getLatestDate, ImportedOrder, ImportedDriver } from '@/lib/import-store'

// CORS headers - Base44'ten gelen isteklere izin ver
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Secret',
}

// API Secret doğrulama - Server-to-server güvenliği
function validateApiSecret(request: NextRequest): boolean {
  const apiSecret = request.headers.get('X-API-Secret')
  const expectedSecret = process.env.CANVAS_API_SECRET

  // Secret tanımlı değilse, güvenlik devre dışı (development)
  if (!expectedSecret) {
    console.warn('[SECURITY] CANVAS_API_SECRET tanımlı değil - güvenlik devre dışı')
    return true
  }

  return apiSecret === expectedSecret
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

interface Base44Order {
  id: string
  orderNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  pickupLat?: number
  pickupLng?: number
  dropoffLat?: number
  dropoffLng?: number
  status?: string
  customerName?: string
  driverName?: string
  driverPhone?: string
}

interface Base44Driver {
  id: string
  name: string
  phone?: string
}

interface ImportRequest {
  date: string
  orders: Base44Order[]
  drivers: Base44Driver[]
}

/**
 * POST /api/base44/import
 *
 * Base44'ten gelen siparisleri ve suruculeri kabul eder.
 * Bu endpoint Base44'teki "Canvas'a Gonder" butonu tarafindan cagrilir.
 */
export async function POST(request: NextRequest) {
  try {
    // API Secret doğrulama
    if (!validateApiSecret(request)) {
      console.error('[BASE44 IMPORT] Unauthorized - Invalid API Secret')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Secret' },
        { status: 401, headers: corsHeaders }
      )
    }

    const body: ImportRequest = await request.json()
    const { date, orders, drivers } = body

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: 'Gecersiz veri formati: orders dizisi gerekli' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`[BASE44 IMPORT] ${orders.length} siparis ve ${drivers?.length || 0} surucu alindi`)

    // Siparis tarihini parse et
    const orderDate = date ? new Date(date) : new Date()

    // Her siparis icin timeSlot hesapla
    const processedOrders: ImportedOrder[] = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      pickupTime: order.pickupTime,
      pickupAddress: order.pickupAddress,
      dropoffTime: order.dropoffTime,
      dropoffAddress: order.dropoffAddress,
      pickupLat: order.pickupLat,
      pickupLng: order.pickupLng,
      dropoffLat: order.dropoffLat,
      dropoffLng: order.dropoffLng,
      status: order.status || 'PENDING',
      customerName: order.customerName,
      driverName: order.driverName,
      driverPhone: order.driverPhone,
      timeSlot: getTimeSlot(order.pickupTime),
      groupId: null
    }))

    // Sürücüleri işle (artık Base44'ten gelmeyebilir, drivers boş olabilir)
    const processedDrivers: ImportedDriver[] = (drivers || []).map(driver => ({
      id: driver.id,
      name: driver.name,
      phone: driver.phone
    }))

    // ==========================================
    // OTOMATİK GRUPLAMA
    // ==========================================
    console.log(`[BASE44 IMPORT] Otomatik gruplama başlıyor...`)

    // Gruplama için sipariş formatını hazırla
    const ordersForGrouping = processedOrders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      pickupTime: o.pickupTime,
      dropoffTime: o.dropoffTime,
      pickupAddress: o.pickupAddress,
      dropoffAddress: o.dropoffAddress,
      timeSlot: o.timeSlot || 'MORNING',
      groupId: null as string | null
    }))

    // Katmanlı birleştirme önerilerini hesapla
    const suggestions = calculateLayeredMergeSuggestions(ordersForGrouping)

    // En iyi birleştirmeleri seç (çakışma olmadan)
    const selectedMerges = selectBestMerges(suggestions)

    console.log(`[BASE44 IMPORT] Gruplama sonuçları:`)
    console.log(`  - TIGHT: ${suggestions.tight.length} öneri`)
    console.log(`  - NORMAL: ${suggestions.normal.length} öneri`)
    console.log(`  - LOOSE: ${suggestions.loose.length} öneri`)
    console.log(`  - Seçilen: ${selectedMerges.length} grup`)

    // Grupları siparişlere uygula
    let groupedOrderCount = 0
    for (const merge of selectedMerges) {
      const groupId = generateId()

      for (const orderId of merge.orderIds) {
        const order = processedOrders.find(o => o.id === orderId)
        if (order) {
          order.groupId = groupId
          groupedOrderCount++
        }
      }
    }

    console.log(`[BASE44 IMPORT] ${groupedOrderCount} sipariş ${selectedMerges.length} gruba atandı`)

    // Global store'a kaydet (artık async - Redis kullanıyor)
    await setImportData({
      orders: processedOrders,
      drivers: processedDrivers,
      date: orderDate.toISOString(),
      timestamp: new Date().toISOString()
    })

    console.log(`[BASE44 IMPORT] Tamamlandi: ${orders.length} siparis islendi, ${selectedMerges.length} grup olusturuldu`)

    return NextResponse.json({
      success: true,
      message: `Base44'ten import tamamlandi - ${selectedMerges.length} grup oluşturuldu`,
      statistics: {
        ordersReceived: orders.length,
        ordersProcessed: processedOrders.length,
        driversReceived: processedDrivers.length,
        groupsCreated: selectedMerges.length,
        groupedOrders: groupedOrderCount,
        ungroupedOrders: processedOrders.length - groupedOrderCount
      },
      groupingSummary: {
        tightSuggestions: suggestions.tight.length,
        normalSuggestions: suggestions.normal.length,
        looseSuggestions: suggestions.loose.length,
        selectedGroups: selectedMerges.length,
        groups: selectedMerges.map(m => ({
          orderNumbers: m.orderNumbers,
          layer: m.layer,
          score: m.score,
          avgBuffer: m.avgBuffer
        }))
      },
      date: orderDate.toISOString()
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Base44 import error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Base44 import sirasinda hata olustu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * GET /api/base44/import
 *
 * Son import durumunu ve verilerini dondurur.
 * ?date=YYYY-MM-DD ile belirli tarihin verisini getirir
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')

    // Mevcut tüm tarihleri al
    const availableDates = await getAvailableDates()
    const latestDate = await getLatestDate()

    // Belirli bir tarih istenmişse o tarihin verisini getir
    const targetDate = dateParam || latestDate
    const importData = targetDate ? await getImportData(targetDate) : null

    return NextResponse.json({
      success: true,
      status: 'ready',
      availableDates,
      latestDate,
      currentDate: targetDate,
      lastImport: importData ? {
        ordersCount: importData.orders.length,
        driversCount: importData.drivers.length,
        date: importData.date,
        dateKey: importData.dateKey,
        timestamp: importData.timestamp
      } : null,
      message: 'Base44 import endpoint hazir'
    }, { headers: corsHeaders })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Durum kontrol edilirken hata olustu'
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
