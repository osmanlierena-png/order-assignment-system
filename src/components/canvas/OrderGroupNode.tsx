'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { TIME_SLOTS } from '@/lib/constants'

interface OrderInGroup {
  id: string
  orderNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
}

interface OrderGroupNodeData {
  id: string
  name: string | null
  timeSlot: string
  orderCount: number
  driverName: string | null
  orders?: OrderInGroup[]
  onRemoveOrder?: (orderId: string) => void
}

// Adresten ZIP kodunu çıkar
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

// Adresten sokak kısmını al
function getStreet(address: string): string {
  return address.replace(/,?\s*(DC|VA|MD)\s*\d{5}.*$/, '').trim()
}

function OrderGroupNode({ data, selected }: NodeProps<OrderGroupNodeData>) {
  const timeSlotInfo = TIME_SLOTS[data.timeSlot as keyof typeof TIME_SLOTS]
  const bgColor = timeSlotInfo?.color || '#e5e7eb'

  const handleRemoveOrder = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (data.onRemoveOrder) {
      data.onRemoveOrder(orderId)
    }
  }

  return (
    <div
      className={`
        px-3 py-2 rounded-xl border-2 shadow-lg cursor-grab active:cursor-grabbing
        ${selected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-300'}
      `}
      style={{ backgroundColor: bgColor, minWidth: '340px', maxWidth: '380px' }}
    >
      {/* Sol bağlantı noktası */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-4 h-4 !bg-purple-500"
      />

      {/* Başlık satırı */}
      <div className="flex items-center gap-3 mb-2 pb-2 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="font-semibold text-gray-800 text-sm">
            {data.name || `Grup`}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
            {data.orderCount} sipariş
          </span>
        </div>
        <span className="px-2 py-0.5 text-xs rounded-full bg-white/50">
          {timeSlotInfo?.label || data.timeSlot}
        </span>
        {data.driverName && (
          <span className="ml-auto text-xs font-medium text-green-700">
            Sürücü: {data.driverName}
          </span>
        )}
      </div>

      {/* Siparişler - adres bilgisiyle */}
      {data.orders && data.orders.length > 0 && (
        <div className="space-y-2">
          {data.orders.map((order) => {
            const pickupZip = extractZip(order.pickupAddress)
            const dropoffZip = extractZip(order.dropoffAddress)
            return (
              <div key={order.id} className="bg-white/80 rounded-lg px-2.5 py-2 border border-gray-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[11px] font-bold text-gray-800">
                    {order.orderNumber}
                  </span>
                  {data.onRemoveOrder && (
                    <button
                      onClick={(e) => handleRemoveOrder(e, order.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200"
                      title="Gruptan çıkar"
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* Alış */}
                <div className="flex items-center gap-1 text-[10px] mb-1">
                  <span className="text-blue-600 font-medium">⬆ {order.pickupTime}</span>
                  {pickupZip && (
                    <span className="px-1 bg-blue-500 text-white text-[8px] font-bold rounded">{pickupZip}</span>
                  )}
                </div>
                <div className="text-[9px] text-gray-600 pl-3 mb-1.5 leading-tight" title={order.pickupAddress}>
                  {getStreet(order.pickupAddress)}
                </div>
                {/* Teslim */}
                <div className="flex items-center gap-1 text-[10px] mb-1">
                  <span className="text-green-600 font-medium">⬇ {order.dropoffTime}</span>
                  {dropoffZip && (
                    <span className="px-1 bg-green-500 text-white text-[8px] font-bold rounded">{dropoffZip}</span>
                  )}
                </div>
                <div className="text-[9px] text-gray-600 pl-3 leading-tight" title={order.dropoffAddress}>
                  {getStreet(order.dropoffAddress)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sürücü atanmamışsa */}
      {!data.driverName && (
        <div className="mt-2 pt-1 text-xs text-gray-500 italic">
          Sürücü atanmamış - gruba sürükleyerek atayın
        </div>
      )}

      {/* Sağ bağlantı noktası */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-4 h-4 !bg-purple-500"
      />
    </div>
  )
}

export default memo(OrderGroupNode)
