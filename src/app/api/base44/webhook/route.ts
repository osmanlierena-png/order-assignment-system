import { NextRequest, NextResponse } from 'next/server'
import { getImportData, setImportData } from '@/lib/import-store'

// CORS headers - Base44'ten gelen webhook istekleri için
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret, X-API-Secret',
}

// API Secret doğrulama - Server-to-server güvenliği (Webhook için iki seçenek)
function validateWebhookAuth(request: NextRequest): boolean {
  // Seçenek 1: X-Webhook-Secret header'ı (mevcut)
  const webhookSecret = request.headers.get('X-Webhook-Secret')
  if (process.env.WEBHOOK_SECRET && webhookSecret === process.env.WEBHOOK_SECRET) {
    return true
  }

  // Seçenek 2: X-API-Secret header'ı (yeni - diğer endpoint'lerle tutarlı)
  const apiSecret = request.headers.get('X-API-Secret')
  if (process.env.CANVAS_API_SECRET && apiSecret === process.env.CANVAS_API_SECRET) {
    return true
  }

  // Hiçbiri tanımlı değilse, güvenlik devre dışı (development)
  if (!process.env.WEBHOOK_SECRET && !process.env.CANVAS_API_SECRET) {
    console.warn('[SECURITY] WEBHOOK_SECRET ve CANVAS_API_SECRET tanımlı değil - güvenlik devre dışı')
    return true
  }

  return false
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// Sürücü yanıtı için payload
interface DriverResponsePayload {
  type: 'DRIVER_RESPONSE'
  orderId: string
  orderNumber: string
  driverResponse: 'Evet' | 'Hayır'  // Base44'ten gelen format
  driverName: string
  responseTime: string              // ISO timestamp
  date: string                      // Order date (YYYY-MM-DD veya ISO)
  groupId?: string                  // Grup varsa
}

// SMS gönderildi bildirimi için payload
interface SmsSentPayload {
  type: 'SMS_SENT'
  orderId: string
  orderNumber: string
  driverName: string
  sentTime: string                  // ISO timestamp
  date: string                      // Order date (YYYY-MM-DD veya ISO)
  groupId?: string                  // Grup varsa
}

type WebhookPayload = DriverResponsePayload | SmsSentPayload

/**
 * POST /api/base44/webhook
 *
 * Base44'ten bildirimler alır:
 * 1. SMS_SENT - Sürücüye SMS gönderildiğinde
 * 2. DRIVER_RESPONSE - Sürücü yanıt verdiğinde (Evet/Hayır)
 */
export async function POST(request: NextRequest) {
  try {
    // Güvenlik doğrulaması (X-Webhook-Secret veya X-API-Secret)
    if (!validateWebhookAuth(request)) {
      console.error('[WEBHOOK] Unauthorized request - invalid secret')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Secret' },
        { status: 401, headers: corsHeaders }
      )
    }

    const payload: WebhookPayload = await request.json()
    console.log('[WEBHOOK] Received:', JSON.stringify(payload, null, 2))

    // Redis'ten mevcut veriyi al
    const data = await getImportData(payload.date)
    if (!data) {
      console.error(`[WEBHOOK] Date not found in store: ${payload.date}`)
      return NextResponse.json(
        { error: `Order date not found: ${payload.date}` },
        { status: 404, headers: corsHeaders }
      )
    }

    // SMS_SENT - SMS gönderildi bildirimi
    if (payload.type === 'SMS_SENT') {
      const smsPayload = payload as SmsSentPayload

      if (!smsPayload.orderId || !smsPayload.date) {
        return NextResponse.json(
          { error: 'Missing required fields: orderId, date' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Siparişleri güncelle
      let updatedCount = 0

      if (smsPayload.groupId) {
        // Grup varsa tüm gruptaki siparişleri güncelle
        const groupOrders = data.orders.filter(o => o.groupId === smsPayload.groupId)
        groupOrders.forEach(order => {
          order.smsSent = true
          order.smsSentTime = smsPayload.sentTime || new Date().toISOString()
          order.status = 'ASSIGNED' // SMS gönderildi = Atandı
        })
        updatedCount = groupOrders.length
        console.log(`[WEBHOOK] SMS_SENT - Group ${smsPayload.groupId}: ${updatedCount} orders updated`)
      } else {
        // Tekil sipariş
        const order = data.orders.find(o => o.id === smsPayload.orderId)
        if (order) {
          order.smsSent = true
          order.smsSentTime = smsPayload.sentTime || new Date().toISOString()
          order.status = 'ASSIGNED'
          updatedCount = 1
        }
        console.log(`[WEBHOOK] SMS_SENT - Order ${smsPayload.orderNumber}: updated`)
      }

      // Redis'e kaydet
      await setImportData(data)

      return NextResponse.json({
        success: true,
        type: 'SMS_SENT',
        orderId: smsPayload.orderId,
        orderNumber: smsPayload.orderNumber,
        updatedCount,
        message: `SMS sent notification received for ${smsPayload.orderNumber}`
      }, { headers: corsHeaders })
    }

    // DRIVER_RESPONSE - Sürücü yanıtı
    if (payload.type === 'DRIVER_RESPONSE') {
      const responsePayload = payload as DriverResponsePayload

      if (!responsePayload.orderId || !responsePayload.driverResponse || !responsePayload.date) {
        return NextResponse.json(
          { error: 'Missing required fields: orderId, driverResponse, date' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Siparişi bul
      const orderIndex = data.orders.findIndex(o => o.id === responsePayload.orderId)
      if (orderIndex === -1) {
        console.error(`[WEBHOOK] Order not found: ${responsePayload.orderId}`)
        return NextResponse.json(
          { error: `Order not found: ${responsePayload.orderId}` },
          { status: 404, headers: corsHeaders }
        )
      }

      // Base44 formatını Canvas formatına çevir
      const canvasResponse = responsePayload.driverResponse === 'Evet' ? 'ACCEPTED' : 'REJECTED'

      // Yanıt bilgilerini güncelle
      data.orders[orderIndex].driverResponse = canvasResponse
      data.orders[orderIndex].driverResponseTime = responsePayload.responseTime || new Date().toISOString()

      // REJECTED durumunda driver bilgisini temizle (yeniden atama için)
      if (canvasResponse === 'REJECTED') {
        data.orders[orderIndex].driverName = undefined
        data.orders[orderIndex].smsSent = false // SMS durumunu sıfırla
        data.orders[orderIndex].status = 'PENDING'

        // Eğer grup varsa, gruptaki tüm siparişleri de güncelle ("Ya hepsi ya hiçbiri" kuralı)
        if (responsePayload.groupId) {
          const groupOrders = data.orders.filter(o => o.groupId === responsePayload.groupId)
          groupOrders.forEach(order => {
            order.driverResponse = canvasResponse
            order.driverResponseTime = responsePayload.responseTime || new Date().toISOString()
            order.driverName = undefined
            order.smsSent = false
            order.status = 'PENDING'
          })
          console.log(`[WEBHOOK] Group ${responsePayload.groupId} rejected - ${groupOrders.length} orders updated`)
        }
      } else {
        data.orders[orderIndex].status = 'CONFIRMED'

        // Eğer grup varsa, gruptaki tüm siparişleri de onayla
        if (responsePayload.groupId) {
          const groupOrders = data.orders.filter(o => o.groupId === responsePayload.groupId)
          groupOrders.forEach(order => {
            order.driverResponse = canvasResponse
            order.driverResponseTime = responsePayload.responseTime || new Date().toISOString()
            order.status = 'CONFIRMED'
          })
          console.log(`[WEBHOOK] Group ${responsePayload.groupId} accepted - ${groupOrders.length} orders updated`)
        }
      }

      // Redis'e kaydet
      await setImportData(data)

      console.log(`[WEBHOOK] Order ${responsePayload.orderNumber} - ${canvasResponse} by ${responsePayload.driverName}`)

      return NextResponse.json({
        success: true,
        type: 'DRIVER_RESPONSE',
        orderId: responsePayload.orderId,
        orderNumber: responsePayload.orderNumber,
        response: canvasResponse,
        message: `Order ${responsePayload.orderNumber} response updated to ${canvasResponse}`,
        groupUpdated: !!responsePayload.groupId
      }, { headers: corsHeaders })
    }

    // Bilinmeyen webhook tipi
    return NextResponse.json(
      { error: `Unknown webhook type: ${(payload as { type: string }).type}` },
      { status: 400, headers: corsHeaders }
    )

  } catch (error) {
    console.error('[WEBHOOK] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: corsHeaders })
  }
}

/**
 * GET /api/base44/webhook
 *
 * Webhook endpoint durumunu kontrol eder.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    status: 'ready',
    message: 'Webhook endpoint is ready to receive notifications',
    supportedTypes: ['SMS_SENT', 'DRIVER_RESPONSE'],
    expectedPayloads: {
      SMS_SENT: {
        type: 'SMS_SENT',
        orderId: 'string',
        orderNumber: 'string',
        driverName: 'string',
        sentTime: 'ISO timestamp',
        date: 'YYYY-MM-DD',
        groupId: 'optional string'
      },
      DRIVER_RESPONSE: {
        type: 'DRIVER_RESPONSE',
        orderId: 'string',
        orderNumber: 'string',
        driverResponse: 'Evet | Hayır',
        driverName: 'string',
        responseTime: 'ISO timestamp',
        date: 'YYYY-MM-DD',
        groupId: 'optional string'
      }
    }
  }, { headers: corsHeaders })
}
