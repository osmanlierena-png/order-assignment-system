'use client'

import { useState, useEffect, useCallback } from 'react'

interface OrderInfo {
  dropoffAddress: string
  dropoffTime: string
  dropoffLat?: number | null
  dropoffLng?: number | null
}

interface NextOrderInfo {
  pickupAddress: string
  pickupTime: string
  pickupLat?: number | null
  pickupLng?: number | null
}

interface DrivingTimeIndicatorProps {
  fromOrder: OrderInfo
  toOrder: NextOrderInfo
  bufferMinutes: number
  groupSource: 'system' | 'manual'
}

interface DistanceData {
  durationSeconds: number
  durationText: string
  distanceMeters: number
  distanceText: string
  source: 'google' | 'zip-estimate' | 'haversine'
  timestamp?: string
}

type SafetyStatus = 'safe' | 'risky' | 'danger'

export default function DrivingTimeIndicator({
  fromOrder,
  toOrder,
  bufferMinutes,
  groupSource
}: DrivingTimeIndicatorProps) {
  const [distanceData, setDistanceData] = useState<DistanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Mesafe hesapla
  const fetchDistance = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: fromOrder.dropoffLat && fromOrder.dropoffLng
            ? { lat: fromOrder.dropoffLat, lng: fromOrder.dropoffLng }
            : undefined,
          destination: toOrder.pickupLat && toOrder.pickupLng
            ? { lat: toOrder.pickupLat, lng: toOrder.pickupLng }
            : undefined,
          originAddress: fromOrder.dropoffAddress,
          destinationAddress: toOrder.pickupAddress
        })
      })

      const data = await response.json()

      if (data.success) {
        setDistanceData(data.data)
      } else {
        setError(data.error || 'Mesafe hesaplanamadi')
      }
    } catch (err) {
      setError('API hatasi')
      console.error('[DrivingTimeIndicator] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [fromOrder, toOrder])

  // Sistem grubu için otomatik fetch
  useEffect(() => {
    if (groupSource === 'system') {
      fetchDistance()
    }
  }, [groupSource, fetchDistance])

  // Suruş süresi (dakika)
  const drivingMinutes = distanceData
    ? Math.ceil(distanceData.durationSeconds / 60)
    : null

  // Güvenlik durumu hesapla
  const getSafetyStatus = (): SafetyStatus => {
    if (!drivingMinutes) return 'safe'
    if (bufferMinutes < drivingMinutes) return 'danger'
    if (bufferMinutes < drivingMinutes + 10) return 'risky'
    return 'safe'
  }

  const safetyStatus = getSafetyStatus()
  const safetyMargin = drivingMinutes ? bufferMinutes - drivingMinutes : null

  // Çizgi rengi
  const getLineColor = () => {
    switch (safetyStatus) {
      case 'danger':
        return 'border-red-400'
      case 'risky':
        return 'border-yellow-400'
      default:
        return 'border-green-400'
    }
  }

  const getTextColor = () => {
    switch (safetyStatus) {
      case 'danger':
        return 'text-red-600'
      case 'risky':
        return 'text-yellow-600'
      default:
        return 'text-green-600'
    }
  }

  const lineColor = getLineColor()
  const textColor = getTextColor()

  // Manuel grup ve henüz fetch edilmemişse kompakt buton göster
  if (groupSource === 'manual' && !distanceData && !loading && !error) {
    return (
      <div className="relative flex items-center justify-center h-4 my-0.5">
        <div className="absolute inset-x-2 border-t border-dashed border-gray-300" />
        <button
          onClick={fetchDistance}
          className="relative z-10 px-2 py-0.5 text-[10px] bg-white text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          Süre?
        </button>
      </div>
    )
  }

  // Loading durumu - kompakt
  if (loading) {
    return (
      <div className="relative flex items-center justify-center h-4 my-0.5">
        <div className="absolute inset-x-2 border-t border-dashed border-gray-300" />
        <span className="relative z-10 px-2 py-0.5 text-[10px] bg-white text-gray-400">
          ...
        </span>
      </div>
    )
  }

  // Hata durumu - kompakt
  if (error) {
    return (
      <div className="relative flex items-center justify-center h-4 my-0.5">
        <div className="absolute inset-x-2 border-t border-dashed border-gray-300" />
        <button
          onClick={fetchDistance}
          className="relative z-10 px-2 py-0.5 text-[10px] bg-white text-gray-400 hover:text-blue-600"
          title="Tekrar dene"
        >
          ?
        </button>
      </div>
    )
  }

  // Veri gösterimi - KOMPAKT tasarım
  if (!distanceData) return null

  return (
    <div
      className="relative flex items-center justify-center h-4 my-0.5 group cursor-pointer"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Kesikli çizgi - renk kodlu */}
      <div className={`absolute inset-x-2 border-t-2 border-dashed ${lineColor}`} />

      {/* Süre yazısı - ortada */}
      <span className={`relative z-10 px-2 py-0.5 text-[10px] font-medium bg-white ${textColor}`}>
        {drivingMinutes}dk
      </span>

      {/* Hover'da detay popup */}
      {showDetails && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2.5 min-w-[180px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[11px] space-y-1.5">
            {/* Süre ve mesafe */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Süre:</span>
              <span className={`font-semibold ${textColor}`}>
                {distanceData.durationText}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Mesafe:</span>
              <span className="font-semibold text-gray-700">
                {distanceData.distanceText}
              </span>
            </div>

            {/* Buffer ve marj */}
            <div className="pt-1.5 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Buffer:</span>
                <span className="font-semibold text-gray-700">
                  {bufferMinutes} dk
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Marj:</span>
                <span className={`font-semibold ${textColor}`}>
                  {safetyMargin !== null && safetyMargin >= 0 ? '+' : ''}
                  {safetyMargin} dk
                  {safetyStatus === 'safe' && ' ✓'}
                  {safetyStatus === 'risky' && ' !'}
                  {safetyStatus === 'danger' && ' ✗'}
                </span>
              </div>
            </div>

            {/* Kaynak bilgisi - sadece Google değilse göster */}
            {distanceData.source !== 'google' && (
              <div className="pt-1 border-t border-gray-100 text-[9px] text-amber-500">
                ~tahmini ({distanceData.source === 'zip-estimate' ? 'ZIP' : 'Haversine'})
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
