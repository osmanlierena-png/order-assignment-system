// Zaman dilimleri
export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING'

// Sipariş durumları
export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'

// Sürücü yanıt durumları
export type DriverResponse = 'ACCEPTED' | 'REJECTED' | null

// Sipariş tipi
export interface Order {
  id: string
  orderNumber: string
  driver: string | null
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  pickupLat: number | null
  pickupLng: number | null
  dropoffLat: number | null
  dropoffLng: number | null
  timeSlot: TimeSlot
  groupId: string | null
  status: OrderStatus
  notes: string | null
  orderDate: Date
  createdAt: Date
  updatedAt: Date
}

// Sürücü tipi
export interface Driver {
  id: string
  name: string
  phone: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Sipariş grubu tipi
export interface OrderGroup {
  id: string
  name: string | null
  timeSlot: TimeSlot
  driverId: string | null
  driverName: string | null
  orderCount: number
  orders?: Order[]
  createdAt: Date
  updatedAt: Date
}

// CSV'den gelen sipariş verisi
export interface CSVOrderData {
  driver: string
  orderNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
}

// Sipariş oluşturma input
export interface CreateOrderInput {
  orderNumber: string
  driver?: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  notes?: string
  orderDate?: Date
}

// Canvas için node pozisyonları
export interface NodePosition {
  x: number
  y: number
}

// Canvas node tipi
export interface CanvasNode {
  id: string
  type: 'order' | 'orderGroup' | 'driver'
  position: NodePosition
  data: Order | OrderGroup | Driver
}
