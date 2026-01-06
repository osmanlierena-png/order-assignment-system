'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasOrders, setHasOrders] = useState(false)
  const [orderCount, setOrderCount] = useState(0)

  // Siparişleri kontrol et
  const checkOrders = async () => {
    try {
      const response = await fetch('/api/orders')
      const orders = await response.json()

      if (orders && orders.length > 0) {
        setHasOrders(true)
        setOrderCount(orders.length)
        // Siparişler varsa otomatik olarak canvas'a yönlendir
        router.push('/atama')
      } else {
        setHasOrders(false)
        setOrderCount(0)
      }
    } catch (error) {
      console.error('Sipariş kontrolü hatası:', error)
    } finally {
      setChecking(false)
    }
  }

  // Sayfa yüklendiğinde ve her 5 saniyede bir kontrol et
  useEffect(() => {
    checkOrders()

    // Her 5 saniyede bir kontrol et
    const interval = setInterval(checkOrders, 5000)

    return () => clearInterval(interval)
  }, [])

  // Manuel olarak canvas'a git
  const goToCanvas = () => {
    router.push('/atama')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Ana Kart */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Logo / İkon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>

          {/* Başlık */}
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Sipariş Atama Sistemi
          </h1>

          {/* Durum Mesajı */}
          {checking ? (
            <div className="mt-6">
              <div className="flex items-center justify-center gap-3 text-gray-600">
                <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Siparişler kontrol ediliyor...</span>
              </div>
            </div>
          ) : hasOrders ? (
            <div className="mt-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">{orderCount} sipariş mevcut</span>
                </div>
              </div>
              <p className="text-gray-600 text-sm">Canvas&apos;a yönlendiriliyorsunuz...</p>
            </div>
          ) : (
            <div className="mt-6">
              {/* Bekleniyor Animasyonu */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6">
                <div className="flex flex-col items-center gap-4">
                  {/* Pulse Animasyonu */}
                  <div className="relative">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 w-16 h-16 bg-purple-400 rounded-full animate-ping opacity-20"></div>
                  </div>

                  <div className="text-center">
                    <p className="text-purple-800 font-semibold text-lg">
                      Base44&apos;ten siparişler bekleniyor...
                    </p>
                    <p className="text-purple-600 text-sm mt-1">
                      Base44&apos;te &quot;Canvas&apos;a Gönder&quot; butonuna basın
                    </p>
                  </div>
                </div>
              </div>

              {/* Bilgi */}
              <div className="text-gray-500 text-sm space-y-2">
                <p>Siparişler geldiğinde otomatik olarak</p>
                <p>atama ekranına yönlendirileceksiniz.</p>
              </div>

              {/* Yenile Butonu */}
              <button
                onClick={checkOrders}
                className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                Şimdi Kontrol Et
              </button>
            </div>
          )}

          {/* Alt Bilgi */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={goToCanvas}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium transition-colors"
            >
              Manuel olarak Canvas&apos;a git →
            </button>
          </div>
        </div>

        {/* Alt Açıklama */}
        <p className="text-center text-gray-400 text-xs mt-4">
          Siparişler her 5 saniyede otomatik kontrol edilir
        </p>
      </div>
    </div>
  )
}
