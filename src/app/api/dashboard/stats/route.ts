import { NextResponse } from 'next/server'

// GET - Dashboard istatistikleri
// NOT: Vercel serverless ortamda SQLite calismadigindan,
// simdilik mock veri donuyoruz.
export async function GET() {
  try {
    // Mock istatistikler - Vercel'de Prisma/SQLite calismadigi icin
    return NextResponse.json({
      totalOrders: 0,
      todayOrders: 0,
      pendingOrders: 0,
      assignedOrders: 0,
      driversCount: 0,
      ordersByTimeSlot: [],
      ordersByDriver: [],
      message: 'Vercel deployment - veritabani baglantisi icin PostgreSQL gerekli'
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Istatistikler yuklenirken hata olustu' },
      { status: 500 }
    )
  }
}
