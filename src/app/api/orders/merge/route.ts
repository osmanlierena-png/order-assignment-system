import { NextRequest, NextResponse } from 'next/server'

// POST /api/orders/merge - Siparişleri otomatik birleştir (Mock - Vercel deployment)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const date = body.date ? new Date(body.date) : new Date()
    const dryRun = body.dryRun === true

    return NextResponse.json({
      message: dryRun
        ? 'ÖNİZLEME: Mock response - Vercel deployment'
        : 'Mock response - Vercel deployment',
      dryRun,
      groups: [],
      statistics: {
        totalOrders: 0,
        previouslyGrouped: 0,
        newlyMerged: 0,
        remainingSingle: 0,
        groupsCreated: 0,
        previousMergeRatio: 0,
        newMergeRatio: 0,
        targetStatus: 'OK',
        targetMessage: 'Mock - veritabani baglantisi icin PostgreSQL gerekli'
      },
      thresholdsUsed: {
        riskLevel: 'moderate',
        minBuffer: 15,
        maxBuffer: 45,
        minMergeScore: 50,
        maxGroupSize: 4,
        allowCrossRegion: false,
        targetMergeRatio: '35-55%'
      },
      analysis: null,
      rejectedPairs: [],
      note: 'Mock response - Vercel deployment. Gercek islem icin PostgreSQL baglantisi gerekli.'
    })
  } catch (error) {
    console.error('Error merging orders:', error)
    return NextResponse.json(
      { error: 'Siparişler birleştirilirken hata oluştu' },
      { status: 500 }
    )
  }
}

// GET /api/orders/merge - Mevcut birleştirme durumu (Mock - Vercel deployment)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')

    return NextResponse.json({
      date: dateParam || 'tüm tarihler',
      statistics: {
        totalOrders: 0,
        grouped: 0,
        ungrouped: 0,
        groups: 0,
        mergeRatio: 0,
        targetStatus: 'OK',
        targetMessage: 'Mock - veritabani baglantisi icin PostgreSQL gerekli'
      },
      analysis: {
        mergeabilityScore: 0,
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
    console.error('Error getting merge status:', error)
    return NextResponse.json(
      { error: 'Birleştirme durumu alınırken hata oluştu' },
      { status: 500 }
    )
  }
}
