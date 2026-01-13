import { NextRequest, NextResponse } from 'next/server'
import { getImportData, setImportData, getLatestDate } from '@/lib/import-store'

/**
 * POST /api/orders/group-assign
 *
 * Grup içindeki TÜM siparişlere aynı anda sürücü atar.
 * Race condition sorununu önlemek için tek bir işlemde güncelleme yapar.
 *
 * Body:
 * {
 *   groupId: string,
 *   driverName: string,
 *   date?: string (YYYY-MM-DD)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { groupId, driverName, date } = body

    if (!groupId || !driverName) {
      return NextResponse.json(
        { error: 'groupId ve driverName gerekli' },
        { status: 400 }
      )
    }

    // Tarih belirle
    const targetDate = date || await getLatestDate()
    if (!targetDate) {
      return NextResponse.json(
        { error: 'Veri bulunamadı' },
        { status: 404 }
      )
    }

    // Redis'ten veriyi al
    const data = await getImportData(targetDate)
    if (!data) {
      return NextResponse.json(
        { error: 'Tarih için veri bulunamadı' },
        { status: 404 }
      )
    }

    // Gruptaki tüm siparişleri bul ve güncelle
    const groupOrders = data.orders.filter(o => o.groupId === groupId)

    if (groupOrders.length === 0) {
      return NextResponse.json(
        { error: 'Grup bulunamadı' },
        { status: 404 }
      )
    }

    // Tüm gruptaki siparişlere sürücü ata
    groupOrders.forEach(order => {
      order.driverName = driverName
      order.status = 'ASSIGNED'
    })

    // Tek seferde kaydet (race condition yok)
    await setImportData(data)

    console.log(`[GROUP ASSIGN] Grup ${groupId}: ${groupOrders.length} sipariş ${driverName}'e atandı`)

    return NextResponse.json({
      success: true,
      groupId,
      driverName,
      ordersUpdated: groupOrders.length,
      orderIds: groupOrders.map(o => o.id)
    })

  } catch (error) {
    console.error('[GROUP ASSIGN] Error:', error)
    return NextResponse.json(
      { error: 'Grup ataması başarısız' },
      { status: 500 }
    )
  }
}
