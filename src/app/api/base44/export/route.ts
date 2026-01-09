import { NextRequest, NextResponse } from 'next/server'

// CORS headers - Base44'e gönderim için
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

interface Assignment {
  orderId: string
  orderNumber: string
  driverId: string | null    // Tekil tanımlayıcı (önerilen)
  driverName: string | null  // Geriye uyumluluk için
  groupId: string | null
  price: number
  groupPrice?: number
}

interface ExportRequest {
  date: string
  assignments: Assignment[]
  triggerSMS?: boolean
}

/**
 * POST /api/base44/export
 *
 * Canvas'tan yapılan atamaları Base44'e gönderir.
 * Base44 tarafında updateOrdersFromCanvas fonksiyonu bu veriyi alır.
 */
export async function POST(request: NextRequest) {
  try {
    // API Secret doğrulama
    if (!validateApiSecret(request)) {
      console.error('[BASE44 EXPORT] Unauthorized - Invalid API Secret')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Secret' },
        { status: 401, headers: corsHeaders }
      )
    }

    const body: ExportRequest = await request.json()
    const { date, assignments, triggerSMS = false } = body

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı: assignments dizisi gerekli' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: 'Gönderilecek atama bulunamadı' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`[BASE44 EXPORT] ${assignments.length} atama gönderilecek`)
    console.log(`[BASE44 EXPORT] Tarih: ${date}, SMS Tetikle: ${triggerSMS}`)

    // Base44 API URL'si - environment variable'dan al
    const base44ApiUrl = process.env.BASE44_API_URL

    if (!base44ApiUrl) {
      // Base44 API URL'si tanımlanmamışsa, sadece log'la ve başarılı dön
      // Gerçek entegrasyon için BASE44_API_URL environment variable'ı gerekli
      console.log('[BASE44 EXPORT] BASE44_API_URL tanımlanmamış, mock response dönülüyor')
      console.log('[BASE44 EXPORT] Atamalar:', JSON.stringify(assignments.slice(0, 3), null, 2))

      return NextResponse.json({
        success: true,
        message: `${assignments.length} atama hazır (Base44 API bağlantısı yapılandırılmamış)`,
        updatedOrders: assignments.length,
        smsTriggered: false,
        note: 'BASE44_API_URL environment variable tanımlanınca gerçek gönderim yapılacak',
        preview: assignments.slice(0, 5).map(a => ({
          orderNumber: a.orderNumber,
          driverName: a.driverName,
          price: a.price,
          groupId: a.groupId ? 'Gruplu' : 'Tekil'
        }))
      }, { headers: corsHeaders })
    }

    // Base44 Entity API ile gönderim yap
    // Her sipariş için ayrı PUT request yapılır
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      }

      // Her atama için Base44'e PUT request
      for (const assignment of assignments) {
        try {
          const response = await fetch(
            `${base44ApiUrl}/entities/DailyOrder/${assignment.orderId}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'api_key': process.env.BASE44_API_TOKEN || ''
              },
              body: JSON.stringify({
                driver_name: assignment.driverName,
                canvas_price: assignment.price,
                canvas_group_id: assignment.groupId,
                status: 'Atandı'
              })
            }
          )

          if (response.ok) {
            results.success++
            console.log(`[BASE44 EXPORT] ✓ Order ${assignment.orderNumber} güncellendi`)
          } else {
            results.failed++
            const errorText = await response.text()
            results.errors.push(`${assignment.orderNumber}: ${response.status} - ${errorText}`)
            console.error(`[BASE44 EXPORT] ✗ Order ${assignment.orderNumber} hata:`, errorText)
          }
        } catch (orderError) {
          results.failed++
          results.errors.push(`${assignment.orderNumber}: ${orderError instanceof Error ? orderError.message : 'Bilinmeyen hata'}`)
        }
      }

      console.log(`[BASE44 EXPORT] Sonuç: ${results.success} başarılı, ${results.failed} başarısız`)

      return NextResponse.json({
        success: results.failed === 0,
        message: `${results.success}/${assignments.length} atama Base44'e gönderildi`,
        updatedOrders: results.success,
        failedOrders: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
        smsTriggered: false // SMS için ayrı mekanizma gerekli
      }, { headers: corsHeaders })

    } catch (fetchError) {
      console.error('[BASE44 EXPORT] Base44 bağlantı hatası:', fetchError)
      return NextResponse.json({
        success: false,
        error: 'Base44 API\'sine bağlanılamadı',
        details: fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata'
      }, { status: 500, headers: corsHeaders })
    }

  } catch (error) {
    console.error('Base44 export error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Export sırasında hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * GET /api/base44/export
 *
 * Export durumunu ve ayarları döndürür.
 */
export async function GET() {
  const hasBase44Api = !!process.env.BASE44_API_URL

  return NextResponse.json({
    success: true,
    status: 'ready',
    config: {
      base44ApiConfigured: hasBase44Api,
      base44ApiUrl: hasBase44Api ? '***configured***' : 'not configured'
    },
    message: hasBase44Api
      ? 'Base44 export endpoint hazır'
      : 'Base44 API URL yapılandırılmamış - mock mod aktif'
  }, { headers: corsHeaders })
}
