import { NextRequest, NextResponse } from 'next/server'
import { updateOrderPrice, updateGroupPrice } from '@/lib/import-store'

// POST - Sipariş veya grup fiyatını güncelle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, groupId, price, groupPrice, date } = body

    // Grup fiyatı güncelleme
    if (groupId && groupPrice !== undefined) {
      const success = await updateGroupPrice(groupId, groupPrice, date)

      if (success) {
        console.log(`[PRICE API] Grup fiyatı güncellendi: ${groupId} → $${groupPrice}`)
        return NextResponse.json({
          success: true,
          message: 'Grup fiyatı güncellendi',
          groupId,
          groupPrice
        })
      }

      return NextResponse.json(
        { error: 'Grup bulunamadı' },
        { status: 404 }
      )
    }

    // Tekil sipariş fiyatı güncelleme
    if (!orderId || price === undefined) {
      return NextResponse.json(
        { error: 'orderId ve price (veya groupId ve groupPrice) gerekli' },
        { status: 400 }
      )
    }

    const success = await updateOrderPrice(orderId, price, date)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Fiyat güncellendi'
      })
    }

    return NextResponse.json(
      { error: 'Sipariş bulunamadı' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error updating price:', error)
    return NextResponse.json(
      { error: 'Fiyat güncellenirken hata oluştu' },
      { status: 500 }
    )
  }
}
