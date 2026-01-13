// Paylaşılan import store - Upstash Redis ile kalıcı storage
// Vercel serverless ortamında her request farklı instance'ta çalışabilir
// Bu yüzden in-memory yerine Redis kullanıyoruz
// TARİH BAZLI KAYIT: Her gün için ayrı key kullanılıyor

import { Redis } from '@upstash/redis'

// Redis client - Environment variable'lar Vercel'den otomatik gelir
// Vercel KV farklı prefix kullanabiliyor: KV_REST_API_*, UPSTASH_REDIS_REST_*, STORAGE_*
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_TOKEN || '',
})

const STORE_PREFIX = 'canvas:import'
const TTL = 60 * 60 * 24 * 30 // 30 gün (geçmiş verilere erişim için)

// Tarih formatı: YYYY-MM-DD
function formatDateKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0] // "2025-01-06"
}

function getStoreKey(date: string): string {
  return `${STORE_PREFIX}:${date}`
}

export interface ImportedOrder {
  id: string
  orderNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  pickupLat?: number
  pickupLng?: number
  dropoffLat?: number
  dropoffLng?: number
  status?: string
  customerName?: string
  driverId?: string       // Sürücü ID (tekil tanımlayıcı - önerilen)
  driverName?: string     // Sürücü adı (geriye uyumluluk)
  driverPhone?: string
  timeSlot?: string
  groupId?: string | null
  groupSource?: 'system' | 'manual'  // Grup kaynağı
  price?: number          // Sipariş fiyatı ($)
  groupPrice?: number     // Grup fiyatı (grup içindeki ilk siparişte tutulur)
  tipAmount?: number      // Tip miktarı (Base44 OCR'dan)
  priceAmount?: number    // Toplam fiyat (Base44 OCR'dan)
  isHighValue?: boolean   // Büyük sipariş ($500+)
  // Sürücü Yanıt Bilgileri
  driverResponse?: 'ACCEPTED' | 'REJECTED' | null  // Evet = ACCEPTED, Hayır = REJECTED
  driverResponseTime?: string                       // ISO timestamp
  // SMS Gönderim Durumu
  smsSent?: boolean                                 // Base44'ten SMS gönderildi bilgisi
  smsSentTime?: string                              // SMS gönderim zamanı
}

export interface ImportedDriver {
  id: string
  name: string
  phone?: string
}

export interface ImportData {
  orders: ImportedOrder[]
  drivers: ImportedDriver[]
  date: string  // ISO string
  dateKey?: string // YYYY-MM-DD format (otomatik oluşturulur)
  timestamp: string
}

// Redis bağlantısı var mı kontrol et
function isRedisConfigured(): boolean {
  const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  const hasStorage = !!(process.env.STORAGE_URL && process.env.STORAGE_TOKEN)
  return hasKV || hasUpstash || hasStorage
}

// Fallback: In-memory store (development için)
const memoryStore: Map<string, ImportData> = new Map()

// Belirli bir tarih için veri kaydet
export async function setImportData(data: ImportData): Promise<void> {
  const dateKey = formatDateKey(data.date)
  const dataWithKey = { ...data, dateKey }
  const storeKey = getStoreKey(dateKey)

  console.log(`[STORE] Veri kaydediliyor: ${data.orders.length} sipariş, tarih: ${dateKey}`)

  if (isRedisConfigured()) {
    try {
      await redis.set(storeKey, JSON.stringify(dataWithKey), { ex: TTL })
      // Ayrıca mevcut tarihlerin listesini güncelle
      await redis.sadd(`${STORE_PREFIX}:dates`, dateKey)
      console.log(`[STORE] Redis'e kaydedildi: ${storeKey}`)
    } catch (error) {
      console.error('[STORE] Redis hatası, memory\'ye kaydediliyor:', error)
      memoryStore.set(dateKey, dataWithKey)
    }
  } else {
    console.log('[STORE] Redis yapılandırılmamış, memory\'ye kaydediliyor')
    memoryStore.set(dateKey, dataWithKey)
  }
}

// Belirli bir tarih için veri getir
export async function getImportData(date?: string | Date): Promise<ImportData | null> {
  // Tarih verilmezse bugünü kullan
  const dateKey = date ? formatDateKey(date) : formatDateKey(new Date())
  const storeKey = getStoreKey(dateKey)

  if (isRedisConfigured()) {
    try {
      const data = await redis.get<string>(storeKey)
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        console.log(`[STORE] Redis'ten okundu (${dateKey}): ${parsed.orders?.length || 0} sipariş`)
        return parsed as ImportData
      }
      return null
    } catch (error) {
      console.error('[STORE] Redis okuma hatası:', error)
      return memoryStore.get(dateKey) || null
    }
  }
  return memoryStore.get(dateKey) || null
}

// Belirli bir tarih için siparişleri getir
export async function getImportedOrders(date?: string | Date): Promise<ImportedOrder[]> {
  const data = await getImportData(date)
  return data?.orders || []
}

// Belirli bir tarih için sürücüleri getir
export async function getImportedDrivers(date?: string | Date): Promise<ImportedDriver[]> {
  const data = await getImportData(date)
  return data?.drivers || []
}

// Mevcut tüm tarihleri listele
export async function getAvailableDates(): Promise<string[]> {
  if (isRedisConfigured()) {
    try {
      const dates = await redis.smembers(`${STORE_PREFIX}:dates`)
      return (dates as string[]).sort().reverse() // En yeni tarih önce
    } catch (error) {
      console.error('[STORE] Redis dates okuma hatası:', error)
      return Array.from(memoryStore.keys()).sort().reverse()
    }
  }
  return Array.from(memoryStore.keys()).sort().reverse()
}

