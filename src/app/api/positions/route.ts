import { NextRequest, NextResponse } from 'next/server'
import { getNodePositions, saveNodePositions, NodePositions } from '@/lib/import-store'

// GET - Pozisyonları getir
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || undefined

    const positions = await getNodePositions(date)

    return NextResponse.json({
      success: true,
      positions,
      count: Object.keys(positions).length
    })
  } catch (error) {
    console.error('[POSITIONS API] GET error:', error)
    return NextResponse.json(
      { error: 'Pozisyonlar alınırken hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Pozisyonları kaydet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { positions, date }: { positions: NodePositions; date?: string } = body

    if (!positions || typeof positions !== 'object') {
      return NextResponse.json(
        { error: 'Geçersiz pozisyon verisi' },
        { status: 400 }
      )
    }

    await saveNodePositions(positions, date)

    return NextResponse.json({
      success: true,
      message: 'Pozisyonlar kaydedildi',
      count: Object.keys(positions).length
    })
  } catch (error) {
    console.error('[POSITIONS API] POST error:', error)
    return NextResponse.json(
      { error: 'Pozisyonlar kaydedilirken hata oluştu' },
      { status: 500 }
    )
  }
}
