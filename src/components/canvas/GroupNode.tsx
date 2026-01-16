'use client'

import { memo, useMemo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { TIME_SLOTS, RESPONSE_ICONS, RESPONSE_LABELS } from '@/lib/constants'
import SearchableDriverSelect from '@/components/ui/SearchableDriverSelect'
import DrivingTimeIndicator from './DrivingTimeIndicator'
import type { GroupSource } from '@/types/order'

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
  pickupLat?: number | null
  pickupLng?: number | null
  dropoffLat?: number | null
  dropoffLng?: number | null
  status: string
  driver: string | null
  timeSlot?: string // Her siparişin kendi zaman dilimi
  price?: number    // Sipariş fiyatı
  tipAmount?: number  // Tip miktarı (Base44 OCR'dan)
  priceAmount?: number // Toplam fiyat (Base44 OCR'dan)
  isHighValue?: boolean // Büyük sipariş ($500+)
  driverResponse?: 'ACCEPTED' | 'REJECTED' | null  // Sürücü yanıtı
  driverResponseTime?: string                       // Yanıt zamanı
  smsSent?: boolean                                  // SMS gönderildi mi?
}

interface GroupNodeData {
  groupId: string
  timeSlot: string
  orders: OrderInGroup[]
  groupPrice?: number // Grup toplam fiyatı
  groupSource?: GroupSource // Grup kaynağı: sistem mi manuel mi
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
  const [priceDetailsOpen, setPriceDetailsOpen] = useState(false)

  // Grup toplam tip ve fiyat hesapla
  const groupTotals = useMemo(() => {
    let totalTip = 0
    let totalPriceAmount = 0
    data.orders.forEach(order => {
      if (order.tipAmount) totalTip += order.tipAmount
      if (order.priceAmount) totalPriceAmount += order.priceAmount
    })
    return { totalTip, totalPriceAmount }
  }, [data.orders])

  const hasGroupPriceDetails = groupTotals.totalTip > 0 || groupTotals.totalPriceAmount > 0

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

