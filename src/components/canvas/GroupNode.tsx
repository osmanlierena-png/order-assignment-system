'use client'

import { memo, useMemo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { TIME_SLOTS } from '@/lib/constants'
import SearchableDriverSelect from '@/components/ui/SearchableDriverSelect'

interface Driver {
  id: string
  name: string
  phone: string | null
}

interface OrderInGroup {
  id: string
  orderNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  status: string
  driver: string | null
  timeSlot?: string // Her siparişin kendi zaman dilimi
  price?: number    // Sipariş fiyatı
}

interface GroupNodeData {
  groupId: string
  timeSlot: string
  orders: OrderInGroup[]
  groupPrice?: number // Grup toplam fiyatı
  drivers?: Driver[]
  onDriverSelect?: (orderId: string, driverName: string) => void
  onRemoveFromGroup?: (orderId: string) => void
  onPriceChange?: (orderId: string, price: number) => void
  onGroupPriceChange?: (groupId: string, groupPrice: number) => void
}

// Adresten ZIP kodunu çıkar
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

// Adresi kısalt (sokak adı)
function shortenAddress(address: string): string {
  // ZIP ve eyalet kısmını kaldır, sadece sokak adını al
  const street = address.replace(/,?\s*(DC|VA|MD)\s*\d{5}.*$/i, '').trim()
  // Çok uzunsa kısalt
  if (street.length > 25) {
    return street.substring(0, 22) + '...'
  }
  return street
}

// Zaman string'ini dakikaya çevir
function timeToMinutes(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!match) return 0
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

// Grup validasyonu - sorunları tespit et
interface GroupIssue {
  type: 'SAME_PICKUP' | 'TIME_OVERLAP' | 'SHORT_BUFFER'
  message: string
  orderIndex1: number
  orderIndex2: number
}

function validateGroup(orders: OrderInGroup[]): GroupIssue[] {
  const issues: GroupIssue[] = []

  // Siparişleri pickup zamanına göre sırala
  const sortedOrders = orders.map((o, idx) => ({
    ...o,
    originalIndex: idx,
    pickupMinutes: timeToMinutes(o.pickupTime),
    dropoffMinutes: timeToMinutes(o.dropoffTime)
  })).sort((a, b) => a.pickupMinutes - b.pickupMinutes)

  for (let i = 0; i < sortedOrders.length - 1; i++) {
    const current = sortedOrders[i]
    const next = sortedOrders[i + 1]

    // Aynı pickup zamanı
    if (current.pickupMinutes === next.pickupMinutes) {
      issues.push({
        type: 'SAME_PICKUP',
        message: `Aynı alım saati: ${current.pickupTime}`,
        orderIndex1: current.originalIndex,
        orderIndex2: next.originalIndex
      })
    }

    // Zaman çakışması (dropoff > next pickup)
    const buffer = next.pickupMinutes - current.dropoffMinutes
    if (buffer < 0) {
      issues.push({
        type: 'TIME_OVERLAP',
        message: `Çakışma: ${current.dropoffTime} → ${next.pickupTime}`,
        orderIndex1: current.originalIndex,
        orderIndex2: next.originalIndex
      })
    } else if (buffer < 15 && buffer >= 0) {
      issues.push({
        type: 'SHORT_BUFFER',
        message: `Kısa süre: ${buffer} dk`,
        orderIndex1: current.originalIndex,
        orderIndex2: next.originalIndex
      })
    }
  }

  return issues
}

function GroupNode({ data }: NodeProps<GroupNodeData>) {
  // Gruptaki benzersiz zaman dilimlerini tespit et
  const uniqueTimeSlots = useMemo(() => {
    const slots = new Set<string>()
    data.orders.forEach(order => {
      if (order.timeSlot) {
        slots.add(order.timeSlot)
      }
    })
    // Eğer sipariş timeSlot'u yoksa grubun timeSlot'unu kullan
    if (slots.size === 0) {
      slots.add(data.timeSlot)
    }
    return Array.from(slots)
  }, [data.orders, data.timeSlot])

  // MIXED grup mu? (farklı zaman dilimlerinden siparişler var)
  const isMixed = uniqueTimeSlots.length > 1

  const timeSlotInfo = TIME_SLOTS[data.timeSlot as keyof typeof TIME_SLOTS]
  const baseColor = isMixed ? '#f0abfc' : (timeSlotInfo?.color || '#e5e7eb') // MIXED için pembe

  // Grup validasyonu
  const issues = useMemo(() => validateGroup(data.orders), [data.orders])
  const hasIssues = issues.length > 0
  const criticalIssues = issues.filter(i => i.type === 'SAME_PICKUP' || i.type === 'TIME_OVERLAP')
  const hasCritical = criticalIssues.length > 0

  // Sorunlu sipariş indeksleri
  const problemOrderIndices = new Set<number>()
  issues.forEach(issue => {
    problemOrderIndices.add(issue.orderIndex1)
    problemOrderIndices.add(issue.orderIndex2)
  })

  // Zaman dilimine göre renk şeması
  const getTimeSlotColors = () => {
    switch (data.timeSlot) {
      case 'MORNING':
        return {
          border: 'border-amber-500 bg-amber-50',
          header: 'bg-gradient-to-r from-amber-500 to-orange-500',
          badge: 'bg-amber-600'
        }
      case 'AFTERNOON':
        return {
          border: 'border-blue-500 bg-blue-50',
          header: 'bg-gradient-to-r from-blue-500 to-blue-600',
          badge: 'bg-blue-600'
        }
      case 'EVENING':
        return {
          border: 'border-violet-500 bg-violet-50',
          header: 'bg-gradient-to-r from-violet-500 to-purple-600',
          badge: 'bg-violet-600'
        }
      default:
        return {
          border: 'border-purple-500 bg-purple-50',
          header: 'bg-purple-600',
          badge: 'bg-purple-500'
        }
    }
  }

  const timeSlotColors = getTimeSlotColors()

  // Border ve arka plan renkleri
  const getBorderClass = () => {
    if (hasCritical) return 'border-red-500 bg-red-50'
    if (hasIssues) return 'border-orange-400 bg-orange-50'
    if (isMixed) return 'border-fuchsia-500 bg-fuchsia-50' // MIXED için fuşya
    return timeSlotColors.border // Zaman dilimine göre
  }

  // Header rengi
  const getHeaderClass = () => {
    if (hasCritical) return 'bg-red-600'
    if (hasIssues) return 'bg-orange-500'
    if (isMixed) return 'bg-gradient-to-r from-yellow-500 via-fuchsia-500 to-blue-500' // MIXED için gradient
    return timeSlotColors.header // Zaman dilimine göre
  }

  // Badge rengi
  const getBadgeClass = () => {
    if (hasCritical) return 'bg-red-500'
    if (hasIssues) return 'bg-orange-400'
    if (isMixed) return 'bg-fuchsia-600'
    return timeSlotColors.badge // Zaman dilimine göre
  }

  // Zaman dilimi etiketi
  const getTimeSlotLabel = () => {
    if (isMixed) {
      // Hangi dilimleri içerdiğini göster
      const slotLabels = uniqueTimeSlots.map(slot => {
        if (slot === 'MORNING') return '🌅'
        if (slot === 'AFTERNOON') return '☀️'
        if (slot === 'EVENING') return '🌙'
        return slot
      }).join(' + ')
      return `MIXED ${slotLabels}`
    }
    return timeSlotInfo?.label || data.timeSlot
  }

  return (
    <div
      className={`relative rounded-2xl shadow-xl border-4 overflow-hidden ${getBorderClass()}`}
      style={{ minWidth: '340px', maxWidth: '380px' }}
    >
      {/* Uyarı Banner */}
      {hasIssues && (
        <div className={`px-3 py-2 text-xs font-semibold ${
          hasCritical ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <span>{hasCritical ? '⚠️ KRİTİK SORUN' : '⚡ DİKKAT'}</span>
            <span className="opacity-90">
              {criticalIssues.length > 0 && criticalIssues[0].message}
              {!hasCritical && issues[0].message}
            </span>
          </div>
        </div>
      )}

      {/* Grup Header */}
      <div className={`text-white px-4 py-2 flex items-center justify-between ${getHeaderClass()}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{data.orders.length}</span>
          <span className="text-sm opacity-90">Sipariş</span>
          {isMixed && !hasIssues && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">MIXED</span>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${getBadgeClass()}`}>
          {getTimeSlotLabel()}
        </span>
      </div>

      {/* Sol bağlantı noktası - gruba sipariş eklemek için */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-5 h-5 !bg-purple-500 !border-2 !border-white"
      />

      {/* Grup Fiyatı */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">Grup Fiyatı:</span>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-1">$</span>
          <input
            type="number"
            value={data.groupPrice || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0
              if (data.onGroupPriceChange) {
                data.onGroupPriceChange(data.groupId, value)
              }
            }}
            placeholder="0.00"
            className="w-24 text-sm px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      {/* Grup içindeki siparişler */}
      <div className="p-2 space-y-2">
        {data.orders.map((order, index) => {
          const pickupZip = extractZip(order.pickupAddress)
          const dropoffZip = extractZip(order.dropoffAddress)
          const hasProblem = problemOrderIndices.has(index)

          // Her siparişin kendi zaman dilimi
          const orderTimeSlot = order.timeSlot || data.timeSlot
          const orderSlotInfo = TIME_SLOTS[orderTimeSlot as keyof typeof TIME_SLOTS]
          const orderBaseColor = isMixed ? (orderSlotInfo?.color || baseColor) : baseColor

          // MIXED durumunda her sipariş kendi rengini alsın
          const getBorderColor = () => {
            if (hasProblem) return 'border-red-400 bg-red-100 hover:border-red-500'
            if (isMixed) return 'border-fuchsia-300 hover:border-fuchsia-500'
            return 'border-purple-200 hover:border-purple-400'
          }

          return (
            <div
              key={order.id}
              className={`relative rounded-xl p-3 border-2 shadow-sm transition-colors ${getBorderColor()}`}
              style={{ backgroundColor: hasProblem ? undefined : orderBaseColor }}
            >
              {/* Sıra numarası */}
              <div className={`absolute -top-2 -left-2 w-6 h-6 text-white rounded-full flex items-center justify-center text-xs font-bold shadow ${
                hasProblem ? 'bg-red-500' : 'bg-purple-600'
              }`}>
                {index + 1}
              </div>

              {/* Gruptan çıkar butonu */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  data.onRemoveFromGroup?.(order.id)
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow transition-colors"
                title="Gruptan çıkar"
              >
                ×
              </button>

              {/* Sipariş bilgileri - kompakt */}
              <div className="pl-4">
                {/* Order number + Time Slot (MIXED durumunda) */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-gray-500 truncate">
                    {order.orderNumber}
                  </span>
                  {isMixed && orderSlotInfo && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: orderSlotInfo.color,
                        color: '#374151'
                      }}
                    >
                      {orderTimeSlot === 'MORNING' ? '🌅' : orderTimeSlot === 'AFTERNOON' ? '☀️' : '🌙'}
                    </span>
                  )}
                </div>

                {/* Pickup */}
                <div className="flex items-center gap-1 text-xs mb-1">
                  <span className="text-blue-600 font-bold w-12 shrink-0">{order.pickupTime}</span>
                  {pickupZip && (
                    <span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[9px] font-semibold shrink-0">
                      {pickupZip}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-600 truncate" title={order.pickupAddress}>
                    {shortenAddress(order.pickupAddress)}
                  </span>
                </div>

                {/* Dropoff */}
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-green-600 font-bold w-12 shrink-0">{order.dropoffTime}</span>
                  {dropoffZip && (
                    <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[9px] font-semibold shrink-0">
                      {dropoffZip}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-600 truncate" title={order.dropoffAddress}>
                    {shortenAddress(order.dropoffAddress)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sürücü Seçimi - Arama özellikli dropdown */}
      <div className="px-3 pb-3">
        <SearchableDriverSelect
          drivers={data.drivers || []}
          selectedDriver={data.orders[0]?.driver || null}
          onSelect={(driverName) => {
            // Tüm siparişlere aynı sürücüyü ata
            data.orders.forEach(order => {
              data.onDriverSelect?.(order.id, driverName)
            })
          }}
          placeholder="Sürücü Seç (Tüm Grup)"
        />
      </div>

      {/* Sağ bağlantı noktası */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-5 h-5 !bg-green-500 !border-2 !border-white"
      />
    </div>
  )
}

export default memo(GroupNode)
