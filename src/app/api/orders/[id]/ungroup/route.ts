import { NextRequest, NextResponse } from 'next/server'
import { getImportData, setImportData, getLatestDate } from '@/lib/import-store'

// POST - Siparişi gruptan çıkar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Request body'den tarih al (opsiyonel)
    let date: string | undefined
    try {
      const body = await request.json()
      date = body.date
    } catch {
      // Body boş olabilir
    }

    // Tarih belirle
    const targetDate = date || await getLatestDate()
    if (!targetDate) {
      return NextResponse.json({ error: 'Veri bulunamadı' }, { status: 404 })
    }

    // Redis'ten veriyi al
    const data = await getImportData(targetDate)
    if (!data) {
      return NextResponse.json({ error: 'Veri bulunamadı' }, { status: 404 })
    }

    // Siparişi bul
    const order = data.orders.find(o => o.id === id)
    if (!order) {
      return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
    }

    const oldGroupId = order.groupId
    if (!oldGroupId) {
      return NextResponse.json({
        success: true,
        message: 'Sipariş zaten grupta değil',
        orderId: id
      })
    }

    // Gruptaki diğer siparişleri bul
    const groupOrders = data.orders.filter(o => o.groupId === oldGroupId)

    if (groupOrders.length <= 2) {
      // Grupta 2 sipariş varsa, tüm grubun groupId'sini null yap (grup çözülür)
      groupOrders.forEach(o => {
        o.groupId = null
      })
      console.log(`[UNGROUP] Grup ${oldGroupId} tamamen çözüldü (${groupOrders.length} sipariş)`)
    } else {
      // Grupta 3+ sipariş varsa, sadece bu siparişi çıkar
      order.groupId = null
      console.log(`[UNGROUP] Sipariş ${id} gruptan çıkarıldı, grup ${oldGroupId} devam ediyor (${groupOrders.length - 1} sipariş kaldı)`)
    }

    // Redis'e kaydet (explicit dateKey ile - timezone sorununu önler)
    await setImportData(data, targetDate)
    console.log(`[UNGROUP] Değişiklikler Redis'e kaydedildi (date: ${targetDate})`)

    return NextResponse.json({
      success: true,
      message: 'Sipariş gruptan çıkarıldı',
      orderId: id,
      previousGroupId: oldGroupId,
      groupDissolved: groupOrders.length <= 2
    })
  } catch (error) {
    console.error('Error ungrouping order:', error)
    return NextResponse.json(
      { error: 'Sipariş gruptan çıkarılırken hata oluştu' },
      { status: 500 }
    )
  }
}
