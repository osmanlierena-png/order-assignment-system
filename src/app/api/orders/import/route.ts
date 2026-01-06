import { NextRequest, NextResponse } from 'next/server'

// POST - CSV, PDF veya resimden siparişleri içe aktar (Mock - Vercel deployment)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 400 }
      )
    }

    const fileName = file.name.toLowerCase()

    // Dosya tipini belirle
    let fileType = 'CSV'
    if (fileName.endsWith('.pdf')) {
      fileType = 'PDF'
    } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
      fileType = 'Resim (OCR)'
    } else if (!fileName.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Desteklenmeyen dosya formatı. CSV, PDF veya resim (JPG/PNG) yükleyin.' },
        { status: 400 }
      )
    }

    // Mock response - gerçek import işlemi yok
    return NextResponse.json({
      message: `Mock response - Vercel deployment. ${fileType} dosyası alındı ancak veritabanı bağlantısı yok.`,
      imported: 0,
      skipped: 0,
      drivers: 0,
      fileType,
      note: 'Gercek import icin PostgreSQL baglantisi gerekli. Base44 entegrasyonu icin /api/base44/import kullanin.'
    })
  } catch (error) {
    console.error('Error importing orders:', error)
    return NextResponse.json(
      { error: 'Siparişler içe aktarılırken hata oluştu' },
      { status: 500 }
    )
  }
}
