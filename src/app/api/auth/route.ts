import { NextRequest, NextResponse } from 'next/server'

// Şifre - Vercel'de environment variable olarak da ayarlanabilir
const SITE_PASSWORD = process.env.SITE_PASSWORD || 'yolunda06'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (password === SITE_PASSWORD) {
      // Başarılı giriş - cookie ayarla
      const response = NextResponse.json({ success: true })

      // 7 gün geçerli cookie
      response.cookies.set('auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 gün
      })

      return response
    }

    return NextResponse.json(
      { success: false, error: 'Yanlis sifre' },
      { status: 401 }
    )
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { success: false, error: 'Hata olustu' },
      { status: 500 }
    )
  }
}

// Oturum kontrolü
export async function GET(request: NextRequest) {
  const authCookie = request.cookies.get('auth')

  if (authCookie?.value === 'authenticated') {
    return NextResponse.json({ authenticated: true })
  }

  return NextResponse.json({ authenticated: false })
}

// Çıkış
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('auth')
  return response
}
