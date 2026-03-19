'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

interface Driver {
  id: string
  name: string
  phone: string | null
}

interface DriverProfileSummary {
  totalOrders: number
  ordersPerDay: number
  topRegions: string[]
  bestDays: string[]
  groupRate: number
}

interface DriverRecommendation {
  driverName: string
  score: number
  regionExperience: number
  acceptRate: number
  reasons: string[]
  // V2 fields
  regionScore?: number
  dayScore?: number
  capacityScore?: number
  performanceScore?: number
  profile?: DriverProfileSummary
}

interface Props {
  drivers: Driver[]
  selectedDriver: string | null
  onSelect: (driverName: string) => void
  placeholder?: string
  recommendations?: DriverRecommendation[]
}

export default function SearchableDriverSelect({
  drivers,
  selectedDriver,
  onSelect,
  placeholder = 'Sürücü Ara...',
  recommendations = []
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const recommendedNames = useMemo(() => {
    return new Set(recommendations.map(r => r.driverName))
  }, [recommendations])

  const recommendationMap = useMemo(() => {
    const map = new Map<string, DriverRecommendation>()
    recommendations.forEach(r => map.set(r.driverName, r))
    return map
  }, [recommendations])

  const filteredDrivers = useMemo(() => {
    if (!drivers || drivers.length === 0) return []
    if (!search.trim()) return drivers
    const searchLower = search.toLowerCase()
    return drivers.filter(d =>
      d.name.toLowerCase().includes(searchLower) ||
      (d.phone && d.phone.includes(search))
    )
  }, [drivers, search, recommendations])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (driver: Driver) => {
    onSelect(driver.name)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect('')
    setSearch('')
  }

  // Skor rengi
  const getScoreColor = (score: number) => {
    if (score >= 60) return 'bg-green-600'
    if (score >= 40) return 'bg-amber-500'
    return 'bg-gray-500'
  }

  // Kısa bölge adı
  const shortRegion = (r: string) => {
    const map: Record<string, string> = {
      'DC': 'DC', 'NoVA': 'VA', 'Bethesda': 'Beth', 'Gaithersburg': 'Gburg',
      'Silver Spring': 'SS', 'Frederick': 'Fred', 'Fredericksburg': 'Fburg',
      'Woodbridge': 'Wood', 'Manassas': 'Man', 'Loudoun': 'Lou',
      'Bowie/PG': 'PG', 'So MD': 'SMD', 'MD-Other': 'MD'
    }
    return map[r] || r.substring(0, 4)
  }

  return (
    <div
      ref={containerRef}
      className="relative nodrag nopan nowheel"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`
          w-full text-xs px-3 py-2 rounded-lg border-2 text-left flex items-center justify-between
          ${selectedDriver
            ? 'bg-green-50 border-green-400 text-black font-semibold'
            : 'bg-white border-gray-300 text-black hover:border-purple-400'
          }
          focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors
        `}
      >
        <span className="truncate">
          {selectedDriver || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedDriver && (
            <span onClick={handleClear} className="text-red-500 hover:text-red-700 px-1" title="Temizle">
              ×
            </span>
          )}
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute w-72 mt-1 bg-white border-2 border-purple-300 rounded-lg shadow-xl"
          style={{ zIndex: 9999 }}
        >
          {/* Arama */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sürücü adı ara..."
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-black focus:outline-none focus:border-purple-400"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          {/* Liste */}
          <div className="max-h-72 overflow-y-auto overscroll-contain">
            {filteredDrivers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500 text-center">
                Sürücü bulunamadı
              </div>
            ) : (
              <>
                {/* Önerilen Sürücüler */}
                {recommendations.length > 0 && !search && (
                  <>
                    <div className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-200 text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                      <span>🎯</span> Önerilen Sürücüler
                    </div>
                    {recommendations.map((rec) => {
                      const driver = drivers.find(d => d.name === rec.driverName)
                      if (!driver) return null
                      const profile = rec.profile
                      return (
                        <button
                          key={`rec-${driver.id}`}
                          type="button"
                          onClick={() => handleSelect(driver)}
                          className={`
                            w-full px-3 py-2 text-left text-xs border-l-4 border-emerald-500
                            ${selectedDriver === driver.name ? 'bg-emerald-200' : 'bg-emerald-50 hover:bg-emerald-100'}
                          `}
                        >
                          {/* Üst satır: İsim + Skor */}
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-black">{driver.name}</span>
                            <span className={`text-[10px] ${getScoreColor(rec.score)} text-white px-2 py-0.5 rounded-full font-bold`}>
                              {rec.score}p
                            </span>
                          </div>

                          {/* Profil bilgisi */}
                          {profile && (
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {/* Bölgeler */}
                              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                {profile.topRegions.map(shortRegion).join(', ')}
                              </span>
                              {/* Sipariş/gün */}
                              <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                {profile.ordersPerDay}/gün
                              </span>
                              {/* En iyi günler */}
                              {profile.bestDays.length > 0 && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                  {profile.bestDays.slice(0, 2).map(d => d.substring(0, 3)).join(', ')}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Skor detayı */}
                          {rec.regionScore !== undefined && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[9px] text-gray-500">
                                B:{rec.regionScore} G:{rec.dayScore} K:{rec.capacityScore} P:{rec.performanceScore}
                              </span>
                            </div>
                          )}

                          {/* Sebepler */}
                          {rec.reasons.length > 0 && (
                            <div className="text-[10px] text-emerald-700 mt-0.5">
                              {rec.reasons.slice(0, 2).join(' · ')}
                            </div>
                          )}
                        </button>
                      )
                    })}
                    <div className="border-b-2 border-gray-200 my-1" />
                  </>
                )}

                {/* Diğer Sürücüler */}
                {!search && recommendations.length > 0 && (
                  <div className="px-3 py-1 bg-gray-50 text-[10px] text-gray-500">
                    Diğer sürücüler
                  </div>
                )}
                {filteredDrivers
                  .filter(d => search || !recommendedNames.has(d.name))
                  .map((driver) => {
                    const isRecommended = recommendedNames.has(driver.name)
                    const rec = recommendationMap.get(driver.name)
                    return (
                      <button
                        key={driver.id}
                        type="button"
                        onClick={() => handleSelect(driver)}
                        className={`
                          w-full px-3 py-2 text-left text-xs flex items-center justify-between
                          ${isRecommended && search
                            ? 'bg-emerald-50 border-l-4 border-emerald-500 hover:bg-emerald-100'
                            : selectedDriver === driver.name
                            ? 'bg-green-50 text-black'
                            : 'hover:bg-purple-50 text-black'
                          }
                        `}
                      >
                        <div>
                          <span className="font-medium">{driver.name}</span>
                          {isRecommended && search && rec && (
                            <span className="ml-2 text-[10px] text-emerald-600">
                              ({rec.reasons[0]})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isRecommended && search && rec && (
                            <span className={`text-[10px] ${getScoreColor(rec.score)} text-white px-1.5 py-0.5 rounded`}>
                              {rec.score}p
                            </span>
                          )}
                          {driver.phone && (
                            <span className="text-gray-400 text-[10px]">{driver.phone}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
              </>
            )}
          </div>

          {/* Alt bilgi */}
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between">
            <span>{filteredDrivers.length} / {drivers.length} sürücü</span>
            {recommendations.length > 0 && (
              <span className="text-emerald-600 font-medium">{recommendations.length} önerilen</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
