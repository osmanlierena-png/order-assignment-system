'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import ReactFlow, {
  Node,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'

import OrderNode from './OrderNode'
import GroupNode from './GroupNode'

const nodeTypes = {
  order: OrderNode,
  group: GroupNode,
}

interface Order {
  id: string
  orderNumber: string
  driver: string | null
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  timeSlot: string
  status: string
  groupId: string | null
  orderDate?: string // ISO date string
  price?: number          // Sipariş fiyatı ($)
  groupPrice?: number     // Grup fiyatı
}

interface OrderGroup {
  id: string
  name: string | null
  timeSlot: string
  orderCount: number
  driverName: string | null
}

interface Driver {
  id: string
  name: string
  phone: string | null
}

interface AssignmentCanvasProps {
  orders: Order[]
  groups: OrderGroup[]
  drivers: Driver[]
  onAssign: (orderId: string, driverId: string) => void
  onGroupAssign: (groupId: string, driverId: string) => void
  onRemoveFromGroup?: (orderId: string) => void
  onMergeOrders?: (sourceOrderId: string, targetOrderId: string | null, targetGroupId: string | null) => void
  onPriceChange?: (orderId: string, price: number) => void
  onGroupPriceChange?: (groupId: string, groupPrice: number) => void
}

function AssignmentCanvasInner({
  orders,
  // groups, // Not currently used but kept for future features
  drivers,
  onAssign,
  // onGroupAssign, // Not currently used but kept for future features
  onRemoveFromGroup,
  onMergeOrders,
  onPriceChange,
  onGroupPriceChange,
}: AssignmentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Node pozisyonlarını kaydet (birleştirme sonrası korunsun)
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({})

  // Filtreler
  const [dateFilter, setDateFilter] = useState<string>('ALL')
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [groupFilter, setGroupFilter] = useState<string>('ALL') // ALL, GROUPED, UNGROUPED, MIXED

  // useReactFlow hook - güncel node'ları almak için
  const { getNodes, fitView } = useReactFlow()

  // Benzersiz tarihleri çıkar (dropdown için)
  const availableDates = useMemo(() => {
    const dates = new Set<string>()
    orders.forEach(order => {
      if (order.orderDate) {
        // ISO string'den sadece tarih kısmını al (YYYY-MM-DD)
        const dateStr = order.orderDate.split('T')[0]
        dates.add(dateStr)
      }
    })
    // Tarihleri sırala (en yeni önce)
    return Array.from(dates).sort((a, b) => b.localeCompare(a))
  }, [orders])

  // Tarih formatla (Türkçe gün adı ile)
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr)
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    const dayName = days[date.getDay()]
    const day = date.getDate()
    const month = date.getMonth() + 1
    return `${dayName} ${day}/${month}`
  }

  // MIXED grupları tespit et (farklı zaman dilimlerinden siparişler içeren gruplar)
  const mixedGroupIds = useMemo(() => {
    const groupTimeSlots = new Map<string, Set<string>>()

    // Her grubun hangi zaman dilimlerinden sipariş içerdiğini bul
    orders.forEach(order => {
      if (order.groupId) {
        if (!groupTimeSlots.has(order.groupId)) {
          groupTimeSlots.set(order.groupId, new Set())
        }
        groupTimeSlots.get(order.groupId)!.add(order.timeSlot)
      }
    })

    // 2 veya daha fazla farklı zaman dilimi içeren grupları MIXED olarak işaretle
    const mixedIds = new Set<string>()
    groupTimeSlots.forEach((slots, groupId) => {
      if (slots.size > 1) {
        mixedIds.add(groupId)
      }
    })

    return mixedIds
  }, [orders])

  // Filtrelenmiş siparişler - useMemo ile memoize et
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Tarih filtresi
      if (dateFilter !== 'ALL') {
        const orderDateStr = order.orderDate?.split('T')[0] || ''
        if (orderDateStr !== dateFilter) return false
      }
      if (timeSlotFilter !== 'ALL' && order.timeSlot !== timeSlotFilter) return false
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false
      if (groupFilter === 'GROUPED' && !order.groupId) return false
      if (groupFilter === 'UNGROUPED' && order.groupId) return false
      // MIXED filtresi - sadece mixed gruplardaki siparişleri göster
      if (groupFilter === 'MIXED') {
        if (!order.groupId) return false
        if (!mixedGroupIds.has(order.groupId)) return false
      }
      return true
    })
  }, [orders, dateFilter, timeSlotFilter, statusFilter, groupFilter, mixedGroupIds])

  // Node'ları oluştur
  useEffect(() => {
    const newNodes: Node[] = []

    // LAYOUT: Zaman dilimine göre 3 kolon
    const ORDER_START_X = 20
    const COLUMN_WIDTH = 400 // Biraz daha dar kolonlar
    const GAP = 20 // Node'lar arası boşluk (küçültüldü)
    const ORDER_HEIGHT = 160 // Tekil sipariş yüksekliği (küçültüldü)
    const GROUP_BASE_HEIGHT = 100 // Grup header + padding (küçültüldü)
    const GROUP_ORDER_HEIGHT = 75 // Grup içi her sipariş için (küçültüldü)

    const getOrderX = (timeSlot: string) => {
      if (timeSlot === 'MORNING') return ORDER_START_X
      if (timeSlot === 'AFTERNOON') return ORDER_START_X + COLUMN_WIDTH
      return ORDER_START_X + COLUMN_WIDTH * 2
    }

    // Siparişleri grupla
    const groupedOrders = new Map<string, typeof filteredOrders>()
    const ungroupedOrders: typeof filteredOrders = []

    filteredOrders.forEach(order => {
      if (order.groupId) {
        const existing = groupedOrders.get(order.groupId) || []
        existing.push(order)
        groupedOrders.set(order.groupId, existing)
      } else {
        ungroupedOrders.push(order)
      }
    })

    // Y tracker - zaman dilimine göre (başlık için 60px boşluk bırak)
    const yTracker: Record<string, number> = { MORNING: 80, AFTERNOON: 80, EVENING: 80 }

    // KOLON BAŞLIKLARI - Sabit node'lar olarak ekle (her biri farklı renk)
    const columnHeaders = [
      {
        id: 'header-morning',
        label: '🌅 Sabah (06:00-12:00)',
        x: ORDER_START_X,
        count: filteredOrders.filter(o => o.timeSlot === 'MORNING').length,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' // Turuncu-amber
      },
      {
        id: 'header-afternoon',
        label: '☀️ Öğlen (12:00-17:00)',
        x: ORDER_START_X + COLUMN_WIDTH,
        count: filteredOrders.filter(o => o.timeSlot === 'AFTERNOON').length,
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' // Mavi
      },
      {
        id: 'header-evening',
        label: '🌙 Akşam (17:00-23:00)',
        x: ORDER_START_X + COLUMN_WIDTH * 2,
        count: filteredOrders.filter(o => o.timeSlot === 'EVENING').length,
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' // Mor-violet
      },
    ]

    columnHeaders.forEach(header => {
      newNodes.push({
        id: header.id,
        type: 'default',
        position: { x: header.x, y: 10 },
        data: { label: `${header.label} (${header.count})` },
        draggable: false,
        selectable: false,
        style: {
          background: header.gradient,
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 'bold',
          minWidth: '180px',
          textAlign: 'center' as const,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        },
      })
    })

    // Zaman parse fonksiyonu
    const parseTime = (time: string): number => {
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
      if (!match) return 0
      let hours = parseInt(match[1])
      const minutes = parseInt(match[2])
      const period = match[3]?.toUpperCase()
      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0
      return hours * 60 + minutes
    }

    // GRUPLU SİPARİŞLER - Her grup tek bir GroupNode
    groupedOrders.forEach((groupOrdersList, groupId) => {
      // Grup içindeki siparişleri pickup zamanına göre sırala
      groupOrdersList.sort((a, b) => parseTime(a.pickupTime) - parseTime(b.pickupTime))

      // Grubun zaman dilimini belirle (ilk siparişin dilimi)
      const timeSlot = groupOrdersList[0].timeSlot
      const nodeId = `group-${groupId}`

      // Kaydedilmiş pozisyon var mı kontrol et
      const savedPos = savedPositions[nodeId]
      const x = savedPos?.x ?? getOrderX(timeSlot)
      const y = savedPos?.y ?? yTracker[timeSlot]

      // Grup yüksekliğini hesapla
      const groupHeight = GROUP_BASE_HEIGHT + (groupOrdersList.length * GROUP_ORDER_HEIGHT)

      newNodes.push({
        id: nodeId,
        type: 'group',
        position: { x, y },
        data: {
          groupId,
          timeSlot,
          orders: groupOrdersList.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            pickupTime: o.pickupTime,
            pickupAddress: o.pickupAddress,
            dropoffTime: o.dropoffTime,
            dropoffAddress: o.dropoffAddress,
            status: o.status,
            driver: o.driver,
            timeSlot: o.timeSlot, // Her sipariş için zaman dilimi
            price: o.price,
          })),
          groupPrice: groupOrdersList[0]?.groupPrice,
          drivers: drivers,
          onDriverSelect: onAssign,
          onRemoveFromGroup: onRemoveFromGroup,
          onPriceChange: onPriceChange,
          onGroupPriceChange: onGroupPriceChange,
        },
      })

      // Y tracker güncelle (sadece kaydedilmiş pozisyon yoksa)
      if (!savedPos) {
        yTracker[timeSlot] = y + groupHeight + GAP
      }
    })

    // GRUPSUZ SİPARİŞLER - Her biri ayrı OrderNode
    ungroupedOrders.forEach((order) => {
      const nodeId = `order-${order.id}`

      // Kaydedilmiş pozisyon var mı kontrol et
      const savedPos = savedPositions[nodeId]
      const x = savedPos?.x ?? getOrderX(order.timeSlot)
      const y = savedPos?.y ?? yTracker[order.timeSlot]

      newNodes.push({
        id: nodeId,
        type: 'order',
        position: { x, y },
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          pickupTime: order.pickupTime,
          pickupAddress: order.pickupAddress,
          dropoffTime: order.dropoffTime,
          dropoffAddress: order.dropoffAddress,
          timeSlot: order.timeSlot,
          status: order.status,
          driver: order.driver,
          groupId: null,
          price: order.price,
          drivers: drivers,
          onDriverSelect: onAssign,
          onPriceChange: onPriceChange,
        },
      })

      // Y tracker güncelle (sadece kaydedilmiş pozisyon yoksa)
      if (!savedPos) {
        yTracker[order.timeSlot] += ORDER_HEIGHT
      }
    })

    setNodes(newNodes)
    setEdges([])
  }, [filteredOrders, drivers, setNodes, setEdges, onAssign, onRemoveFromGroup, onPriceChange, onGroupPriceChange, savedPositions])

  // Node değişikliklerini takip et ve pozisyonları kaydet
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes)

    // Pozisyon değişikliklerini kaydet
    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        // Sadece sürükleme bittiğinde kaydet
        setSavedPositions(prev => ({
          ...prev,
          [change.id]: { x: change.position!.x, y: change.position!.y }
        }))
      }
    })
  }, [onNodesChange])

  // onConnect artık kullanılmıyor - sürücü ataması dropdown ile yapılıyor
  const onConnect = useCallback(
    (_connection: Connection) => {
      // Artık kullanılmıyor
    },
    []
  )

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, draggedNode: Node) => {
      // Defensive check
      if (!draggedNode || !draggedNode.position) return

      // Her durumda pozisyonu kaydet
      setSavedPositions(prev => ({
        ...prev,
        [draggedNode.id]: { x: draggedNode.position.x, y: draggedNode.position.y }
      }))

      // Sadece order node'ları için birleştirme işlemi yap (grupsuz siparişler)
      if (!draggedNode.id.startsWith('order-')) return

      const draggedPos = draggedNode.position
      const sourceOrderId = draggedNode.id.replace('order-', '')

      // Güncel node listesi
      const currentNodes = getNodes()
      if (currentNodes.length === 0) return

      // Threshold
      const OVERLAP_THRESHOLD_X = 150
      const OVERLAP_THRESHOLD_Y = 200

      // Önce grup node'larına çakışma kontrolü
      for (const node of currentNodes) {
        if (node.id === draggedNode.id || !node.position) continue

        // Grup node'una sürüklenmiş mi?
        if (node.id.startsWith('group-')) {
          const dx = Math.abs(draggedPos.x - node.position.x)
          const dy = draggedPos.y - node.position.y // Y için işaretli fark

          // Grubun üzerine veya yakınına bırakıldı mı?
          if (dx < OVERLAP_THRESHOLD_X && dy > -50 && dy < 400) {
            const targetGroupId = node.id.replace('group-', '')
            // Grubun pozisyonunu kaydet (birleştirme sonrası korunsun)
            setSavedPositions(prev => ({
              ...prev,
              [`group-${targetGroupId}`]: { x: node.position!.x, y: node.position!.y }
            }))
            // Gruba ekle
            onMergeOrders?.(sourceOrderId, null, targetGroupId)
            return
          }
        }

        // Başka bir tekil siparişe sürüklenmiş mi?
        if (node.id.startsWith('order-')) {
          const dx = Math.abs(draggedPos.x - node.position.x)
          const dy = Math.abs(draggedPos.y - node.position.y)

          if (dx < OVERLAP_THRESHOLD_X && dy < OVERLAP_THRESHOLD_Y) {
            const targetOrderId = node.id.replace('order-', '')
            if (targetOrderId !== sourceOrderId) {
              // Yeni grup için hedef siparişin pozisyonunu kullan
              setSavedPositions(prev => ({
                ...prev,
                // Yeni grup oluşturulacak - hedef siparişin pozisyonunu kullanacak
                // (grup id'si henüz bilinmiyor, API response sonrası ayarlanacak)
                [`merge-target-${targetOrderId}`]: { x: node.position!.x, y: node.position!.y }
              }))
              // İki tekil siparişi birleştir
              onMergeOrders?.(sourceOrderId, targetOrderId, null)
              return
            }
          }
        }
      }

      // Çakışma yok - node'un pozisyonu zaten kaydedildi
    },
    [onMergeOrders, getNodes]
  )

  // İstatistikler
  const groupCount = [...new Set(orders.filter(o => o.groupId).map(o => o.groupId))].length

  return (
    <div className="w-full h-[calc(100vh-120px)] min-h-[600px] bg-gray-50 rounded-xl border border-gray-200 shadow-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
        <Controls />

        {/* Filtreler - sol üst */}
        <Panel position="top-left" className="flex items-center gap-2 flex-wrap">
          {/* Tarih Filtresi - EN ÖNEMLİ */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-blue-50 border-2 border-blue-300 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-800"
          >
            <option value="ALL">Tüm Günler</option>
            {availableDates.map(date => (
              <option key={date} value={date}>
                {formatDateLabel(date)}
              </option>
            ))}
          </select>

          <span className="text-gray-300">|</span>

          {/* Zaman Dilimi + Grup Durumu Kombinasyonu */}
          <select
            value={`${timeSlotFilter}-${groupFilter}`}
            onChange={(e) => {
              const [time, group] = e.target.value.split('-')
              setTimeSlotFilter(time)
              setGroupFilter(group)
            }}
            className="bg-gradient-to-r from-yellow-50 to-purple-50 border-2 border-purple-300 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold text-purple-800"
          >
            <optgroup label="📋 Tümü">
              <option value="ALL-ALL">Tüm Siparişler</option>
              <option value="ALL-GROUPED">📁 Tüm Gruplu</option>
              <option value="ALL-UNGROUPED">📄 Tüm Tekil</option>
              <option value="ALL-MIXED">🎨 MIXED Gruplar</option>
            </optgroup>
            <optgroup label="🌅 Sabah">
              <option value="MORNING-ALL">🌅 Sabah - Tümü</option>
              <option value="MORNING-GROUPED">🌅 Sabah - Gruplu</option>
              <option value="MORNING-UNGROUPED">🌅 Sabah - Tekil</option>
            </optgroup>
            <optgroup label="☀️ Öğlen">
              <option value="AFTERNOON-ALL">☀️ Öğlen - Tümü</option>
              <option value="AFTERNOON-GROUPED">☀️ Öğlen - Gruplu</option>
              <option value="AFTERNOON-UNGROUPED">☀️ Öğlen - Tekil</option>
            </optgroup>
            <optgroup label="🌙 Akşam">
              <option value="EVENING-ALL">🌙 Akşam - Tümü</option>
              <option value="EVENING-GROUPED">🌙 Akşam - Gruplu</option>
              <option value="EVENING-UNGROUPED">🌙 Akşam - Tekil</option>
            </optgroup>
          </select>

          {/* Durum */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-green-50 border-2 border-green-300 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-green-800"
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="PENDING">⏳ Beklemede</option>
            <option value="ASSIGNED">✅ Atandı</option>
            <option value="IN_TRANSIT">🚗 Yolda</option>
            <option value="DELIVERED">📦 Teslim</option>
          </select>

          {/* Filtre aktif göstergesi */}
          {(dateFilter !== 'ALL' || timeSlotFilter !== 'ALL' || statusFilter !== 'ALL' || groupFilter !== 'ALL') && (
            <button
              onClick={() => {
                setDateFilter('ALL')
                setTimeSlotFilter('ALL')
                setStatusFilter('ALL')
                setGroupFilter('ALL')
              }}
              className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200"
            >
              Temizle
            </button>
          )}
        </Panel>

        {/* Özet bilgi - sağ üst */}
        <Panel position="top-right" className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm text-xs flex items-center gap-4">
          <span className="text-gray-600">
            <b className="text-blue-600">{filteredOrders.length}</b>/{orders.length} sipariş
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">
            <b className="text-green-600">{drivers.length}</b> sürücü
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">
            <b className="text-purple-600">{groupCount}</b> grup
          </span>
          {mixedGroupIds.size > 0 && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">
                <b className="text-fuchsia-600">{mixedGroupIds.size}</b> mixed
              </span>
            </>
          )}
        </Panel>

        {/* Kontroller */}
        <Panel position="bottom-center" className="flex gap-2">
          <button
            onClick={() => fitView({ padding: 0.2 })}
            className="bg-white/80 hover:bg-white px-3 py-1.5 rounded text-xs text-gray-600 shadow-sm"
          >
            Görünümü Sığdır
          </button>
          <div className="bg-white/80 px-3 py-1.5 rounded text-xs text-gray-500 shadow-sm">
            Üst üste sürükle = Birleştir • Boş alana = Ayır • Dropdown = Sürücü Ata
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default function AssignmentCanvas(props: AssignmentCanvasProps) {
  return (
    <ReactFlowProvider>
      <AssignmentCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
