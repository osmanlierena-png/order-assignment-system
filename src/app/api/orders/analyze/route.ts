import { NextRequest, NextResponse } from 'next/server'

// GET /api/orders/analyze - Günlük sipariş analizi (Mock - Vercel deployment)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')

    return NextResponse.json({
      success: true,
      date: dateParam || 'tüm tarihler',
      analysis: {
        totalOrders: 0,
        ungroupedOrders: 0,
        mergeabilityScore: 0,
        currentMergeRatio: {
          ratio: 0,
          grouped: 0,
          ungrouped: 0,
          groups: 0,
          status: 'OK',
          message: 'Mock - veritabani baglantisi icin PostgreSQL gerekli'
        },
        regionDistribution: {},
        timeSlotDistribution: {},
        farRegionCount: 0,
        uniqueZipCount: 0,
        avgDistanceBetweenOrders: 0,
        avgTimeBetweenPickups: 0,
        peakHourConcentration: 0,
        recommendedThresholds: {
          riskLevel: 'moderate',
          minBuffer: 15,
          maxBuffer: 45,
          minMergeScore: 50,
          maxGroupSize: 4,
          allowCrossRegion: false,
          targetMergeRatioPercent: {
            min: 35,
            max: 55
          }
        },
        summary: 'Mock response - Vercel deployment. Gercek analiz icin PostgreSQL baglantisi gerekli.'
      },
      note: 'Mock response - Vercel deployment'
    })
  } catch (error) {
    console.error('Error analyzing orders:', error)
    return NextResponse.json(
      { success: false, error: 'Sipariş analizi sırasında hata oluştu' },
      { status: 500 }
    )
  }
}

// POST /api/orders/analyze - Belirli siparişleri analiz et (Mock - Vercel deployment)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderIds } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderIds dizisi gerekli' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      selectedCount: orderIds.length,
      analysis: {
        totalOrders: orderIds.length,
        ungroupedOrders: orderIds.length,
        mergeabilityScore: 0,
        currentMergeRatio: {
          ratio: 0,
          status: 'OK',
          message: 'Mock - veritabani baglantisi icin PostgreSQL gerekli'
        },
        recommendedThresholds: {
          riskLevel: 'moderate',
          minBuffer: 15,
          maxBuffer: 45,
          minMergeScore: 50,
          maxGroupSize: 4,
          allowCrossRegion: false,
          targetMergeRatio: [0.35, 0.55]
        },
        summary: 'Mock response - Vercel deployment'
      },
      note: 'Mock response - Vercel deployment'
    })
  } catch (error) {
    console.error('Error analyzing selected orders:', error)
    return NextResponse.json(
      { success: false, error: 'Seçili sipariş analizi sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
