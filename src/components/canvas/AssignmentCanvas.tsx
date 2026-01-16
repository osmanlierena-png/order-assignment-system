'use client'

import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
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
  tipAmount?: number      // Tip miktarı (Base44 OCR'dan)
  priceAmount?: number    // Toplam fiyat (Base44 OCR'dan)
  isHighValue?: boolean   // Büyük sipariş ($500+)
  driverResponse?: 'ACCEPTED' | 'REJECTED' | null  // Sürücü yanıtı
  driverResponseTime?: string                       // Yanıt zamanı
  smsSent?: boolean                                  // SMS gönderildi mi?
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
  selectedDate?: string | null  // Pozisyon kaydetme için tarih
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
  selectedDate,
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
  const [positionsLoaded, setPositionsLoaded] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Filtreler
  const [dateFilter, setDateFilter] = useState<string>('ALL')
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [groupFilter, setGroupFilter] = useState<string>('ALL') // ALL, GROUPED, UNGROUPED, MIXED
  const [responseFilter, setResponseFilter] = useState<string>('ALL') // ALL, PENDING_RESPONSE, ACCEPTED, REJECTED
  const [assignmentFilter, setAssignmentFilter] = useState<string>('UNASSIGNED') // UNASSIGNED (varsayılan), ASSIGNED, ALL

  // Arama
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResult, setSearchResult] = useState<{ found: boolean; nodeId: string | null; message: string } | null>(null)

  // Gizli tip gösterimi - Ara butonuna 3 kere hızlıca basınca aktif olur
  const [showSecretTips, setShowSecretTips] = useState<boolean>(false)
  const secretClickCount = useRef<number>(0)
  const secretClickTimer = useRef<NodeJS.Timeout | null>(null)

  // useReactFlow hook - güncel node'ları almak için
  const { getNodes, fitView, setCenter } = useReactFlow()

  // Sipariş arama fonksiyonu
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResult(null)
      return
    }

    const query = searchQuery.trim().toLowerCase()

    // Önce tüm siparişlerde ara (filtreden bağımsız)
    const foundOrder = orders.find(order =>
      order.orderNumber.toLowerCase().includes(query) ||
      order.pickupAddress.toLowerCase().includes(query) ||
      order.dropoffAddress.toLowerCase().includes(query)
    )

    if (!foundOrder) {
      setSearchResult({ found: false, nodeId: null, message: `"${searchQuery}" bulunamadı` })
      return
    }

    // Node ID'sini belirle (grup içinde mi, tekil mi?)
    let nodeId: string
    if (foundOrder.groupId) {
      nodeId = `group-${foundOrder.groupId}`
    } else {
      nodeId = `order-${foundOrder.id}`
    }

    // Filtreleri temizle ki node görünsün
    setDateFilter('ALL')
    setTimeSlotFilter('ALL')
    setStatusFilter('ALL')
    setGroupFilter('ALL')
    setResponseFilter('ALL')
    setAssignmentFilter('ALL')

    // Kısa bir gecikme ile node'a odaklan (filtrelerin uygulanması için)
    setTimeout(() => {
      const currentNodes = getNodes()
      const targetNode = currentNodes.find(n => n.id === nodeId)

      if (targetNode) {
        // Node'un merkezine git
        setCenter(
          targetNode.position.x + 180, // Node genişliğinin yarısı
          targetNode.position.y + 100, // Node yüksekliğinin yarısı
          { zoom: 1, duration: 500 }
        )
        setSearchResult({
          found: true,
          nodeId,
          message: `✅ ${foundOrder.orderNumber} bulundu${foundOrder.groupId ? ' (grup içinde)' : ''}`
        })
      } else {
        setSearchResult({ found: false, nodeId: null, message: `Node bulunamadı: ${nodeId}` })
      }
    }, 100)
  }, [searchQuery, orders, getNodes, setCenter])

  // Enter tuşu ile arama
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
      setSearchResult(null)
    }
  }, [handleSearch])

  // Gizli tip toggle - 3 hızlı tıklama
  const handleSecretClick = useCallback(() => {
    secretClickCount.current += 1

    // Timer'ı sıfırla
    if (secretClickTimer.current) {
      clearTimeout(secretClickTimer.current)
    }

    // 3 tıklama olduysa toggle
    if (secretClickCount.current >= 3) {
      setShowSecretTips(prev => !prev)
      secretClickCount.current = 0
      return
    }

    // 1 saniye içinde 3'e ulaşmazsa sıfırla
    secretClickTimer.current = setTimeout(() => {
      secretClickCount.current = 0
    }, 1000)
  }, [])

  // Sayfa yüklendiğinde pozisyonları Redis'ten al
  useEffect(() => {
    const loadPositions = async () => {
      if (!selectedDate) return

      try {
        const response = await fetch(`/api/positions?date=${selectedDate}`)
        const data = await response.json()

        if (data.success && data.positions && Object.keys(data.positions).length > 0) {
          setSavedPositions(data.positions)
          console.log(`[CANVAS] ${data.count} pozisyon Redis'ten yüklendi`)
        }
      } catch (error) {
        console.error('[CANVAS] Pozisyon yükleme hatası:', error)
      } finally {
        setPositionsLoaded(true)
      }
    }

    loadPositions()
  }, [selectedDate])

  // Pozisyonları Redis'e kaydet (debounced)
  const savePositionsToRedis = useCallback((positions: Record<string, { x: number; y: number }>) => {
    if (!selectedDate) return

    // Mevcut timeout'u temizle
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 2 saniye sonra kaydet (debounce)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions, date: selectedDate })
        })
        console.log(`[CANVAS] ${Object.keys(positions).length} pozisyon Redis'e kaydedildi`)
      } catch (error) {
        console.error('[CANVAS] Pozisyon kaydetme hatası:', error)
      }
    }, 2000)
  }, [selectedDate])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

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

  // Siparişin atanmış olup olmadığını kontrol et (grup içindeyse grubun atanmış olması yeterli)
  const isOrderAssigned = useCallback((order: Order, allOrders: Order[]): boolean => {
    // Sipariş tekil ise kendi driver'ına bak
    if (!order.groupId) {
      return !!order.driver
    }
    // Sipariş grupta ise, gruptaki herhangi bir siparişe driver atanmış mı bak
    const groupOrders = allOrders.filter(o => o.groupId === order.groupId)
    return groupOrders.some(o => !!o.driver)
  }, [])

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
      // Sürücü yanıt filtresi
      if (responseFilter !== 'ALL') {
        if (responseFilter === 'PENDING_RESPONSE') {
          // Atanmış ama yanıt bekleyen
          if (!order.driver || order.driverResponse) return false
        } else if (responseFilter === 'ACCEPTED') {
          if (order.driverResponse !== 'ACCEPTED') return false
        } else if (responseFilter === 'REJECTED') {
          if (order.driverResponse !== 'REJECTED') return false
        }
      }
      // Atama durumu filtresi (varsayılan: UNASSIGNED - atanmamışları göster)
      if (assignmentFilter !== 'ALL') {
        const assigned = isOrderAssigned(order, orders)
        if (assignmentFilter === 'UNASSIGNED' && assigned) return false
        if (assignmentFilter === 'ASSIGNED' && !assigned) return false
      }
      return true
    })
  }, [orders, dateFilter, timeSlotFilter, statusFilter, groupFilter, mixedGroupIds, responseFilter, assignmentFilter, isOrderAssigned])

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
            tipAmount: o.tipAmount,           // Tip miktarı
            priceAmount: o.priceAmount,       // Toplam fiyat
            isHighValue: o.isHighValue || (o.priceAmount && o.priceAmount >= 500),  // Büyük sipariş
            driverResponse: o.driverResponse,      // Sürücü yanıtı
            driverResponseTime: o.driverResponseTime,
            smsSent: o.smsSent,                    // SMS gönderildi mi?
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
          tipAmount: order.tipAmount,           // Tip miktarı
          priceAmount: order.priceAmount,       // Toplam fiyat
          isHighValue: order.isHighValue || (order.priceAmount && order.priceAmount >= 500),  // Büyük sipariş
          driverResponse: order.driverResponse,      // Sürücü yanıtı
          driverResponseTime: order.driverResponseTime,
          smsSent: order.smsSent,                    // SMS gönderildi mi?
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
    let hasPositionChange = false
    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        // Sadece sürükleme bittiğinde kaydet
        setSavedPositions(prev => {
          const newPositions = {
            ...prev,
            [change.id]: { x: change.position!.x, y: change.position!.y }
          }
          // Redis'e kaydet (debounced)
          savePositionsToRedis(newPositions)
          return newPositions
        })
        hasPositionChange = true
      }
    })
  }, [onNodesChange, savePositionsToRedis])

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
      setSavedPositions(prev => {
        const newPositions = {
          ...prev,
          [draggedNode.id]: { x: draggedNode.position.x, y: draggedNode.position.y }
        }
        // Redis'e kaydet (debounced)
        savePositionsToRedis(newPositions)
        return newPositions
      })

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
    [onMergeOrders, getNodes, savePositionsToRedis]
  )

  // İstatistikler
  const groupCount = [...new Set(orders.filter(o => o.groupId).map(o => o.groupId))].length

  // Atanmış/atanmamış sipariş sayısı (grup bazlı - grupta biri atanmışsa tüm grup atanmış sayılır)
  const assignmentStats = useMemo(() => {
    const processedGroupIds = new Set<string>()
    let assigned = 0
    let unassigned = 0

    orders.forEach(order => {
      if (order.groupId) {
        // Grup zaten işlendiyse atla
        if (processedGroupIds.has(order.groupId)) return
        processedGroupIds.add(order.groupId)

        // Gruptaki siparişleri kontrol et
        const groupOrders = orders.filter(o => o.groupId === order.groupId)
        const isGroupAssigned = groupOrders.some(o => !!o.driver)

        if (isGroupAssigned) {
          assigned += groupOrders.length
        } else {
          unassigned += groupOrders.length
        }
      } else {
        // Tekil sipariş
        if (order.driver) {
          assigned++
        } else {
          unassigned++
        }
      }
    })

    return { assigned, unassigned }
  }, [orders])

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
            <option value="CONFIRMED">🎉 Onaylandı</option>
            <option value="IN_TRANSIT">🚗 Yolda</option>
            <option value="DELIVERED">📦 Teslim</option>
          </select>

          {/* Sürücü Yanıt Filtresi */}
          <select
            value={responseFilter}
            onChange={(e) => setResponseFilter(e.target.value)}
            className="bg-purple-50 border-2 border-purple-300 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold text-purple-800"
          >
            <option value="ALL">Tüm Yanıtlar</option>
            <option value="PENDING_RESPONSE">⏳ Yanıt Bekliyor</option>
            <option value="ACCEPTED">✅ Onayladı</option>
            <option value="REJECTED">❌ Reddetti</option>
          </select>

          <span className="text-gray-300">|</span>

          {/* Atama Durumu Filtresi - YENİ */}
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className={`border-2 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 font-semibold ${
              assignmentFilter === 'UNASSIGNED'
                ? 'bg-orange-50 border-orange-400 text-orange-800 focus:ring-orange-500'
                : assignmentFilter === 'ASSIGNED'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800 focus:ring-emerald-500'
                : 'bg-gray-50 border-gray-300 text-gray-800 focus:ring-gray-500'
            }`}
          >
            <option value="UNASSIGNED">📋 Atanmamış</option>
            <option value="ASSIGNED">✅ Atanmış</option>
            <option value="ALL">🔄 Tümü</option>
          </select>

          {/* Filtre aktif göstergesi */}
          {(dateFilter !== 'ALL' || timeSlotFilter !== 'ALL' || statusFilter !== 'ALL' || groupFilter !== 'ALL' || responseFilter !== 'ALL' || assignmentFilter !== 'UNASSIGNED') && (
            <button
              onClick={() => {
                setDateFilter('ALL')
                setTimeSlotFilter('ALL')
                setStatusFilter('ALL')
                setGroupFilter('ALL')
                setResponseFilter('ALL')
                setAssignmentFilter('UNASSIGNED')
              }}
              className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200"
            >
              Temizle
            </button>
          )}
        </Panel>

        {/* Arama - sağ üst köşe */}
        <Panel position="top-right" className="flex flex-col gap-2">
          {/* Arama kutusu */}
          <div className="bg-white/95 backdrop-blur rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
            <span className="text-gray-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Sipariş ara... (Order No, Adres)"
              className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-gray-400 text-gray-900"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResult(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
            <button
              onClick={() => {
                handleSecretClick() // 3 tıklama kontrolü
                handleSearch()
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
            >
              Ara
            </button>
          </div>

          {/* Arama sonucu */}
          {searchResult && (
            <div className={`text-xs px-3 py-1.5 rounded-lg ${
              searchResult.found
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {searchResult.message}
            </div>
          )}

          {/* Özet bilgi */}
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm text-xs flex items-center gap-4">
          <span className="text-gray-600">
            <b className="text-blue-600">{filteredOrders.length}</b>/{orders.length} sipariş
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">
            <b className="text-orange-600">{assignmentStats.unassigned}</b> atanmamış
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">
            <b className="text-emerald-600">{assignmentStats.assigned}</b> atanmış
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
          </div>

          {/* Gizli Toplam Tip Gösterimi - "erentip" yazınca görünür */}
          {showSecretTips && (
            <div className="bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-300 px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
              <span className="text-amber-600 text-lg">🎁</span>
              <span className="text-amber-800 font-bold text-sm">
                ${orders.reduce((sum, o) => sum + (o.tipAmount || 0), 0).toFixed(2)}
              </span>
              <span className="text-amber-600 text-xs">toplam tip</span>
            </div>
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
