import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { getImportData, setImportData, getLatestDate } from '@/lib/import-store'

// POST - İki siparişi veya sipariş + grubu birleştir
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceOrderId, targetOrderId, targetGroupId, date } = body

    console.log('[GROUP API] Birleştirme isteği:', { sourceOrderId, targetOrderId, targetGroupId, date })

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

    // Kaynak siparişi bul
    const sourceOrder = data.orders.find(o => o.id === sourceOrderId)
    if (!sourceOrder) {
      return NextResponse.json({ error: 'Kaynak sipariş bulunamadı' }, { status: 404 })
    }

    let groupId: string

    // Mevcut gruba ekleme
    if (targetGroupId) {
      groupId = targetGroupId
      sourceOrder.groupId = groupId
      console.log(`[GROUP API] Sipariş ${sourceOrderId} gruba eklendi: ${groupId}`)
    }
    // İki siparişi birleştir
    else if (targetOrderId) {
      const targetOrder = data.orders.find(o => o.id === targetOrderId)
      if (!targetOrder) {
        return NextResponse.json({ error: 'Hedef sipariş bulunamadı' }, { status: 404 })
      }

      // Hedefin mevcut grubu varsa onu kullan, yoksa yeni oluştur
      groupId = targetOrder.groupId || generateId()
      sourceOrder.groupId = groupId
      targetOrder.groupId = groupId
      console.log(`[GROUP API] Siparişler birleştirildi: ${sourceOrderId} + ${targetOrderId} → ${groupId}`)
    }
    else {
      return NextResponse.json(
        { error: 'Hedef sipariş veya grup belirtilmeli' },
        { status: 400 }
      )
    }

    // Redis'e kaydet
    await setImportData(data)
    console.log(`[GROUP API] Değişiklikler Redis'e kaydedildi`)

    return NextResponse.json({
      success: true,
      message: 'Grup güncellendi',
      groupId
    })
  } catch (error) {
    console.error('Error grouping orders:', error)
    return NextResponse.json(
      { error: 'Siparişler gruplanırken hata oluştu' },
      { status: 500 }
    )
  }
}
