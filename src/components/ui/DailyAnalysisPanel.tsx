'use client'

import { useState, useEffect } from 'react'

interface AnalysisData {
  totalOrders: number
  ungroupedOrders: number
  mergeabilityScore: number
  currentMergeRatio: {
    ratio: number
    grouped: number
    ungrouped: number
    groups: number
    status: 'LOW' | 'OK' | 'HIGH'
    message: string
  }
  regionDistribution: Record<string, number>
  timeSlotDistribution: Record<string, number>
  farRegionCount: number
  uniqueZipCount: number
  avgDistanceBetweenOrders: number
  avgTimeBetweenPickups: number
  peakHourConcentration: number
  recommendedThresholds: {
    riskLevel: 'conservative' | 'moderate' | 'aggressive'
    minBuffer: number
    maxBuffer: number
    minMergeScore: number
    maxGroupSize: number
    allowCrossRegion: boolean
    targetMergeRatioPercent: {
      min: number
      max: number
    }
  }
  summary: string
}

interface Props {
  date?: string
  onRefresh?: () => void
}

export function DailyAnalysisPanel({ date, onRefresh }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)

    try {
      const url = date
        ? `/api/orders/analyze?date=${encodeURIComponent(date)}`
        : '/api/orders/analyze'

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        setError(data.error || 'Analiz yüklenemedi')
      }
    } catch (err) {
      setError('Analiz API\'sine bağlanılamadı')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [date])

  // Birleştirilebilirlik skoru rengi
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-100'
    if (score >= 45) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  // Oran durumu rengi
  const getStatusColor = (status: 'LOW' | 'OK' | 'HIGH') => {
    switch (status) {
      case 'OK': return 'text-green-600 bg-green-100 border-green-300'
      case 'LOW': return 'text-blue-600 bg-blue-100 border-blue-300'
      case 'HIGH': return 'text-red-600 bg-red-100 border-red-300'
    }
  }

  // Risk seviyesi badge
  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'conservative':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Konservatif</span>
      case 'moderate':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Dengeli</span>
      case 'aggressive':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Agresif</span>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600">
          <span>Hata:</span>
          <span>{error}</span>
        </div>
        <button
          onClick={fetchAnalysis}
          className="mt-2 text-sm text-red-600 underline hover:no-underline"
        >
          Tekrar dene
        </button>
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header - Her zaman görünür */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-800">Gunluk Analiz</h3>

            {/* Birleştirilebilirlik Skoru */}
            <div className={`px-3 py-1 rounded-full font-bold ${getScoreColor(analysis.mergeabilityScore)}`}>
              {analysis.mergeabilityScore}/100
            </div>

            {/* Mevcut Oran */}
            <div className={`px-3 py-1 rounded border ${getStatusColor(analysis.currentMergeRatio.status)}`}>
              %{analysis.currentMergeRatio.ratio} birlesik
            </div>

            {/* Risk Seviyesi */}
            {getRiskBadge(analysis.recommendedThresholds.riskLevel)}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                fetchAnalysis()
                onRefresh?.()
              }}
              className="p-1 hover:bg-gray-200 rounded"
              title="Yenile"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <svg
              className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Kısa özet */}
        <div className="mt-2 text-sm text-gray-600">
          {analysis.totalOrders} siparis | {analysis.currentMergeRatio.grouped} gruplu | {analysis.currentMergeRatio.ungrouped} tekil
        </div>
      </div>

      {/* Detaylar - Genişletildiğinde */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Mevcut Durum */}
          <div className={`p-3 rounded-lg border ${getStatusColor(analysis.currentMergeRatio.status)}`}>
            <div className="font-medium">{analysis.currentMergeRatio.message}</div>
            <div className="text-sm mt-1 opacity-80">
              Hedef: %{analysis.recommendedThresholds.targetMergeRatioPercent.min} - %{analysis.recommendedThresholds.targetMergeRatioPercent.max}
            </div>
          </div>

          {/* Metrikler Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xs text-gray-500">Ort. Pickup Arasi</div>
              <div className="font-semibold">{analysis.avgTimeBetweenPickups} dk</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xs text-gray-500">Ort. Mesafe</div>
              <div className="font-semibold">{analysis.avgDistanceBetweenOrders} km</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xs text-gray-500">Farkli ZIP</div>
              <div className="font-semibold">{analysis.uniqueZipCount}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xs text-gray-500">Uzak Bolge</div>
              <div className={`font-semibold ${analysis.farRegionCount > 5 ? 'text-red-600' : ''}`}>
                {analysis.farRegionCount}
              </div>
            </div>
          </div>

          {/* Bölge Dağılımı */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Bolge Dagilimi</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(analysis.regionDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([region, count]) => (
                  <span
                    key={region}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      region === 'FAR' || region === 'UNKNOWN'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {region}: {count}
                  </span>
                ))}
            </div>
          </div>

          {/* Zaman Dilimi Dağılımı */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Zaman Dilimi</h4>
            <div className="flex gap-2">
              {Object.entries(analysis.timeSlotDistribution).map(([slot, count]) => (
                <span
                  key={slot}
                  className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700"
                >
                  {slot}: {count}
                </span>
              ))}
            </div>
          </div>

          {/* Önerilen Ayarlar */}
          <div className="bg-gray-50 p-3 rounded">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Onerilen Ayarlar</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Buffer:</span>{' '}
                <span className="font-medium">
                  {analysis.recommendedThresholds.minBuffer}-{analysis.recommendedThresholds.maxBuffer}dk
                </span>
              </div>
              <div>
                <span className="text-gray-500">Min Skor:</span>{' '}
                <span className="font-medium">{analysis.recommendedThresholds.minMergeScore}</span>
              </div>
              <div>
                <span className="text-gray-500">Max Grup:</span>{' '}
                <span className="font-medium">{analysis.recommendedThresholds.maxGroupSize}</span>
              </div>
              <div>
                <span className="text-gray-500">Cross-Region:</span>{' '}
                <span className="font-medium">
                  {analysis.recommendedThresholds.allowCrossRegion ? 'Evet' : 'Hayir'}
                </span>
              </div>
            </div>
          </div>

          {/* Özet */}
          <div className="text-xs text-gray-500 whitespace-pre-line border-t pt-3">
            {analysis.summary}
          </div>
        </div>
      )}
    </div>
  )
}

export default DailyAnalysisPanel
