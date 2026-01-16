import { NextRequest, NextResponse } from 'next/server'
import { getImportData, getAvailableDates } from '@/lib/import-store'

// CORS headers - Base44'ten gelen isteklere izin ver
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

/**
 * GET /api/base44/assignments
 *
 * Base44'ün Canvas'tan atamaları çekmesi için endpoint.
 *
 * Query Parameters:
 * - date: YYYY-MM-DD formatında tarih (opsiyonel, varsayılan: en son import edilen tarih)
 * - status: Filtre (opsiyonel): "all" | "assigned" | "pending"
 *
 * Response:
 * {
 *   success: true,
 *   date: "2025-01-09",
 *   assignments: [
 *     {
 *       orderId: "abc123",
 *       orderNumber: "ORD-001",
 *       driverName: "Ahmet Yılmaz",
 *       driverId: "driver-1",
 *       groupId: "group-1",
 *       price: 150,
 *       groupPrice: 280,
 *       status: "ASSIGNED"
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // API Secret doğrulama
    if (!validateApiSecret(request)) {
      console.error('[ASSIGNMENTS] Unauthorized - Invalid API Secret')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Secret' },
        { status: 401, headers: corsHeaders }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const statusFilter = searchParams.get('status') || 'all'

    // Mevcut tarihleri al
    const availableDates = await getAvailableDates()

    if (availableDates.length === 0) {
      return NextResponse.json({
        success: true,
        date: null,
        assignments: [],
        message: 'Henüz import edilmiş veri yok'
      }, { headers: corsHeaders })
    }

    // Tarih belirleme
    const targetDate = dateParam || availableDates[0] // En son tarih

    // Veriyi getir
    const importData = await getImportData(targetDate)

    if (!importData) {
      return NextResponse.json({
        success: false,
        error: `${targetDate} tarihi için veri bulunamadı`,
        availableDates
      }, { status: 404, headers: corsHeaders })
    }

    // Grup sürücü haritası oluştur - gruptaki herhangi bir siparişte sürücü varsa, tüm gruba uygula
    const groupDriverMap: Record<string, string> = {}
    importData.orders.forEach(order => {
      if (order.groupId && order.driverName) {
        groupDriverMap[order.groupId] = order.driverName
      }
    })

    // Grup fiyat takibi - her grup için sadece BİR KEZ fiyat gönder
    const groupPriceUsed: Record<string, boolean> = {}

    // Atamaları hazırla - grup içindeki eksik sürücüleri tamamla
    let assignments = importData.orders.map(order => {
      // Eğer sipariş gruplu ve sürücüsü yoksa, gruptaki diğer siparişin sürücüsünü al
      let driverName = order.driverName || null
      if (!driverName && order.groupId && groupDriverMap[order.groupId]) {
        driverName = groupDriverMap[order.groupId]
        console.log(`[ASSIGNMENTS] Grup ${order.groupId} için eksik sürücü tamamlandı: ${driverName}`)
      }

      // Fiyat Mantığı:
      // - Tekil sipariş → order.price kullan
      // - Gruplu sipariş → SADECE İLK SİPARİŞTE groupPrice, diğerleri 0
      let effectivePrice = 0
      let isGroupPrimary = false  // Bu sipariş grup fiyatını taşıyor mu?

      if (order.groupId) {
        // Gruplu sipariş
        if (!groupPriceUsed[order.groupId]) {
          // Bu grup için henüz fiyat gönderilmedi - bu ilk sipariş
          effectivePrice = order.groupPrice || 0
          isGroupPrimary = true
          groupPriceUsed[order.groupId] = true
          console.log(`[PRICE] Grup ${order.groupId} fiyatı: $${effectivePrice} (ilk sipariş: ${order.orderNumber})`)
        } else {
          // Bu grup için zaten fiyat gönderildi - 0 gönder
          effectivePrice = 0
          isGroupPrimary = false
        }
      } else {
        // Tekil sipariş
        effectivePrice = order.price || 0
        isGroupPrimary = false  // Tekil siparişler için anlamsız
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        driverName,
        driverId: order.driverId || null,
        groupId: order.groupId || null,
        price: effectivePrice,  // Base44 için: TOPLAMA UYGUN fiyat (gruplu ise sadece ilk sipariş)
        groupPrice: order.groupPrice || 0,  // Bilgi amaçlı: grubun toplam fiyatı
        isGroupPrimary,  // true = bu sipariş grup fiyatını taşıyor (SMS'te kullan)
        offer: effectivePrice,  // Alternatif alan adı
        driverPayment: effectivePrice,  // Başka alternatif
        status: driverName ? 'ASSIGNED' : (order.status || 'PENDING'),
        // Ek bilgiler (Base44'ün ihtiyacı olabilir)
        pickupTime: order.pickupTime,
        dropoffTime: order.dropoffTime,
        pickupAddress: order.pickupAddress,
        dropoffAddress: order.dropoffAddress,
        timeSlot: order.timeSlot,
        // Yanıt bilgileri
        driverResponse: order.driverResponse || null,
        driverResponseTime: order.driverResponseTime || null,
        smsSent: order.smsSent || false,
        smsSentTime: order.smsSentTime || null
      }
    })

    // Status filtresi uygula
    if (statusFilter === 'assigned') {
      assignments = assignments.filter(a => a.driverName !== null)
    } else if (statusFilter === 'pending') {
      assignments = assignments.filter(a => a.driverName === null)
    }

    // İstatistikler
    const stats = {
      total: importData.orders.length,
      assigned: importData.orders.filter(o => o.driverName).length,
      pending: importData.orders.filter(o => !o.driverName).length,
      groups: [...new Set(importData.orders.filter(o => o.groupId).map(o => o.groupId))].length
    }

    console.log(`[ASSIGNMENTS] ${targetDate}: ${assignments.length} atama döndürüldü (filtre: ${statusFilter})`)

    return NextResponse.json({
      success: true,
      date: targetDate,
      timestamp: importData.timestamp,
      assignments,
      statistics: stats,
      availableDates
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('[ASSIGNMENTS] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Atamalar getirilirken hata oluştu',
      details: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500, headers: corsHeaders })
  }
}
