import { NextRequest, NextResponse } from 'next/server'
import { updateOrderDriver, getImportData, getLatestDate } from '@/lib/import-store'

// GET - Tek sipariş detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')

    // Tarih belirle
    const targetDate = dateParam || await getLatestDate()
    if (!targetDate) {
      return NextResponse.json({ error: 'Veri bulunamadı' }, { status: 404 })
    }

    // Redis'ten veriyi al
    const data = await getImportData(targetDate)
    if (!data) {
      return NextResponse.json({ error: 'Veri bulunamadı' }, { status: 404 })
    }

    const order = data.orders.find(o => o.id === id)
    if (!order) {
      return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Siparis yuklenirken hata olustu' },
      { status: 500 }
    )
  }
}

// PUT - Sipariş güncelle (Sürücü ataması)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Tarih belirle - body'den veya en son tarihten
    const targetDate = body.date || await getLatestDate()

    // Sürücü ataması varsa Redis'e kaydet
    if (body.driver !== undefined) {
      const success = await updateOrderDriver(id, body.driver, targetDate)

      if (!success) {
        return NextResponse.json(
          { error: 'Sipariş bulunamadı veya güncellenemedi' },
          { status: 404 }
        )
      }

      console.log(`[ORDER UPDATE] Sipariş ${id} için sürücü atandı: ${body.driver}`)
    }

    return NextResponse.json({
      success: true,
      id,
      driver: body.driver,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Siparis guncellenirken hata olustu' },
      { status: 500 }
    )
  }
}

// DELETE - Sipariş sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params

    // Mock delete - Vercel deployment icin
    return NextResponse.json({ message: 'Siparis silindi' })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Siparis silinirken hata olustu' },
      { status: 500 }
    )
  }
}
