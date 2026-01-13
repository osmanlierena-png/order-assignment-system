'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { STATUS_LABELS, TIME_SLOTS, RESPONSE_ICONS, RESPONSE_LABELS } from '@/lib/constants'
import SearchableDriverSelect from '@/components/ui/SearchableDriverSelect'

interface Driver {
  id: string
  name: string
  phone: string | null
}

interface OrderNodeData {
  id: string
  orderNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  timeSlot: string
  status: string
  driver: string | null
  groupId?: string | null
  groupIndex?: number // Grup içi sıra (1, 2, 3...)
  groupSize?: number  // Gruptaki toplam sipariş
  price?: number      // Sipariş fiyatı
  tipAmount?: number  // Tip miktarı (Base44 OCR'dan)
  priceAmount?: number // Toplam fiyat (Base44 OCR'dan)
  isHighValue?: boolean // Büyük sipariş ($500+)
  driverResponse?: 'ACCEPTED' | 'REJECTED' | null  // Sürücü yanıtı
  driverResponseTime?: string                       // Yanıt zamanı
  smsSent?: boolean                                  // SMS gönderildi mi?
  drivers?: Driver[]
  onDriverSelect?: (orderId: string, driverName: string) => void
  onPriceChange?: (orderId: string, price: number) => void
}

// Adresten ZIP kodunu çıkar ve vurgula
function formatAddress(address: string): { street: string; zip: string | null } {
  const zipMatch = address.match(/\b(\d{5})\b/)
  const zip = zipMatch ? zipMatch[1] : null
  // Sokak kısmını al (ZIP'e kadar)
  const street = address.replace(/,?\s*(DC|VA|MD)\s*\d{5}.*$/, '').trim()
  return { street, zip }
}

