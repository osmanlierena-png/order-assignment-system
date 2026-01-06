'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

interface DriverNodeData {
  id: string
  name: string
  phone: string | null
  assignedOrders?: number
}

function DriverNode({ data, selected }: NodeProps<DriverNodeData>) {
  const initials = data.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const hasOrders = (data.assignedOrders || 0) > 0

  return (
    <div
      className={`
        px-4 py-3 rounded-2xl shadow-lg cursor-grab active:cursor-grabbing
        bg-gradient-to-br from-green-400 to-green-600
        transition-all duration-200 hover:shadow-xl hover:scale-[1.02]
        ${selected ? 'ring-4 ring-green-300' : ''}
      `}
      style={{ minWidth: '140px', maxWidth: '180px' }}
    >
      {/* Tüm kenarlardan bağlantı noktaları */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 !bg-white !border-2 !border-green-600"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-4 h-4 !bg-white !border-2 !border-green-600"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="w-4 h-4 !bg-white !border-2 !border-green-600"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 !bg-white !border-2 !border-green-600"
      />

      {/* Avatar ve isim */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-sm shadow-inner flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-xs truncate">
            {data.name}
          </div>
        </div>
      </div>

      {/* Atanan sipariş sayısı */}
      <div className="mt-2 flex items-center justify-center">
        <div className={`
          text-sm font-bold px-3 py-1 rounded-full
          ${hasOrders
            ? 'bg-white text-green-600'
            : 'bg-white/20 text-white/80'
          }
        `}>
          {data.assignedOrders || 0} sipariş
        </div>
      </div>
    </div>
  )
}

export default memo(DriverNode)
