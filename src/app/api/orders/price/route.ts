import { NextRequest, NextResponse } from 'next/server'
import { updateOrderPrice } from '@/lib/import-store'

// POST - Sipariş fiyatını güncelle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, price, date } = body

    if (!orderId || price === undefined) {
      return NextResponse.json(
        { error: 'orderId ve price gerekli' },
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
