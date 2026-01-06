import { NextRequest, NextResponse } from 'next/server'

// POST - Siparişi gruptan çıkar (Mock - Vercel deployment)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    return NextResponse.json({
      message: 'Siparis gruptan cikarildi',
      orderId: id,
      note: 'Mock response - Vercel deployment'
    })
  } catch (error) {
    console.error('Error ungrouping order:', error)
    return NextResponse.json(
      { error: 'Siparis gruptan cikarilirken hata olustu' },
      { status: 500 }
    )
  }
}