function OrderNode({ data, selected }: NodeProps<OrderNodeData>) {
  const [priceDetailsOpen, setPriceDetailsOpen] = useState(false)
  const timeSlotInfo = TIME_SLOTS[data.timeSlot as keyof typeof TIME_SLOTS]
  const baseColor = timeSlotInfo?.color || '#e5e7eb'

  // Adresleri formatla
  const pickup = formatAddress(data.pickupAddress)
  const dropoff = formatAddress(data.dropoffAddress)

  // Tip veya toplam fiyat var mı?
  const hasPriceDetails = (data.tipAmount && data.tipAmount > 0) || (data.priceAmount && data.priceAmount > 0)

  return (
    <div
      className={`
        relative px-3 py-2.5 rounded-xl shadow-lg cursor-grab active:cursor-grabbing
        transition-all duration-200 hover:shadow-xl hover:scale-[1.02]
        ${selected
          ? 'border-2 border-blue-500 ring-2 ring-blue-200'
          : 'border-2 border-gray-200 hover:border-blue-300'
        }
      `}
      style={{
        backgroundColor: baseColor,
        minWidth: '320px',
        maxWidth: '360px',
      }}
    >

      {/* Sol bağlantı noktası */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-4 h-4 !bg-blue-500 !border-2 !border-white"
      />

      {/* Büyük Sipariş Badge - Sol üst köşe ($500+) */}
      {data.isHighValue && (
        <div
          className="absolute -top-2 -left-2 w-6 h-6 flex items-center justify-center bg-amber-500 text-white rounded-full shadow-md z-10"
          title={`Büyük Sipariş: $${data.priceAmount?.toFixed(2) || '500+'}`}
        >
          <span className="text-xs">💎</span>
        </div>
      )}

      {/* Sürücü Yanıt Badge */}
      {data.driverResponse && (
        <div
          className={`
            absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md z-10
            ${data.driverResponse === 'ACCEPTED' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
          `}
          title={`${RESPONSE_LABELS[data.driverResponse]} - ${data.driverResponseTime ? new Date(data.driverResponseTime).toLocaleString('tr-TR') : ''}`}
        >
          {RESPONSE_ICONS[data.driverResponse]}
        </div>
      )}

      {/* Atandı Badge - Sürücü atanmış ama SMS gönderilmemiş */}
      {data.driver && !data.smsSent && !data.driverResponse && (
        <div
          className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md z-10 bg-blue-500 text-white"
          title="Sürücü atandı - SMS bekleniyor"
        >
          📋 ATANDI
        </div>
      )}

      {/* Yanıt Bekliyor Badge - SMS gönderilmiş ama yanıt yok */}
      {data.driver && data.smsSent && !data.driverResponse && (
        <div
          className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md z-10 bg-yellow-500 text-white"
          title="Sürücü yanıtı bekleniyor"
        >
          ⏳ BEKLİYOR
        </div>
      )}

      {/* Header - Order No ve Status */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-black/10">
        <div className="font-mono text-xs font-bold text-gray-800 truncate flex-1">
          {data.orderNumber}
        </div>
        <span className={`
          text-[10px] px-2 py-0.5 rounded-full font-medium
          ${data.status === 'PENDING' ? 'bg-yellow-400/80 text-yellow-900' : ''}
          ${data.status === 'ASSIGNED' ? 'bg-green-400/80 text-green-900' : ''}
          ${data.status === 'IN_TRANSIT' ? 'bg-blue-400/80 text-blue-900' : ''}
          ${data.status === 'DELIVERED' ? 'bg-gray-400/80 text-gray-900' : ''}
        `}>
          {STATUS_LABELS[data.status] || data.status}
        </span>
      </div>

      {/* Pickup */}
      <div className="mb-2">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-blue-600 text-sm">⬆</span>
          <span className="text-[10px] font-semibold text-blue-700 uppercase">Alış</span>
          {pickup.zip && (
            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded">
              {pickup.zip}
            </span>
          )}
          <span className="ml-auto text-xs font-bold text-blue-800">{data.pickupTime}</span>
        </div>
        <div className="text-[11px] text-gray-700 pl-5 leading-tight" title={data.pickupAddress}>
          {pickup.street}
        </div>
      </div>

      {/* Delivery */}
      <div className="mb-2">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-green-600 text-sm">⬇</span>
          <span className="text-[10px] font-semibold text-green-700 uppercase">Teslim</span>
          {dropoff.zip && (
            <span className="px-1.5 py-0.5 bg-green-600 text-white text-[9px] font-bold rounded">
              {dropoff.zip}
            </span>
          )}
          <span className="ml-auto text-xs font-bold text-green-800">{data.dropoffTime}</span>
        </div>
        <div className="text-[11px] text-gray-700 pl-5 leading-tight" title={data.dropoffAddress}>
          {dropoff.street}
        </div>
      </div>

      {/* Fiyat ve Sürücü Seçimi */}
      <div className="mt-2 pt-2 border-t border-black/10 space-y-2">
        {/* Fiyat Girişi ve Tip Tooltip */}
        <div>
          <div className="flex items-center gap-2">
            {/* Tip ikonu - hover'da tooltip */}
            {data.tipAmount && data.tipAmount > 0 ? (
              <div
                className="relative group cursor-pointer"
                title={`Tip: $${data.tipAmount.toFixed(2)}`}
              >
                <span className="text-amber-600 text-sm">🎁</span>
                {/* Tooltip */}
                <div className="absolute hidden group-hover:block -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
                  Tip: ${data.tipAmount.toFixed(2)}
                </div>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">🎁</span>
            )}
            <span className="text-green-600 text-sm">💰</span>
            <div className="flex items-center flex-1">
              <span className="text-xs text-gray-600 mr-1">$</span>
              <input
                type="number"
                value={data.price || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0
                  if (data.onPriceChange) {
                    data.onPriceChange(data.id, value)
                  }
                }}
                placeholder="0.00"
                className="w-20 text-sm px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                step="0.01"
                min="0"
              />
            </div>
            {/* Açılır panel butonu - sadece detay varsa göster */}
            {hasPriceDetails && (
              <button
                onClick={() => setPriceDetailsOpen(!priceDetailsOpen)}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
                title="Fiyat detaylarını göster"
              >
                <span>{priceDetailsOpen ? '▲' : '▼'}</span>
              </button>
            )}
          </div>

          {/* Açılır Fiyat Detayları Paneli */}
          {priceDetailsOpen && hasPriceDetails && (
            <div className="mt-2 p-2 bg-white/80 rounded-lg border border-gray-200 space-y-1 transition-all">
              {data.tipAmount && data.tipAmount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-amber-700">
                    <span>🎁</span> Tip:
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                    ${data.tipAmount.toFixed(2)}
                  </span>
                </div>
              )}
              {data.priceAmount && data.priceAmount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-green-700">
                    <span>📦</span> Toplam:
                  </span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                    ${data.priceAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sürücü Seçimi */}
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-sm">🚗</span>
          <div className="flex-1">
            <SearchableDriverSelect
              drivers={data.drivers || []}
              selectedDriver={data.driver}
              onSelect={(driverName) => {
                if (data.onDriverSelect) {
                  data.onDriverSelect(data.id, driverName)
                }
              }}
              placeholder="Sürücü Seç..."
            />
          </div>
        </div>

        {/* Reddedilmişse yeniden atama uyarısı */}
        {data.driverResponse === 'REJECTED' && (
          <div className="px-2 py-1.5 bg-red-100 border border-red-300 rounded text-xs text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>Sürücü reddetti - Yeniden atama gerekli</span>
          </div>
        )}
      </div>

      {/* Sağ bağlantı noktası */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-4 h-4 !bg-green-500 !border-2 !border-white"
      />
    </div>
  )
}

export default memo(OrderNode)
