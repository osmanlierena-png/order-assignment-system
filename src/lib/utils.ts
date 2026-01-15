import { TimeSlot } from '@/types/order'
import { TIME_SLOTS } from './constants'
import { isReachableInTime, getZipRegion, isKnownZip } from './distance'
import {
  getClusterForZip,
  isHighValueHub,
  isLowGroupingArea,
  areZipsInSameCluster,
  getClusterGroupRate,
  getCrossRegionBonus,
  getRegionForZip
} from './region-clusters'
import { getZipPairFrequency } from './grouping-history'
import { getDrivingTime, isGoogleMapsApiConfigured } from './distance-api'

// className birleştirme (clsx benzeri)
type ClassValue = string | undefined | null | false | Record<string, boolean>

export function cn(...classes: ClassValue[]): string {
  const result: string[] = []

  for (const cls of classes) {
    if (!cls) continue

    if (typeof cls === 'string') {
      result.push(cls)
    } else if (typeof cls === 'object') {
      for (const [key, value] of Object.entries(cls)) {
        if (value) result.push(key)
      }
    }
  }

  return result.join(' ')
}

// Tarih formatlama (Türkçe)
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// Saat formatlama (Validasyon eklenmiş)
export function formatTime(time: string): string {
  // "06:30 AM" veya "12/19/2025 7:00:00 AM" formatından saati çıkar
  const timeMatch = time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
  if (!timeMatch) return time

  let hours = parseInt(timeMatch[1])
  const minutes = parseInt(timeMatch[2])
  const period = timeMatch[4]?.toUpperCase()

  // VALIDASYON: Geçersiz saat/dakika kontrolü
  if (isNaN(hours) || isNaN(minutes)) return time
  if (minutes < 0 || minutes > 59) return time

  // AM/PM dönüşümü
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  // VALIDASYON: 24 saat formatı kontrolü (dönüşüm sonrası)
  if (hours < 0 || hours > 23) {
    console.warn(`[formatTime] Geçersiz saat değeri: ${hours} (orijinal: ${time})`)
    return time
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

// Saatten zaman dilimi belirleme
export function getTimeSlot(time: string): TimeSlot {
  const formattedTime = formatTime(time)
  const hours = parseInt(formattedTime.split(':')[0])

  if (hours >= TIME_SLOTS.MORNING.start && hours < TIME_SLOTS.MORNING.end) {
    return 'MORNING'
  } else if (hours >= TIME_SLOTS.AFTERNOON.start && hours < TIME_SLOTS.AFTERNOON.end) {
    return 'AFTERNOON'
  } else {
    return 'EVENING'
  }
}

// İki nokta arası mesafe hesaplama (Haversine formülü - km)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Dünya yarıçapı (km)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Saat farkı hesaplama (dakika) - pozitif değer: time2 > time1
export function getTimeDifferenceInMinutes(time1: string, time2: string): number {
  const t1 = formatTime(time1)
  const t2 = formatTime(time2)

  const [h1, m1] = t1.split(':').map(Number)
  const [h2, m2] = t2.split(':').map(Number)

  const minutes1 = h1 * 60 + m1
  const minutes2 = h2 * 60 + m2

  return Math.abs(minutes2 - minutes1)
}

// Zamanı dakikaya çevir (günün başından itibaren)
export function timeToMinutes(time: string): number {
  const formatted = formatTime(time)
  const [hours, minutes] = formatted.split(':').map(Number)
  return hours * 60 + minutes
}

// Adresten ZIP kodunu çıkar
export function extractZipCode(address: string): string | null {
  // DC/VA/MD ZIP kodu formatı: 5 rakam (örn: 20005, 22201)
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

// İki ZIP kodunun aynı bölgede olup olmadığını kontrol et
export function areZipsInSameRegion(zip1: string | null, zip2: string | null): boolean {
  if (!zip1 || !zip2) return true // ZIP yoksa izin ver

  // Aynı ZIP ise kesinlikle aynı bölge
  if (zip1 === zip2) return true

  // İlk 3 hane aynıysa genelde yakın bölgeler (örn: 200xx, 201xx, 222xx)
  const prefix1 = zip1.substring(0, 3)
  const prefix2 = zip2.substring(0, 3)

  // Aynı prefiks = yakın bölge
  if (prefix1 === prefix2) return true

  // DC Metro bölgesi - DC, Northern VA, Maryland hepsi birlikte
  const dcMetroRegion = [
    // DC (200-205)
    '200', '201', '202', '203', '204', '205',
    // Northern VA (220-223, 201)
    '220', '221', '222', '223', '201',
    // Maryland (208-209, 217, 207)
    '207', '208', '209', '217',
  ]

  // Her iki ZIP da DC Metro bölgesindeyse birleştirilebilir
  if (dcMetroRegion.includes(prefix1) && dcMetroRegion.includes(prefix2)) {
    return true
  }

  return false
}

// İki sipariş birleştirilebilir mi?
// Mantık: Bir siparişin dropoff time'ı, diğerinin pickup time'ından önce veya aynı anda olmalı
// Böylece sürücü bir teslimatı bitirip diğerine geçebilir
// Ek kontroller: Aynı zaman dilimi ve yakın bölge (ZIP kodu)
export function canMergeOrders(
  order1: {
    pickupTime: string
    dropoffTime: string
    pickupAddress?: string
    dropoffAddress?: string
    pickupLat?: number | null
    pickupLng?: number | null
    dropoffLat?: number | null
    dropoffLng?: number | null
    timeSlot: string
  },
  order2: {
    pickupTime: string
    dropoffTime: string
    pickupAddress?: string
    dropoffAddress?: string
    pickupLat?: number | null
    pickupLng?: number | null
    dropoffLat?: number | null
    dropoffLng?: number | null
    timeSlot: string
  },
  _maxDistanceKm: number = 15, // Reserved for future geo-based filtering
  maxBufferMinutes: number = 120, // Gerçek veriye göre: 120 dk'ya kadar buffer yaygın
  minBufferMinutes: number = 0
): { canMerge: boolean; reason?: string; sequence?: '1->2' | '2->1' } {
  // Zaman dilimi kontrolü - %81 aynı dilimde, %19 farklı
  // Farklı zaman dilimleri de birleştirilebilir (esneklik)
  // if (order1.timeSlot !== order2.timeSlot) {
  //   return { canMerge: false, reason: 'Farklı zaman dilimleri' }
  // }

  // ZIP kontrolü KALDIRILDI - gerçek veride %44 farklı bölgeden birleştirilmiş
  // Coğrafi kısıtlama yok, sadece zaman bazlı birleştirme

  // 1. Zamanları dakikaya çevir
  const pickup1 = timeToMinutes(order1.pickupTime)
  const dropoff1 = timeToMinutes(order1.dropoffTime)
  const pickup2 = timeToMinutes(order2.pickupTime)
  const dropoff2 = timeToMinutes(order2.dropoffTime)

  // Geçersiz zamanları kontrol et - birleştirme
  if (isNaN(pickup1) || isNaN(pickup2) || isNaN(dropoff1) || isNaN(dropoff2)) {
    return { canMerge: false, reason: 'Zaman bilgisi eksik veya geçersiz' }
  }

  // 2. Aynı saatte alınan siparişler birleştirilemez (aynı anda iki yerde olamazsın)
  if (pickup1 === pickup2) {
    return { canMerge: false, reason: 'Aynı pickup saatinde iki sipariş alınamaz' }
  }

  // 3. Zaman çakışması kontrolü - bir sipariş devam ederken diğeri başlayamaz
  // Çakışma: (pickup1 < dropoff2 && pickup2 < dropoff1)
  const overlaps = (pickup1 < dropoff2 && pickup2 < dropoff1)

  // Ardışık olabilirlik kontrolü:
  // - order1 bitince order2 başlayabilir (dropoff1 <= pickup2)
  // - VEYA order2 bitince order1 başlayabilir (dropoff2 <= pickup1)
  // - Buffer süresi max 60 dakika olmalı
  const buffer1to2 = pickup2 - dropoff1 // order1 bittikten sonra order2 başlayana kadar bekleme
  const buffer2to1 = pickup1 - dropoff2 // order2 bittikten sonra order1 başlayana kadar bekleme

  // Sıralama 1->2: order1 biter, sonra order2 başlar
  // Minimum 15dk ara olmalı ki sürücü bir yerden diğerine geçebilsin
  const canSequence1to2 = buffer1to2 >= minBufferMinutes && buffer1to2 <= maxBufferMinutes
  // Sıralama 2->1: order2 biter, sonra order1 başlar
  const canSequence2to1 = buffer2to1 >= minBufferMinutes && buffer2to1 <= maxBufferMinutes

  if (canSequence1to2) {
    return { canMerge: true, sequence: '1->2' }
  }

  if (canSequence2to1) {
    return { canMerge: true, sequence: '2->1' }
  }

  // Buffer çok kısa kontrolü kaldırıldı - minBufferMinutes = 0

  // Hiçbir sıralama mümkün değil
  if (overlaps) {
    return {
      canMerge: false,
      reason: `Zaman çakışması: Sipariş 1 (${formatMinutesToTime(pickup1)}-${formatMinutesToTime(dropoff1)}) ve Sipariş 2 (${formatMinutesToTime(pickup2)}-${formatMinutesToTime(dropoff2)}) aynı anda devam ediyor`
    }
  }

  // Buffer çok uzunsa
  return { canMerge: false, reason: `Siparişler arası süre çok uzun (min ${Math.min(Math.abs(buffer1to2), Math.abs(buffer2to1))} dk, max ${maxBufferMinutes} dk)` }
}

// Dakikayı saat formatına çevir
function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : (h === 0 ? 12 : h)
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

// Eski API uyumluluğu için wrapper
export function canMergeOrdersSimple(
  order1: { pickupTime: string; dropoffTime: string; timeSlot: string },
  order2: { pickupTime: string; dropoffTime: string; timeSlot: string }
): boolean {
  return canMergeOrders(order1, order2).canMerge
}

// Benzersiz ID oluşturma
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// Tüm siparişler için birleştirme önerilerini hesapla
export interface MergeSuggestion {
  order1Id: string
  order2Id: string
  sequence: '1->2' | '2->1'
  reason?: string
}

export function calculateMergeSuggestions(
  orders: Array<{
    id: string
    pickupTime: string
    dropoffTime: string
    pickupAddress: string
    dropoffAddress: string
    timeSlot: string
    groupId: string | null
  }>
): MergeSuggestion[] {
  const suggestions: MergeSuggestion[] = []
  const processedPairs = new Set<string>()

  // Sadece gruplanmamış siparişleri kontrol et
  const ungroupedOrders = orders.filter(o => !o.groupId)

  for (let i = 0; i < ungroupedOrders.length; i++) {
    for (let j = i + 1; j < ungroupedOrders.length; j++) {
      const order1 = ungroupedOrders[i]
      const order2 = ungroupedOrders[j]

      // Pair'i bir kez işle
      const pairKey = [order1.id, order2.id].sort().join('-')
      if (processedPairs.has(pairKey)) continue
      processedPairs.add(pairKey)

      const result = canMergeOrders(order1, order2)

      if (result.canMerge && result.sequence) {
        suggestions.push({
          order1Id: order1.id,
          order2Id: order2.id,
          sequence: result.sequence,
        })
      }
    }
  }

  return suggestions
}

// Skorlu birleştirme önerisi
export interface ScoredSuggestion {
  order1Id: string
  order2Id: string
  order1Number: string
  order2Number: string
  score: number      // 0-100
  reasons: string[]  // "Aynı ZIP", "30dk buffer"
  sequence: '1->2' | '2->1'
}

// Bölge belirleme (Genişletilmiş - Daha Robust)
export function getRegion(zipCode: string | null): string {
  if (!zipCode || zipCode.length < 3) return 'UNKNOWN'

  const prefix3 = zipCode.substring(0, 3)
  const prefix2 = zipCode.substring(0, 2)

  // DC Metro - Detaylı
  if (['200', '201', '202', '203', '204', '205', '206'].includes(prefix3)) {
    return 'DC'
  }

  // Northern Virginia (NoVA)
  if (['220', '221', '222', '223', '224'].includes(prefix3)) {
    return 'NoVA'
  }

  // Maryland - DC yakını
  if (['207', '208', '209', '210', '211', '212'].includes(prefix3)) {
    return 'MD-DC'
  }

  // Maryland - Baltimore yakını
  if (['213', '214', '215', '216', '217', '218', '219'].includes(prefix3)) {
    return 'MD-BAL'
  }

  // Virginia - Güney
  if (['225', '226', '227', '228', '229', '230', '231', '232', '233', '234'].includes(prefix3)) {
    return 'VA-S'
  }

  // Genel bölgeler (prefix2 ile)
  if (prefix2 === '20') return 'DC-AREA'
  if (prefix2 === '21') return 'MD'
  if (prefix2 === '22') return 'VA'
  if (prefix2 === '23') return 'VA-S'
  if (prefix2 === '19') return 'PA' // Philadelphia area
  if (prefix2 === '24') return 'VA-W' // West Virginia yakını

  return 'FAR'
}

// Bölge geçiş puanı (Genişletilmiş - Daha Robust)
function getRegionTransitionScore(fromRegion: string, toRegion: string): number {
  // UNKNOWN bölgelerden geçiş - düşük puan
  if (fromRegion === 'UNKNOWN' || toRegion === 'UNKNOWN') return 0

  // FAR bölgelerden geçiş - NEGATİF PUAN (birleştirme engellemek için)
  // Fredericksburg, Winchester, Culpeper gibi uzak bölgeler
  if (fromRegion === 'FAR' || toRegion === 'FAR') return -20

  // Aynı bölge: +20
  if (fromRegion === toRegion) return 20

  // Ana DC Metro bölgeleri arası geçişler
  const dcMetroRegions = ['DC', 'NoVA', 'MD-DC', 'DC-AREA']
  const isFromDCMetro = dcMetroRegions.includes(fromRegion)
  const isToDCMetro = dcMetroRegions.includes(toRegion)

  // Her ikisi de DC Metro içinde: +15
  if (isFromDCMetro && isToDCMetro) return 15

  // DC Metro <-> Maryland (Baltimore dahil): +10
  const mdRegions = ['MD', 'MD-DC', 'MD-BAL']
  if (isFromDCMetro && mdRegions.includes(toRegion)) return 10
  if (mdRegions.includes(fromRegion) && isToDCMetro) return 10

  // DC Metro <-> Virginia: +10
  const vaRegions = ['VA', 'VA-S', 'VA-W', 'NoVA']
  if (isFromDCMetro && vaRegions.includes(toRegion)) return 10
  if (vaRegions.includes(fromRegion) && isToDCMetro) return 10

  // Maryland bölgeleri arası: +12
  if (mdRegions.includes(fromRegion) && mdRegions.includes(toRegion)) return 12

  // Virginia bölgeleri arası: +12
  if (vaRegions.includes(fromRegion) && vaRegions.includes(toRegion)) return 12

  // MD <-> VA: +5
  if (mdRegions.includes(fromRegion) && vaRegions.includes(toRegion)) return 5
  if (vaRegions.includes(fromRegion) && mdRegions.includes(toRegion)) return 5

  // Pennsylvania (uzak ama mümkün): +3
  if (fromRegion === 'PA' || toRegion === 'PA') return 3

  return 2 // Diğer tüm geçişler için minimum puan
}

// Buffer puanı (gerçek veriye dayalı - katmanlı)
function getBufferScore(bufferMinutes: number): { score: number; label: string } {
  // Negatif buffer: Zaman çakışması
  if (bufferMinutes < 0) {
    return { score: 0, label: 'Çakışma' }
  }

  // 15-45dk: Optimal (gerçek veride en yaygın: %33)
  if (bufferMinutes >= 15 && bufferMinutes <= 45) {
    return { score: 50, label: `${bufferMinutes}dk (optimal)` }
  }

  // 0-15dk: Riskli ama mümkün (gerçek veride %2)
  if (bufferMinutes >= 0 && bufferMinutes < 15) {
    return { score: 25, label: `${bufferMinutes}dk (kısa)` }
  }

  // 45-60dk: İyi (gerçek veride %6)
  if (bufferMinutes > 45 && bufferMinutes <= 60) {
    return { score: 40, label: `${bufferMinutes}dk (iyi)` }
  }

  // 60-90dk: Kabul edilebilir (gerçek veride %10)
  if (bufferMinutes > 60 && bufferMinutes <= 90) {
    return { score: 30, label: `${bufferMinutes}dk (orta)` }
  }

  // 90-120dk: Geniş ama mümkün (gerçek veride %8)
  if (bufferMinutes > 90 && bufferMinutes <= 120) {
    return { score: 20, label: `${bufferMinutes}dk (geniş)` }
  }

  // 120+dk: Çok uzun
  return { score: 0, label: `${bufferMinutes}dk (çok uzun)` }
}

// Akıllı skor hesaplama ile birleştirme önerileri (gerçek veriye dayalı)
export function calculateScoredSuggestions(
  orders: Array<{
    id: string
    orderNumber: string
    pickupTime: string
    dropoffTime: string
    pickupAddress: string
    dropoffAddress: string
    timeSlot: string
    groupId: string | null
  }>
): ScoredSuggestion[] {
  const suggestions: ScoredSuggestion[] = []
  const processedPairs = new Set<string>()

  // Sadece gruplanmamış siparişleri kontrol et
  const ungroupedOrders = orders.filter(o => !o.groupId)

  for (let i = 0; i < ungroupedOrders.length; i++) {
    for (let j = i + 1; j < ungroupedOrders.length; j++) {
      const order1 = ungroupedOrders[i]
      const order2 = ungroupedOrders[j]

      // Pair'i bir kez işle
      const pairKey = [order1.id, order2.id].sort().join('-')
      if (processedPairs.has(pairKey)) continue
      processedPairs.add(pairKey)

      // Zamanları hesapla
      const pickup1 = timeToMinutes(order1.pickupTime)
      const dropoff1 = timeToMinutes(order1.dropoffTime)
      const pickup2 = timeToMinutes(order2.pickupTime)
      const dropoff2 = timeToMinutes(order2.dropoffTime)

      // Geçersiz zamanları atla
      if (isNaN(pickup1) || isNaN(dropoff1) || isNaN(pickup2) || isNaN(dropoff2)) continue

      // Aynı pickup saati = birleştirilemez
      if (pickup1 === pickup2) continue

      // Buffer hesapla (hangi sırada yapılabilir)
      const buffer1to2 = pickup2 - dropoff1
      const buffer2to1 = pickup1 - dropoff2

      // En iyi sıralamayı bul
      let bestBuffer: number
      let sequence: '1->2' | '2->1'

      if (buffer1to2 >= 0 && buffer1to2 <= 120) {
        if (buffer2to1 >= 0 && buffer2to1 <= 120) {
          // İkisi de mümkün, daha kısa olanı seç
          if (buffer1to2 <= buffer2to1) {
            bestBuffer = buffer1to2
            sequence = '1->2'
          } else {
            bestBuffer = buffer2to1
            sequence = '2->1'
          }
        } else {
          bestBuffer = buffer1to2
          sequence = '1->2'
        }
      } else if (buffer2to1 >= 0 && buffer2to1 <= 120) {
        bestBuffer = buffer2to1
        sequence = '2->1'
      } else {
        // Hiçbir sıralama mümkün değil
        continue
      }

      // SKOR HESAPLAMA (Gerçek veriye dayalı - toplam max 100)
      let score = 0
      const reasons: string[] = []

      // 1. BUFFER PUANI (max 50 puan) - en önemli faktör
      const bufferResult = getBufferScore(bestBuffer)
      score += bufferResult.score
      if (bufferResult.score > 0) {
        reasons.push(bufferResult.label)
      }

      // Buffer skoru 0 ise birleştirme yapma
      if (bufferResult.score === 0) continue

      // 2. BÖLGE GEÇİŞ PUANI (max 20 puan)
      const dropoffZip1 = extractZipCode(order1.dropoffAddress)
      const pickupZip2 = extractZipCode(order2.pickupAddress)
      const dropoffZip2 = extractZipCode(order2.dropoffAddress)
      const pickupZip1 = extractZipCode(order1.pickupAddress)

      // Sıralamaya göre doğru geçişi hesapla
      const fromZip = sequence === '1->2' ? dropoffZip1 : dropoffZip2
      const toZip = sequence === '1->2' ? pickupZip2 : pickupZip1

      const fromRegion = getRegion(fromZip)
      const toRegion = getRegion(toZip)
      const regionScore = getRegionTransitionScore(fromRegion, toRegion)

      if (regionScore > 0) {
        score += regionScore
        if (fromRegion === toRegion) {
          reasons.push(`${fromRegion} içi`)
        } else {
          reasons.push(`${fromRegion}→${toRegion}`)
        }
      }

      // 3. ZIP YAKINLIĞI PUANI (max 15 puan)
      if (fromZip && toZip) {
        if (fromZip === toZip) {
          score += 15
          reasons.push(`Aynı ZIP (${fromZip})`)
        } else if (fromZip.substring(0, 3) === toZip.substring(0, 3)) {
          score += 10
          reasons.push(`Yakın (${fromZip.substring(0, 3)}xx)`)
        }
      }

      // 4. AYNI ZAMAN DİLİMİ BONUS (max 15 puan) - gerçek veride %81
      if (order1.timeSlot === order2.timeSlot) {
        score += 15
        reasons.push('Aynı dilim')
      }

      // Minimum skor: 40 (sadece buffer skoru yeterli değil)
      if (score >= 40) {
        suggestions.push({
          order1Id: order1.id,
          order2Id: order2.id,
          order1Number: order1.orderNumber,
          order2Number: order2.orderNumber,
          score,
          reasons,
          sequence
        })
      }
    }
  }

  // Skora göre sırala (yüksekten düşüğe)
  return suggestions.sort((a, b) => b.score - a.score)
}

// =====================================================
// KATMANLI BİRLEŞTİRME SİSTEMİ (Gerçek Veriye Dayalı)
// =====================================================

// Birleştirme katmanları
export type MergeLayer = 'TIGHT' | 'NORMAL' | 'LOOSE'

export interface LayeredMergeSuggestion {
  orderIds: string[]
  orderNumbers: string[]
  score: number
  layer: MergeLayer
  reasons: string[]
  buffers: number[]
  avgBuffer: number
}

// =====================================================
// GRUPLAMA LİMİTLERİ
// =====================================================
const MIN_BUFFER_MINUTES = 5  // Minimum buffer süresi (dakika)
const MAX_DRIVING_MINUTES = 25  // Maximum sürüş süresi (dakika)

// Katman kuralları (gerçek veriye dayalı)
const LAYER_RULES = {
  // TIGHT: Ard arda siparişler (en yaygın: %33 - 15-45dk)
  TIGHT: {
    minBuffer: 5,  // Minimum 5dk buffer gerekli
    maxBuffer: 45,
    minScore: 70,
    sameTimeSlotRequired: true,  // %81 aynı dilimde
    maxGroupSize: 3,
    description: 'Sıkı birleştirme (15-45dk)'
  },
  // NORMAL: Standart birleştirme (%16 - 45-90dk)
  NORMAL: {
    minBuffer: 5,  // Minimum 5dk buffer gerekli
    maxBuffer: 90,
    minScore: 55,
    sameTimeSlotRequired: false,
    maxGroupSize: 4,
    description: 'Normal birleştirme (45-90dk)'
  },
  // LOOSE: Gevşek birleştirme (%8 - 90-120dk)
  // 4+ gruplarda arada uzun buffer olabilir
  LOOSE: {
    minBuffer: 5,  // Minimum 5dk buffer gerekli
    maxBuffer: 120,
    minScore: 45,
    sameTimeSlotRequired: false,
    maxGroupSize: 5,
    description: 'Gevşek birleştirme (90-120dk)'
  }
}

// Her katman için buffer puanı (farklı kurallar)
function getLayeredBufferScore(buffer: number, layer: MergeLayer): number {
  if (buffer < 0) return 0

  switch (layer) {
    case 'TIGHT':
      // TIGHT: 15-45dk optimal
      if (buffer >= 15 && buffer <= 30) return 50
      if (buffer > 30 && buffer <= 45) return 45
      if (buffer >= 0 && buffer < 15) return 30  // Çok kısa, riskli
      return 0

    case 'NORMAL':
      // NORMAL: 30-60dk optimal, 60-90dk kabul edilebilir
      if (buffer >= 30 && buffer <= 60) return 45
      if (buffer > 60 && buffer <= 90) return 35
      if (buffer >= 15 && buffer < 30) return 40
      if (buffer >= 0 && buffer < 15) return 25
      return 0

    case 'LOOSE':
      // LOOSE: 60-90dk optimal, 90-120dk kabul edilebilir
      if (buffer >= 45 && buffer <= 90) return 40
      if (buffer > 90 && buffer <= 120) return 30
      if (buffer >= 15 && buffer < 45) return 35
      if (buffer >= 0 && buffer < 15) return 20
      return 0
  }
}

// =====================================================
// ÖĞRENEN SİSTEM BONUS PUANLARI
// =====================================================

// Öğrenen sistemden bonus puanı hesapla (async wrapper için sync versiyonu)
// SİMÜLASYON SONRASI İYİLEŞTİRİLMİŞ AĞIRLIKLAR
// Önceki: Cluster +25, Hub +20, Region +10 → Çok yüksekti, precision %2
// Yeni: Cluster +15, Hub +12, Region +6 → Daha dengeli
function getLearningBonusSync(
  dropoffZip1: string | null,
  dropoffZip2: string | null,
  pickupAddress1: string,
  pickupAddress2: string
): { bonus: number; reasons: string[] } {
  let bonus = 0
  const reasons: string[] = []

  // 1. Cluster bazlı bonus (25 → 15)
  if (dropoffZip1 && dropoffZip2) {
    if (areZipsInSameCluster(dropoffZip1, dropoffZip2)) {
      bonus += 15  // Düşürüldü: 25 → 15
      const cluster = getClusterForZip(dropoffZip1)
      reasons.push(`Aynı cluster (${cluster?.name || 'bilinmeyen'})`)
    }

    // Cross-region bonus (10/8/5 → 6/5/3)
    const region1 = getRegionForZip(dropoffZip1)
    const region2 = getRegionForZip(dropoffZip2)
    const crossBonus = getCrossRegionBonus(region1, region2)
    if (crossBonus > 0) {
      const adjustedBonus = Math.floor(crossBonus * 0.6)  // %60'a düşürüldü
      bonus += adjustedBonus
      reasons.push(`${region1}-${region2} (+${adjustedBonus})`)
    }

    // Cluster gruplama oranı bonusu (15/8 → 10/5)
    const rate1 = getClusterGroupRate(dropoffZip1)
    const rate2 = getClusterGroupRate(dropoffZip2)
    const avgRate = (rate1 + rate2) / 2
    if (avgRate >= 0.8) {
      bonus += 10  // Düşürüldü: 15 → 10
      reasons.push('Yüksek gruplama bölgesi')
    } else if (avgRate >= 0.6) {
      bonus += 5   // Düşürüldü: 8 → 5
    }
  }

  // 2. Hub bonus (20 → 12)
  const hub1 = isHighValueHub(pickupAddress1)
  const hub2 = isHighValueHub(pickupAddress2)
  if (hub1.isHub) {
    bonus += Math.floor(hub1.groupRate * 12)  // Düşürüldü: 20 → 12
    reasons.push(`Hub: ${pickupAddress1.substring(0, 20)}...`)
  }
  if (hub2.isHub) {
    bonus += Math.floor(hub2.groupRate * 12)
  }

  // 3. Düşük gruplama bölgesi cezası (15 → 20, daha ağır ceza)
  if (dropoffZip1 && isLowGroupingArea(dropoffZip1)) {
    bonus -= 20  // Artırıldı: 15 → 20 (daha sert ceza)
    reasons.push('Düşük gruplama bölgesi')
  }
  if (dropoffZip2 && isLowGroupingArea(dropoffZip2)) {
    bonus -= 20
  }

  return { bonus, reasons }
}

// Async versiyon - tarihsel veri ile
export async function getLearningBonusAsync(
  dropoffZip1: string | null,
  dropoffZip2: string | null,
  pickupAddress1: string,
  pickupAddress2: string
): Promise<{ bonus: number; reasons: string[] }> {
  // Sync bonus'u al
  const syncResult = getLearningBonusSync(dropoffZip1, dropoffZip2, pickupAddress1, pickupAddress2)

  // Tarihsel veri bonus'u ekle
  if (dropoffZip1 && dropoffZip2) {
    try {
      const historicalPair = await getZipPairFrequency(dropoffZip1, dropoffZip2)
      if (historicalPair && historicalPair.count >= 3) {
        syncResult.bonus += 20
        syncResult.reasons.push(`Geçmişte ${historicalPair.count}x birlikte`)
      }
    } catch (e) {
      // Redis hatası - sessizce devam et
    }
  }

  return syncResult
}

// Sürüş süresi toleransı (dakika)
// buffer >= drivingTime + DRIVING_TIME_TOLERANCE olmalı
// 10dk tolerans: trafik, park etme, bina girişi gibi ekstra süreler için
const DRIVING_TIME_TOLERANCE = 10

// Ana birleştirme öneri fonksiyonu - TÜM KATMANLARI HESAPLAR + ÖĞRENEN SİSTEM + GERÇEK SÜRÜŞ SÜRESİ
export async function calculateLayeredMergeSuggestions(
  orders: Array<{
    id: string
    orderNumber: string
    pickupTime: string
    dropoffTime: string
    pickupAddress: string
    dropoffAddress: string
    timeSlot: string
    groupId: string | null
  }>,
  useRealDrivingTime: boolean = true // Gerçek sürüş süresi kullanılsın mı?
): Promise<{
  tight: LayeredMergeSuggestion[]    // 2'li sıkı birleştirmeler
  normal: LayeredMergeSuggestion[]   // 2-3'lü normal birleştirmeler
  loose: LayeredMergeSuggestion[]    // 3-4'lü gevşek birleştirmeler
}> {
  const ungroupedOrders = orders.filter(o => !o.groupId)

  // Tüm siparişlere zaman bilgisi ekle
  const ordersWithTime = ungroupedOrders.map(o => ({
    ...o,
    pickupMinutes: timeToMinutes(o.pickupTime),
    dropoffMinutes: timeToMinutes(o.dropoffTime),
    dropoffZip: extractZipCode(o.dropoffAddress),
    pickupZip: extractZipCode(o.pickupAddress)
  })).filter(o => !isNaN(o.pickupMinutes) && !isNaN(o.dropoffMinutes))

  const tight: LayeredMergeSuggestion[] = []
  const normal: LayeredMergeSuggestion[] = []
  const loose: LayeredMergeSuggestion[] = []

  // === 2'Lİ BİRLEŞTİRMELER (TIGHT & NORMAL) ===
  const processedPairs = new Set<string>()

  for (let i = 0; i < ordersWithTime.length; i++) {
    for (let j = i + 1; j < ordersWithTime.length; j++) {
      const o1 = ordersWithTime[i]
      const o2 = ordersWithTime[j]

      const pairKey = [o1.id, o2.id].sort().join('-')
      if (processedPairs.has(pairKey)) continue
      processedPairs.add(pairKey)

      // Aynı pickup kontrolü
      if (o1.pickupMinutes === o2.pickupMinutes) continue

      // Sıralama belirle
      const [first, second] = o1.pickupMinutes < o2.pickupMinutes ? [o1, o2] : [o2, o1]
      const buffer = second.pickupMinutes - first.dropoffMinutes

      // Minimum buffer kontrolü - 5dk'dan az ise birleştirme yapma
      if (buffer < MIN_BUFFER_MINUTES) {
        console.log(`[BUFFER-RED] ${first.orderNumber} → ${second.orderNumber}: buffer=${buffer}dk < minimum ${MIN_BUFFER_MINUTES}dk`)
        continue
      }

      // ==========================================
      // MESAFE KONTROLÜ - Kritik validasyon
      // ==========================================
      // ZIP kodları varsa mesafe kontrolü yap
      if (first.dropoffZip && second.pickupZip) {
        const reachability = isReachableInTime(first.dropoffZip, second.pickupZip, buffer)

        // Ulaşılamaz mesafe = birleştirme yapma
        if (!reachability.reachable) {
          console.log(`[MESAFE-RED] ${first.orderNumber} → ${second.orderNumber}: ${reachability.reason}`)
          continue
        }

        // Bilinmeyen ZIP kontrolü - riskli, atla
        if (!isKnownZip(first.dropoffZip) || !isKnownZip(second.pickupZip)) {
          console.log(`[MESAFE-SKIP] Bilinmeyen ZIP: ${first.dropoffZip} veya ${second.pickupZip}`)
          continue
        }
      }

      // Bölge geçişi (distance.ts'den güncellenen bölgeler)
      const fromRegion = first.dropoffZip ? getZipRegion(first.dropoffZip) : getRegion(first.dropoffZip)
      const toRegion = second.pickupZip ? getZipRegion(second.pickupZip) : getRegion(second.pickupZip)
      const regionScore = getRegionTransitionScore(fromRegion, toRegion)

      // FAR bölgelerden birleştirme yapma (çok riskli)
      if (fromRegion === 'FAR' || toRegion === 'FAR') {
        console.log(`[MESAFE-FAR] ${first.orderNumber} → ${second.orderNumber}: Uzak bölge (${fromRegion}→${toRegion})`)
        continue
      }

      // ==========================================
      // GERÇEK SÜRÜŞ SÜRESİ KONTROLÜ (Google Maps API)
      // ==========================================
      let realDrivingMinutes: number | null = null

      if (useRealDrivingTime && isGoogleMapsApiConfigured()) {
        try {
          const drivingResult = await getDrivingTime(first.dropoffAddress, second.pickupAddress)
          realDrivingMinutes = drivingResult.durationMinutes

          // Buffer, gerçek sürüş süresi + toleranstan az ise birleştirme yapma
          const margin = buffer - realDrivingMinutes
          if (margin < DRIVING_TIME_TOLERANCE) {
            console.log(`[SÜRÜŞ-RED] ${first.orderNumber} → ${second.orderNumber}: ` +
              `marj=${margin}dk < ${DRIVING_TIME_TOLERANCE}dk tolerans ` +
              `(buffer=${buffer}dk - sürüş=${realDrivingMinutes}dk) ` +
              `(kaynak: ${drivingResult.source})`)
            continue
          }

          console.log(`[SÜRÜŞ-OK] ${first.orderNumber} → ${second.orderNumber}: ` +
            `marj=${margin}dk >= ${DRIVING_TIME_TOLERANCE}dk tolerans ` +
            `(buffer=${buffer}dk - sürüş=${realDrivingMinutes}dk) ` +
            `(kaynak: ${drivingResult.source})`)
        } catch (error) {
          console.error(`[SÜRÜŞ-HATA] ${first.orderNumber} → ${second.orderNumber}:`, error)
          // API hatası durumunda mevcut mantıkla devam et
        }
      }

      // TIGHT katmanı (15-45dk, aynı dilim)
      if (buffer <= LAYER_RULES.TIGHT.maxBuffer) {
        const bufferScore = getLayeredBufferScore(buffer, 'TIGHT')

        // Aynı zaman dilimi kontrolü
        if (first.timeSlot === second.timeSlot) {
          let score = bufferScore + regionScore
          const allReasons: string[] = [`${buffer}dk buffer`, `${fromRegion}→${toRegion}`, 'Aynı dilim']

          // Gerçek sürüş süresi bilgisini ekle
          if (realDrivingMinutes !== null) {
            allReasons.push(`${realDrivingMinutes}dk sürüş`)
          }

          // ZIP yakınlığı bonus
          if (first.dropoffZip && second.pickupZip) {
            if (first.dropoffZip === second.pickupZip) score += 15
            else if (first.dropoffZip.substring(0, 3) === second.pickupZip.substring(0, 3)) score += 10
          }

          // Aynı dilim bonus
          score += 10

          // ÖĞRENEN SİSTEM BONUSU
          const learningBonus = getLearningBonusSync(
            first.dropoffZip,
            second.dropoffZip,
            first.pickupAddress,
            second.pickupAddress
          )
          score += learningBonus.bonus
          allReasons.push(...learningBonus.reasons)

          if (score >= LAYER_RULES.TIGHT.minScore) {
            tight.push({
              orderIds: [first.id, second.id],
              orderNumbers: [first.orderNumber, second.orderNumber],
              score,
              layer: 'TIGHT',
              reasons: allReasons,
              buffers: [buffer],
              avgBuffer: buffer
            })
          }
        }
      }

      // NORMAL katmanı (45-90dk, dilim zorunlu değil)
      if (buffer <= LAYER_RULES.NORMAL.maxBuffer) {
        const bufferScore = getLayeredBufferScore(buffer, 'NORMAL')
        let score = bufferScore + regionScore
        const normalReasons: string[] = [
          `${buffer}dk buffer`,
          `${fromRegion}→${toRegion}`,
          first.timeSlot === second.timeSlot ? 'Aynı dilim' : 'Farklı dilim'
        ]

        // Gerçek sürüş süresi bilgisini ekle
        if (realDrivingMinutes !== null) {
          normalReasons.push(`${realDrivingMinutes}dk sürüş`)
        }

        // ZIP yakınlığı bonus
        if (first.dropoffZip && second.pickupZip) {
          if (first.dropoffZip === second.pickupZip) score += 15
          else if (first.dropoffZip.substring(0, 3) === second.pickupZip.substring(0, 3)) score += 10
        }

        // Aynı dilim bonus
        if (first.timeSlot === second.timeSlot) score += 10

        // ÖĞRENEN SİSTEM BONUSU
        const learningBonus = getLearningBonusSync(
          first.dropoffZip,
          second.dropoffZip,
          first.pickupAddress,
          second.pickupAddress
        )
        score += learningBonus.bonus
        normalReasons.push(...learningBonus.reasons)

        if (score >= LAYER_RULES.NORMAL.minScore) {
          normal.push({
            orderIds: [first.id, second.id],
            orderNumbers: [first.orderNumber, second.orderNumber],
            score,
            layer: 'NORMAL',
            reasons: normalReasons,
            buffers: [buffer],
            avgBuffer: buffer
          })
        }
      }
    }
  }

  // === 3'LÜ BİRLEŞTİRMELER (NORMAL & LOOSE) ===
  const processedTriples = new Set<string>()

  for (let i = 0; i < ordersWithTime.length; i++) {
    for (let j = i + 1; j < ordersWithTime.length; j++) {
      for (let k = j + 1; k < ordersWithTime.length; k++) {
        const trio = [ordersWithTime[i], ordersWithTime[j], ordersWithTime[k]]

        const tripleKey = trio.map(o => o.id).sort().join('-')
        if (processedTriples.has(tripleKey)) continue
        processedTriples.add(tripleKey)

        // Pickup'a göre sırala
        trio.sort((a, b) => a.pickupMinutes - b.pickupMinutes)

        // Aynı pickup kontrolü
        if (trio[0].pickupMinutes === trio[1].pickupMinutes ||
            trio[1].pickupMinutes === trio[2].pickupMinutes) continue

        // Buffer'ları hesapla
        const buffer1 = trio[1].pickupMinutes - trio[0].dropoffMinutes
        const buffer2 = trio[2].pickupMinutes - trio[1].dropoffMinutes

        // Negatif buffer = çakışma
        if (buffer1 < 0 || buffer2 < 0) continue

        const avgBuffer = (buffer1 + buffer2) / 2

        // 3'lü için: Her iki buffer da max 90dk (NORMAL) veya bir tanesi 120dk'ya kadar (LOOSE)
        const allNormal = buffer1 <= 90 && buffer2 <= 90
        const oneLoose = (buffer1 <= 120 && buffer2 <= 90) || (buffer1 <= 90 && buffer2 <= 120)

        if (!allNormal && !oneLoose) continue

        const layer: MergeLayer = allNormal ? 'NORMAL' : 'LOOSE'
        const layerRules = LAYER_RULES[layer]

        // Skor hesapla
        const bufferScore1 = getLayeredBufferScore(buffer1, layer)
        const bufferScore2 = getLayeredBufferScore(buffer2, layer)
        let score = Math.floor((bufferScore1 + bufferScore2) * 0.8) // 3'lü için %80

        // Bölge geçişleri
        const region0 = getRegion(trio[0].dropoffZip)
        const region1 = getRegion(trio[1].pickupZip)
        const region1d = getRegion(trio[1].dropoffZip)
        const region2 = getRegion(trio[2].pickupZip)

        score += Math.floor((getRegionTransitionScore(region0, region1) +
                            getRegionTransitionScore(region1d, region2)) * 0.7)

        // Aynı dilim bonus
        if (trio[0].timeSlot === trio[1].timeSlot && trio[1].timeSlot === trio[2].timeSlot) {
          score += 10
        }

        if (score >= layerRules.minScore) {
          const suggestion: LayeredMergeSuggestion = {
            orderIds: trio.map(o => o.id),
            orderNumbers: trio.map(o => o.orderNumber),
            score,
            layer,
            reasons: [
              `B1:${buffer1}dk, B2:${buffer2}dk`,
              `Ort:${avgBuffer.toFixed(0)}dk`,
              trio[0].timeSlot === trio[2].timeSlot ? 'Aynı dilim' : 'Karışık'
            ],
            buffers: [buffer1, buffer2],
            avgBuffer
          }

          if (layer === 'NORMAL') {
            normal.push(suggestion)
          } else {
            loose.push(suggestion)
          }
        }
      }
    }
  }

  // === 4'LÜ BİRLEŞTİRMELER (LOOSE) ===
  // Sadece en iyi 4'lü kombinasyonları bul (performans için limit)
  const processedQuads = new Set<string>()
  let quadCount = 0
  const MAX_QUADS = 20

  for (let i = 0; i < ordersWithTime.length && quadCount < MAX_QUADS; i++) {
    for (let j = i + 1; j < ordersWithTime.length && quadCount < MAX_QUADS; j++) {
      for (let k = j + 1; k < ordersWithTime.length && quadCount < MAX_QUADS; k++) {
        for (let l = k + 1; l < ordersWithTime.length && quadCount < MAX_QUADS; l++) {
          const quad = [ordersWithTime[i], ordersWithTime[j], ordersWithTime[k], ordersWithTime[l]]

          const quadKey = quad.map(o => o.id).sort().join('-')
          if (processedQuads.has(quadKey)) continue
          processedQuads.add(quadKey)

          // Pickup'a göre sırala
          quad.sort((a, b) => a.pickupMinutes - b.pickupMinutes)

          // Aynı pickup kontrolü
          let hasConflict = false
          for (let m = 0; m < 3; m++) {
            if (quad[m].pickupMinutes === quad[m + 1].pickupMinutes) {
              hasConflict = true
              break
            }
          }
          if (hasConflict) continue

          // Buffer'ları hesapla
          const buffers = [
            quad[1].pickupMinutes - quad[0].dropoffMinutes,
            quad[2].pickupMinutes - quad[1].dropoffMinutes,
            quad[3].pickupMinutes - quad[2].dropoffMinutes
          ]

          // Negatif buffer kontrolü
          if (buffers.some(b => b < 0)) continue

          // 4'lü için: Ortalama ≤90dk, max ≤120dk
          const avgBuffer = buffers.reduce((a, b) => a + b, 0) / buffers.length
          const maxBuffer = Math.max(...buffers)

          if (avgBuffer > 90 || maxBuffer > 120) continue

          // Skor hesapla
          let score = 0
          for (const buffer of buffers) {
            score += Math.floor(getLayeredBufferScore(buffer, 'LOOSE') * 0.7) // 4'lü için %70
          }

          // Minimum skor kontrolü
          if (score >= LAYER_RULES.LOOSE.minScore) {
            loose.push({
              orderIds: quad.map(o => o.id),
              orderNumbers: quad.map(o => o.orderNumber),
              score,
              layer: 'LOOSE',
              reasons: [
                `Buffers: ${buffers.join('dk, ')}dk`,
                `Ort:${avgBuffer.toFixed(0)}dk`,
                '4 sipariş'
              ],
              buffers,
              avgBuffer
            })
            quadCount++
          }
        }
      }
    }
  }

  // Skora göre sırala
  return {
    tight: tight.sort((a, b) => b.score - a.score),
    normal: normal.sort((a, b) => b.score - a.score),
    loose: loose.sort((a, b) => b.score - a.score)
  }
}

// En iyi birleştirmeleri seç (çakışma olmadan)
export function selectBestMerges(
  suggestions: {
    tight: LayeredMergeSuggestion[]
    normal: LayeredMergeSuggestion[]
    loose: LayeredMergeSuggestion[]
  }
): LayeredMergeSuggestion[] {
  const usedOrderIds = new Set<string>()
  const selected: LayeredMergeSuggestion[] = []

  // Öncelik sırası: TIGHT > NORMAL > LOOSE
  const allSuggestions = [
    ...suggestions.tight,
    ...suggestions.normal,
    ...suggestions.loose
  ].sort((a, b) => b.score - a.score)

  for (const suggestion of allSuggestions) {
    // Bu siparişlerden biri zaten kullanılmış mı?
    const hasConflict = suggestion.orderIds.some(id => usedOrderIds.has(id))

    if (!hasConflict) {
      selected.push(suggestion)
      suggestion.orderIds.forEach(id => usedOrderIds.add(id))
    }
  }

  return selected
}
