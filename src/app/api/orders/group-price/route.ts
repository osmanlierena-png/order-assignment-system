import { NextRequest, NextResponse } from 'next/server'
import { updateGroupPrice } from '@/lib/import-store'

// POST - Grup fiyatını güncelle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { groupId, groupPrice, date } = body

    if (!groupId || groupPrice === undefined) {
      return NextResponse.json(
        { error: 'groupId ve groupPrice gerekli' },
        { status: 400 }
      )
    }

    const success = await updateGroupPrice(groupId, groupPrice, date)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Grup fiyatı güncellendi'
      })
    }

    return NextResponse.json(
      { error: 'Grup bulunamadı' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error updating group price:', error)
    return NextResponse.json(
      { error: 'Grup fiyatı güncellenirken hata oluştu' },
      { status: 500 }
    )
  }
}