// En son import edilen tarihi getir
export async function getLatestDate(): Promise<string | null> {
  const dates = await getAvailableDates()
  return dates.length > 0 ? dates[0] : null
}

// Sipariş sürücüsünü güncelle
export async function updateOrderDriver(orderId: string, driverName: string, date?: string | Date): Promise<boolean> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return false

  const data = await getImportData(dateKey)
  if (!data) return false

  const order = data.orders.find(o => o.id === orderId)
  if (order) {
    order.driverName = driverName
    order.status = 'ASSIGNED'
    await setImportData(data)
    return true
  }
  return false
}

// Sipariş grubunu güncelle
export async function updateOrderGroup(orderId: string, groupId: string | null, date?: string | Date): Promise<boolean> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return false

  const data = await getImportData(dateKey)
  if (!data) return false

  const order = data.orders.find(o => o.id === orderId)
  if (order) {
    order.groupId = groupId
    await setImportData(data)
    return true
  }
  return false
}

// Belirli bir tarihin verisini sil
export async function clearImportData(date?: string | Date): Promise<void> {
  const dateKey = date ? formatDateKey(date) : formatDateKey(new Date())
  const storeKey = getStoreKey(dateKey)

  if (isRedisConfigured()) {
    try {
      await redis.del(storeKey)
      await redis.srem(`${STORE_PREFIX}:dates`, dateKey)
    } catch (error) {
      console.error('[STORE] Redis silme hatası:', error)
    }
  }
  memoryStore.delete(dateKey)
}

// Sipariş fiyatını güncelle
export async function updateOrderPrice(orderId: string, price: number, date?: string | Date): Promise<boolean> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return false

  const data = await getImportData(dateKey)
  if (!data) return false

  const order = data.orders.find(o => o.id === orderId)
  if (order) {
    order.price = price
    await setImportData(data)
    return true
  }
  return false
}

// Grup fiyatını güncelle (gruptaki tüm siparişlere aynı groupPrice atanır)
export async function updateGroupPrice(groupId: string, groupPrice: number, date?: string | Date): Promise<boolean> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return false

  const data = await getImportData(dateKey)
  if (!data) return false

  const groupOrders = data.orders.filter(o => o.groupId === groupId)
  if (groupOrders.length === 0) return false

  // Gruptaki tüm siparişlere groupPrice ata
  groupOrders.forEach(order => {
    order.groupPrice = groupPrice
  })

  await setImportData(data)
  return true
}

// Sürücü yanıtını güncelle
export async function updateOrderResponse(
  orderId: string,
  response: 'ACCEPTED' | 'REJECTED',
  date?: string | Date
): Promise<boolean> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return false

  const data = await getImportData(dateKey)
  if (!data) return false

  const order = data.orders.find(o => o.id === orderId)
  if (order) {
    order.driverResponse = response
    order.driverResponseTime = new Date().toISOString()

    // REJECTED durumunda driver bilgisini temizle (yeniden atama için)
    if (response === 'REJECTED') {
      order.driverName = undefined
      order.status = 'PENDING'
    } else {
      order.status = 'CONFIRMED'
    }

    await setImportData(data)
    return true
  }
  return false
}

// ==========================================
// POZİSYON YÖNETİMİ (Canvas node pozisyonları)
// ==========================================

export interface NodePositions {
  [nodeId: string]: { x: number; y: number }
}

const POSITIONS_PREFIX = 'canvas:positions'
const POSITIONS_TTL = 60 * 60 * 24 * 7 // 7 gün

function getPositionsKey(date: string): string {
  return `${POSITIONS_PREFIX}:${date}`
}

// Pozisyonları kaydet
export async function saveNodePositions(positions: NodePositions, date?: string | Date): Promise<void> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return

  const storeKey = getPositionsKey(dateKey)

  if (isRedisConfigured()) {
    try {
      await redis.set(storeKey, JSON.stringify(positions), { ex: POSITIONS_TTL })
      console.log(`[POSITIONS] ${Object.keys(positions).length} pozisyon Redis'e kaydedildi (${dateKey})`)
    } catch (error) {
      console.error('[POSITIONS] Redis kayıt hatası:', error)
    }
  }
}

// Pozisyonları getir
export async function getNodePositions(date?: string | Date): Promise<NodePositions> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return {}

  const storeKey = getPositionsKey(dateKey)

  if (isRedisConfigured()) {
    try {
      const data = await redis.get<string>(storeKey)
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        console.log(`[POSITIONS] ${Object.keys(parsed).length} pozisyon Redis'ten okundu (${dateKey})`)
        return parsed as NodePositions
      }
    } catch (error) {
      console.error('[POSITIONS] Redis okuma hatası:', error)
    }
  }
  return {}
}

// Tek bir node pozisyonunu güncelle (incremental)
export async function updateNodePosition(
  nodeId: string,
  position: { x: number; y: number },
  date?: string | Date
): Promise<void> {
  const positions = await getNodePositions(date)
  positions[nodeId] = position
  await saveNodePositions(positions, date)
}

// Pozisyonları sil
export async function clearNodePositions(date?: string | Date): Promise<void> {
  const dateKey = date ? formatDateKey(date) : await getLatestDate()
  if (!dateKey) return

  const storeKey = getPositionsKey(dateKey)

  if (isRedisConfigured()) {
    try {
      await redis.del(storeKey)
      console.log(`[POSITIONS] Pozisyonlar silindi (${dateKey})`)
    } catch (error) {
      console.error('[POSITIONS] Redis silme hatası:', error)
    }
  }
}
