'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { STATUS_LABELS, TIME_SLOTS } from '@/lib/constants'
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
  drivers?: Driver[]
  onDriverSelect?: (orderId: string, driverName: string) => void
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
  const timeSlotInfo = TIME_SLOTS[data.timeSlot as keyof typeof TIME_SLOTS]
  const baseColor = timeSlotInfo?.color || '#e5e7eb'

  // Adresleri formatla
  const pickup = formatAddress(data.pickupAddress)
  const dropoff = formatAddress(data.dropoffAddress)

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

      {/* Sürücü Seçimi - Arama özellikli */}
      <div className="mt-2 pt-2 border-t border-black/10">
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
