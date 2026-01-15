'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

interface Driver {
  id: string
  name: string
  phone: string | null
}

interface Props {
  drivers: Driver[]
  selectedDriver: string | null
  onSelect: (driverName: string) => void
  placeholder?: string
}

export default function SearchableDriverSelect({
  drivers,
  selectedDriver,
  onSelect,
  placeholder = 'Sürücü Ara...'
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filtrelenmiş sürücüler
  const filteredDrivers = useMemo(() => {
    if (!search.trim()) return drivers
    const searchLower = search.toLowerCase()
    return drivers.filter(d =>
      d.name.toLowerCase().includes(searchLower) ||
      (d.phone && d.phone.includes(search))
    )
  }, [drivers, search])

  // Dışarı tıklama
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

  // Açıldığında input'a focus
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

  return (
    <div
      ref={containerRef}
      className="relative nodrag nopan nowheel"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Seçili Sürücü veya Buton */}
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
            ? 'bg-green-50 border-green-400 text-green-800 font-semibold'
            : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400'
          }
          focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors
        `}
      >
        <span className="truncate">
          {selectedDriver || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedDriver && (
            <span
              onClick={handleClear}
              className="text-red-500 hover:text-red-700 px-1"
              title="Temizle"
            >
              ×
            </span>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-purple-300 rounded-lg shadow-xl overflow-hidden">
          {/* Arama Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sürücü adı ara..."
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-purple-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Sürücü Listesi */}
          <div className="max-h-48 overflow-y-auto">
            {filteredDrivers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500 text-center">
                Sürücü bulunamadı
              </div>
            ) : (
              filteredDrivers.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => handleSelect(driver)}
                  className={`
                    w-full px-3 py-2 text-left text-xs hover:bg-purple-50 flex items-center justify-between
                    ${selectedDriver === driver.name ? 'bg-green-50 text-green-800' : 'text-gray-700'}
                  `}
                >
                  <span className="font-medium">{driver.name}</span>
                  {driver.phone && (
                    <span className="text-gray-400 text-[10px]">{driver.phone}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Sürücü Sayısı */}
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500">
            {filteredDrivers.length} / {drivers.length} sürücü
          </div>
        </div>
      )}
    </div>
  )
}