  // Grup yanıt durumu hesapla
  const groupResponseStatus = useMemo(() => {
    const responses = data.orders.map(o => o.driverResponse).filter(Boolean)
    const hasRejection = responses.includes('REJECTED')
    const allAccepted = responses.length === data.orders.length && responses.every(r => r === 'ACCEPTED')

    // SMS gönderildi mi kontrol et (gruptaki herhangi birinde smsSent=true ise)
    const smsSent = data.orders.some(o => o.smsSent)

    // Sürücü atanmış mı kontrol et
    const hasDriver = data.orders.some(o => o.driver)

    // Sadece SMS gönderilmişse "Yanıt Bekliyor" göster
    const pendingResponse = smsSent && data.orders.some(o => o.driver && !o.driverResponse)

    if (hasRejection) return 'REJECTED'
    if (allAccepted) return 'ACCEPTED'
    if (pendingResponse) return 'PENDING_RESPONSE'
    if (hasDriver && !smsSent) return 'ASSIGNED' // Atandı ama SMS henüz gönderilmedi
    return null
  }, [data.orders])

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
      className={`relative rounded-2xl shadow-xl border-4 overflow-visible ${getBorderClass()}`}
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
          {/* Grup Yanıt Durumu Badge */}
          {groupResponseStatus === 'REJECTED' && (
            <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow">
              ❌ RED
            </span>
          )}
          {groupResponseStatus === 'ACCEPTED' && (
            <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold shadow">
              ✅ ONAYLANDI
            </span>
          )}
          {groupResponseStatus === 'PENDING_RESPONSE' && (
            <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full font-bold shadow">
              ⏳ YANIT BEKLİYOR
            </span>
          )}
          {groupResponseStatus === 'ASSIGNED' && (
            <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold shadow">
              📋 ATANDI
            </span>
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
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-black">Grup Fiyatı:</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-black">$</span>
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
              className="w-24 text-sm px-2 py-1 border border-gray-300 rounded bg-white text-black focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold"
              step="0.01"
              min="0"
            />
            {/* Açılır panel butonu */}
            {hasGroupPriceDetails && (
              <button
                onClick={() => setPriceDetailsOpen(!priceDetailsOpen)}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
                title="Fiyat detaylarını göster"
              >
                <span>{priceDetailsOpen ? '▲' : '▼'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Açılır Fiyat Detayları Paneli */}
        {priceDetailsOpen && hasGroupPriceDetails && (
          <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 space-y-1">
            {groupTotals.totalTip > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-amber-700">
                  <span>🎁</span> Toplam Tip:
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                  ${groupTotals.totalTip.toFixed(2)}
                </span>
              </div>
            )}
            {groupTotals.totalPriceAmount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-green-700">
                  <span>📦</span> Toplam Fiyat:
                </span>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                  ${groupTotals.totalPriceAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grup içindeki siparişler */}
      <div className="p-2 space-y-1">
        {data.orders.map((order, index) => {
          const pickupZip = extractZip(order.pickupAddress)
          const dropoffZip = extractZip(order.dropoffAddress)
          const hasProblem = problemOrderIndices.has(index)

          // Önceki sipariş (sürüş süresi göstergesi için)
          const prevOrder = index > 0 ? data.orders[index - 1] : null

          // Buffer hesapla (önceki dropoff ile şimdiki pickup arası)
          const bufferMinutes = prevOrder
            ? timeToMinutes(order.pickupTime) - timeToMinutes(prevOrder.dropoffTime)
            : 0

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
            <div key={order.id}>
              {/* Sürüş Süresi Göstergesi - önceki sipariş varsa göster */}
              {prevOrder && (
                <DrivingTimeIndicator
                  fromOrder={{
                    dropoffAddress: prevOrder.dropoffAddress,
                    dropoffTime: prevOrder.dropoffTime,
                    dropoffLat: prevOrder.dropoffLat,
                    dropoffLng: prevOrder.dropoffLng
                  }}
                  toOrder={{
                    pickupAddress: order.pickupAddress,
                    pickupTime: order.pickupTime,
                    pickupLat: order.pickupLat,
                    pickupLng: order.pickupLng
                  }}
                  bufferMinutes={bufferMinutes}
                  groupSource={data.groupSource || 'manual'}
                />
              )}

              {/* Sipariş Kartı */}
              <div
                className={`relative rounded-xl p-3 border-2 shadow-sm transition-colors ${getBorderColor()}`}
                style={{ backgroundColor: hasProblem ? undefined : orderBaseColor }}
              >
                {/* Sıra numarası */}
                <div className={`absolute -top-2 -left-2 w-6 h-6 text-white rounded-full flex items-center justify-center text-xs font-bold shadow ${
                  hasProblem ? 'bg-red-500' : 'bg-purple-600'
                }`}>
                  {index + 1}
                </div>

                {/* Büyük Sipariş Badge ($500+) */}
                {order.isHighValue && (
                  <div
                    className="absolute -top-2 left-6 w-5 h-5 flex items-center justify-center bg-amber-500 text-white rounded-full shadow-md z-10"
                    title={`Büyük Sipariş: $${order.priceAmount?.toFixed(2) || '500+'}`}
                  >
                    <span className="text-[10px]">💎</span>
                  </div>
                )}

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
                  {/* Order number + Time Slot (MIXED durumunda) + Tip Tooltip */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-black truncate">
                      {order.orderNumber}
                    </span>
                    {/* Tip ikonu - hover'da tooltip */}
                    {order.tipAmount && order.tipAmount > 0 && (
                      <div
                        className="relative group cursor-pointer"
                        title={`Tip: $${order.tipAmount.toFixed(2)}`}
                      >
                        <span className="text-amber-600 text-[10px]">🎁</span>
                        {/* Tooltip */}
                        <div className="absolute hidden group-hover:block -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 text-white text-[9px] rounded shadow-lg whitespace-nowrap z-50">
                          Tip: ${order.tipAmount.toFixed(2)}
                        </div>
                      </div>
                    )}
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
                    <span className="text-[9px] text-black truncate" title={order.pickupAddress}>
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
                    <span className="text-[9px] text-black truncate" title={order.dropoffAddress}>
                      {shortenAddress(order.dropoffAddress)}
                    </span>
                  </div>
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
          selectedDriver={groupResponseStatus === 'REJECTED' ? null : (data.orders[0]?.driver || null)}
          onSelect={(driverName) => {
            // Tüm siparişlere aynı sürücüyü ata
            data.orders.forEach(order => {
              data.onDriverSelect?.(order.id, driverName)
            })
          }}
          placeholder={groupResponseStatus === 'REJECTED' ? "Yeni Sürücü Seç" : "Sürücü Seç (Tüm Grup)"}
        />

        {/* Grup Reddedilmişse Uyarı */}
        {groupResponseStatus === 'REJECTED' && (
          <div className="mt-2 px-2 py-1.5 bg-red-100 border border-red-300 rounded text-xs text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>Grup reddedildi - Yeniden atama gerekli</span>
          </div>
        )}
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
