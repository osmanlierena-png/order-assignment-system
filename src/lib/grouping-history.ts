// Öğrenen Gruplama Sistemi - Geçmiş Veri ve Pattern Storage
// 30 günlük analiz sonuçlarına göre tasarlandı
// Redis ile kalıcı depolama

import { Redis } from '@upstash/redis'
import {
  extractZipFromAddress,
  getClusterForZip,
  isHighValueHub,
  isLowGroupingArea,
  areZipsInSameCluster,
  areZipsInSameRegion,
  getCrossRegionBonus,
  getRegionForZip,
  getClusterGroupRate
} from './region-clusters'

// Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_TOKEN || '',
})

// Redis key prefix'leri
const KEYS = {
  ZIP_PAIRS: 'canvas:grouping:zip-pairs',
  ADDRESS_PAIRS: 'canvas:grouping:address-pairs',
  HUB_STATS: 'canvas:grouping:hub-stats',
  DAILY_STATS: 'canvas:grouping:daily-stats',
  ROUTE_PAIRS: 'canvas:grouping:route-pairs',
  LEARNING_META: 'canvas:grouping:meta'
}

const TTL = 60 * 60 * 24 * 90 // 90 gün

// ==========================================
// VERİ YAPILARI
// ==========================================

export interface ZipPairData {
  count: number
  avgTimeDiff: number // dakika
  avgBufferTime: number // dakika
  lastSeen: string // ISO date
}

export interface AddressPairData {
  pickupAddress: string
  dropoffAddress: string
  count: number
  avgTimeDiff: number
}

export interface HubStats {
  address: string
  totalOrders: number
  groupedOrders: number
  groupRate: number
  topPairedZips: string[]
}

export interface DailyStats {
  date: string
  totalOrders: number
  totalGroups: number
  soloOrders: number
  avgGroupSize: number
  groupSizeDistribution: { [size: string]: number }
}

export interface GroupingPattern {
  zip1: string
  zip2: string
  score: number
  reason: string
}

export interface GroupingSuggestion {
  orderId: string
  suggestedPairIds: string[]
  score: number
  reasons: string[]
}

// ==========================================
// SKORLAMA SABİTLERİ (Analiz sonuçlarından)
// ==========================================

export const SCORING = {
  // Konum skorları
  SAME_PICKUP_ADDRESS: 50,
  SAME_PICKUP_ZIP: 30,
  SAME_PICKUP_STATE: 15,
  SAME_DROPOFF_ADDRESS: 50,
  SAME_DROPOFF_ZIP: 30,
  SAME_DROPOFF_STATE: 15,
  SAME_CLUSTER: 25,

  // Zaman skorları (pickup farkı)
  TIME_0_15: 40,
  TIME_15_30: 35,
  TIME_30_60: 30,
  TIME_60_90: 25,
  TIME_90_120: 15,
  TIME_120_180: 5,
  TIME_OVER_180: -5,

  // Buffer skorları
  BUFFER_NEGATIVE: -30,
  BUFFER_0_15: 30,
  BUFFER_15_30: 25,
  BUFFER_30_60: 20,
  BUFFER_60_120: 10,

  // Bonus skorları
  KNOWN_ROUTE_PAIR: 35,
  HIGH_VALUE_HUB: 20,
  DC_AREA_BOTH: 10,
  DC_VA_COMBO: 8,
  MORNING_SLOT: 15, // 5-9 AM
  AFTERNOON_SLOT: 10, // 12-18 PM
  HISTORICAL_PAIR: 20, // Geçmişte birlikte gruplandı

  // Ceza skorları
  LOW_GROUPING_AREA: -15,
  LONG_DISTANCE: -20,
  MIDDAY_SLOT: -10, // 10-11 AM en düşük gruplama
}

export const THRESHOLDS = {
  MIN_SCORE_TO_SUGGEST: 40,  // 50'den 40'a düşürüldü - daha fazla gruplama önerisi için
  HIGH_CONFIDENCE: 80,
  AUTO_GROUP: 100,
  MAX_GROUP_SIZE_SAFE: 5,
  MAX_GROUP_SIZE_EXTENDED: 7,
  MAX_PICKUP_TIME_GAP_MINUTES: 180
}

// ==========================================
// REDIS YARDIMCI FONKSİYONLARI
// ==========================================

function isRedisConfigured(): boolean {
  const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  const hasStorage = !!(process.env.STORAGE_URL && process.env.STORAGE_TOKEN)
  return hasKV || hasUpstash || hasStorage
}

// ZIP çifti key'i oluştur (sıralı)
function createZipPairKey(zip1: string, zip2: string): string {
  return [zip1, zip2].sort().join('-')
}

// ==========================================
// ZIP ÇİFTİ FONKSİYONLARI
// ==========================================

// ZIP çifti frekansını güncelle
export async function updateZipPairFrequency(
  zips: string[],
  timeDiffs: number[],
  bufferTimes: number[]
): Promise<void> {
  if (!isRedisConfigured() || zips.length < 2) return

  try {
    // Tüm mevcut veriyi al
    const existing = await redis.get<Record<string, ZipPairData>>(KEYS.ZIP_PAIRS) || {}

    // Her ZIP çifti için güncelle
    for (let i = 0; i < zips.length; i++) {
      for (let j = i + 1; j < zips.length; j++) {
        const key = createZipPairKey(zips[i], zips[j])
        const timeDiff = timeDiffs[Math.min(i, timeDiffs.length - 1)] || 60
        const buffer = bufferTimes[Math.min(i, bufferTimes.length - 1)] || 30

        if (existing[key]) {
          // Mevcut veriyi güncelle (rolling average)
          const prev = existing[key]
          existing[key] = {
            count: prev.count + 1,
            avgTimeDiff: (prev.avgTimeDiff * prev.count + timeDiff) / (prev.count + 1),
            avgBufferTime: (prev.avgBufferTime * prev.count + buffer) / (prev.count + 1),
            lastSeen: new Date().toISOString()
          }
        } else {
          existing[key] = {
            count: 1,
            avgTimeDiff: timeDiff,
            avgBufferTime: buffer,
            lastSeen: new Date().toISOString()
          }
        }
      }
    }

    await redis.set(KEYS.ZIP_PAIRS, JSON.stringify(existing), { ex: TTL })
    console.log(`[GROUPING] ${zips.length} ZIP için çift frekansları güncellendi`)
  } catch (error) {
    console.error('[GROUPING] ZIP çifti güncelleme hatası:', error)
  }
}

// ZIP çifti frekansını al
export async function getZipPairFrequency(zip1: string, zip2: string): Promise<ZipPairData | null> {
  if (!isRedisConfigured()) return null

  try {
    const data = await redis.get<Record<string, ZipPairData>>(KEYS.ZIP_PAIRS)
    if (!data) return null

    const key = createZipPairKey(zip1, zip2)
    return data[key] || null
  } catch (error) {
    console.error('[GROUPING] ZIP çifti okuma hatası:', error)
    return null
  }
}

// Belirli ZIP için en iyi eşleşmeleri getir
export async function getTopPairsForZip(zip: string, limit: number = 10): Promise<{ zip: string; data: ZipPairData }[]> {
  if (!isRedisConfigured()) return []

  try {
    const allData = await redis.get<Record<string, ZipPairData>>(KEYS.ZIP_PAIRS)
    if (!allData) return []

    const pairs: { zip: string; data: ZipPairData }[] = []

    for (const [key, data] of Object.entries(allData)) {
      const [z1, z2] = key.split('-')
      if (z1 === zip) {
        pairs.push({ zip: z2, data })
      } else if (z2 === zip) {
        pairs.push({ zip: z1, data })
      }
    }

    // Frekansa göre sırala
    return pairs.sort((a, b) => b.data.count - a.data.count).slice(0, limit)
  } catch (error) {
    console.error('[GROUPING] Top pairs okuma hatası:', error)
    return []
  }
}

// ==========================================
// ADRES ÇİFTİ (ROTA) FONKSİYONLARI
// ==========================================

// Rota çiftini kaydet
export async function updateRoutePair(
  pickupAddress: string,
  dropoffAddress: string
): Promise<void> {
  if (!isRedisConfigured()) return

  try {
    const existing = await redis.get<Record<string, AddressPairData>>(KEYS.ROUTE_PAIRS) || {}

    // Adresleri normalize et (küçük harf, trim)
    const normalizedPickup = pickupAddress.toLowerCase().trim()
    const normalizedDropoff = dropoffAddress.toLowerCase().trim()
    const key = `${normalizedPickup}|${normalizedDropoff}`

    if (existing[key]) {
      existing[key].count += 1
    } else {
      existing[key] = {
        pickupAddress: pickupAddress,
        dropoffAddress: dropoffAddress,
        count: 1,
        avgTimeDiff: 0
      }
    }

    await redis.set(KEYS.ROUTE_PAIRS, JSON.stringify(existing), { ex: TTL })
  } catch (error) {
    console.error('[GROUPING] Rota çifti güncelleme hatası:', error)
  }
}

// Sık kullanılan rotaları getir
export async function getFrequentRoutes(minCount: number = 5): Promise<AddressPairData[]> {
  if (!isRedisConfigured()) return []

  try {
    const data = await redis.get<Record<string, AddressPairData>>(KEYS.ROUTE_PAIRS)
    if (!data) return []

    return Object.values(data)
      .filter(r => r.count >= minCount)
      .sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('[GROUPING] Sık rota okuma hatası:', error)
    return []
  }
}

// ==========================================
// GÜNLÜK İSTATİSTİKLER
// ==========================================

// Günlük istatistikleri kaydet
export async function saveDailyStats(stats: DailyStats): Promise<void> {
  if (!isRedisConfigured()) return

  try {
    const existing = await redis.get<Record<string, DailyStats>>(KEYS.DAILY_STATS) || {}
    existing[stats.date] = stats
    await redis.set(KEYS.DAILY_STATS, JSON.stringify(existing), { ex: TTL })
    console.log(`[GROUPING] Günlük istatistikler kaydedildi: ${stats.date}`)
  } catch (error) {
    console.error('[GROUPING] Günlük istatistik kaydetme hatası:', error)
  }
}

// Tüm günlük istatistikleri getir
export async function getAllDailyStats(): Promise<DailyStats[]> {
  if (!isRedisConfigured()) return []

  try {
    const data = await redis.get<Record<string, DailyStats>>(KEYS.DAILY_STATS)
    if (!data) return []
    return Object.values(data).sort((a, b) => b.date.localeCompare(a.date))
  } catch (error) {
    console.error('[GROUPING] Günlük istatistik okuma hatası:', error)
    return []
  }
}

// ==========================================
// GRUPLAMA SKORU HESAPLAMA
// ==========================================

export interface OrderForScoring {
  id: string
  pickupAddress: string
  dropoffAddress: string
  pickupTime: string // ISO veya HH:MM
  dropoffTime?: string
}

// İki sipariş arasındaki gruplama skorunu hesapla
export async function calculateGroupingScore(
  order1: OrderForScoring,
  order2: OrderForScoring
): Promise<{ score: number; reasons: string[] }> {
  let score = 0
  const reasons: string[] = []

  // ZIP kodlarını çıkar
  const pickup1Zip = extractZipFromAddress(order1.pickupAddress)
  const pickup2Zip = extractZipFromAddress(order2.pickupAddress)
  const dropoff1Zip = extractZipFromAddress(order1.dropoffAddress)
  const dropoff2Zip = extractZipFromAddress(order2.dropoffAddress)

  // 1. PICKUP KONUM SKORU
  if (order1.pickupAddress.toLowerCase() === order2.pickupAddress.toLowerCase()) {
    score += SCORING.SAME_PICKUP_ADDRESS
    reasons.push('Aynı pickup adresi (+50)')
  } else if (pickup1Zip && pickup2Zip && pickup1Zip === pickup2Zip) {
    score += SCORING.SAME_PICKUP_ZIP
    reasons.push('Aynı pickup ZIP (+30)')
  } else if (pickup1Zip && pickup2Zip && areZipsInSameCluster(pickup1Zip, pickup2Zip)) {
    score += SCORING.SAME_CLUSTER
    reasons.push('Aynı pickup cluster (+25)')
  } else if (pickup1Zip && pickup2Zip && areZipsInSameRegion(pickup1Zip, pickup2Zip)) {
    score += SCORING.SAME_PICKUP_STATE
    reasons.push('Aynı pickup bölge (+15)')
  }

  // 2. DROPOFF KONUM SKORU
  if (order1.dropoffAddress.toLowerCase() === order2.dropoffAddress.toLowerCase()) {
    score += SCORING.SAME_DROPOFF_ADDRESS
    reasons.push('Aynı dropoff adresi (+50)')
  } else if (dropoff1Zip && dropoff2Zip && dropoff1Zip === dropoff2Zip) {
    score += SCORING.SAME_DROPOFF_ZIP
    reasons.push('Aynı dropoff ZIP (+30)')
  } else if (dropoff1Zip && dropoff2Zip && areZipsInSameCluster(dropoff1Zip, dropoff2Zip)) {
    score += SCORING.SAME_CLUSTER
    reasons.push('Aynı dropoff cluster (+25)')
  } else if (dropoff1Zip && dropoff2Zip && areZipsInSameRegion(dropoff1Zip, dropoff2Zip)) {
    score += SCORING.SAME_DROPOFF_STATE
    reasons.push('Aynı dropoff bölge (+15)')
  }

  // 3. ZAMAN FARKI SKORU
  const time1 = parseTimeToMinutes(order1.pickupTime)
  const time2 = parseTimeToMinutes(order2.pickupTime)
  const timeDiff = Math.abs(time1 - time2)

  if (timeDiff <= 15) {
    score += SCORING.TIME_0_15
    reasons.push(`${timeDiff} dk fark (+40)`)
  } else if (timeDiff <= 30) {
    score += SCORING.TIME_15_30
    reasons.push(`${timeDiff} dk fark (+35)`)
  } else if (timeDiff <= 60) {
    score += SCORING.TIME_30_60
    reasons.push(`${timeDiff} dk fark (+30)`)
  } else if (timeDiff <= 90) {
    score += SCORING.TIME_60_90
    reasons.push(`${timeDiff} dk fark (+25)`)
  } else if (timeDiff <= 120) {
    score += SCORING.TIME_90_120
    reasons.push(`${timeDiff} dk fark (+15)`)
  } else if (timeDiff <= 180) {
    score += SCORING.TIME_120_180
    reasons.push(`${timeDiff} dk fark (+5)`)
  } else {
    score += SCORING.TIME_OVER_180
    reasons.push(`${timeDiff} dk fark (-5)`)
  }

  // 4. HUB BONUS
  const hub1 = isHighValueHub(order1.pickupAddress)
  const hub2 = isHighValueHub(order2.pickupAddress)
  if (hub1.isHub || hub2.isHub) {
    score += SCORING.HIGH_VALUE_HUB
    reasons.push('Yüksek gruplama hub (+20)')
  }

  // 5. BÖLGE KOMBİNASYON BONUS
  const region1 = pickup1Zip ? getRegionForZip(pickup1Zip) : null
  const region2 = pickup2Zip ? getRegionForZip(pickup2Zip) : null
  const regionBonus = getCrossRegionBonus(region1, region2)
  if (regionBonus > 0) {
    score += regionBonus
    reasons.push(`Bölge kombinasyonu (+${regionBonus})`)
  }

  // 6. ZAMAN DİLİMİ BONUS
  const hour1 = Math.floor(time1 / 60)
  if (hour1 >= 5 && hour1 <= 9) {
    score += SCORING.MORNING_SLOT
    reasons.push('Sabah slot (+15)')
  } else if (hour1 >= 12 && hour1 <= 18) {
    score += SCORING.AFTERNOON_SLOT
    reasons.push('Öğleden sonra slot (+10)')
  } else if (hour1 >= 10 && hour1 <= 11) {
    score += SCORING.MIDDAY_SLOT
    reasons.push('Düşük gruplama saati (-10)')
  }

  // 7. DÜŞÜK GRUPLAMA BÖLGESİ CEZASI
  if (isLowGroupingArea(order1.dropoffAddress) || isLowGroupingArea(order2.dropoffAddress)) {
    score += SCORING.LOW_GROUPING_AREA
    reasons.push('Düşük gruplama bölgesi (-15)')
  }

  // 8. TARİHSEL VERİ BONUSU
  if (dropoff1Zip && dropoff2Zip) {
    const historicalPair = await getZipPairFrequency(dropoff1Zip, dropoff2Zip)
    if (historicalPair && historicalPair.count >= 3) {
      score += SCORING.HISTORICAL_PAIR
      reasons.push(`Geçmişte ${historicalPair.count}x birlikte (+20)`)
    }
  }

  return { score, reasons }
}

// Zaman string'ini dakikaya çevir
function parseTimeToMinutes(timeStr: string): number {
  // ISO format veya HH:MM format
  if (timeStr.includes('T')) {
    const date = new Date(timeStr)
    return date.getHours() * 60 + date.getMinutes()
  }
  const [hours, minutes] = timeStr.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

// ==========================================
// GRUPLAMA ÖNERİSİ
// ==========================================

// Siparişler için gruplama önerileri getir
export async function getGroupingSuggestions(
  orders: OrderForScoring[]
): Promise<GroupingSuggestion[]> {
  const suggestions: GroupingSuggestion[] = []

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i]
    const suggestedPairs: { id: string; score: number; reasons: string[] }[] = []

    for (let j = 0; j < orders.length; j++) {
      if (i === j) continue

      const { score, reasons } = await calculateGroupingScore(order, orders[j])

      if (score >= THRESHOLDS.MIN_SCORE_TO_SUGGEST) {
        suggestedPairs.push({
          id: orders[j].id,
          score,
          reasons
        })
      }
    }

    // En yüksek skorlu önerileri sırala
    suggestedPairs.sort((a, b) => b.score - a.score)

    if (suggestedPairs.length > 0) {
      suggestions.push({
        orderId: order.id,
        suggestedPairIds: suggestedPairs.slice(0, 5).map(p => p.id),
        score: suggestedPairs[0].score,
        reasons: suggestedPairs[0].reasons
      })
    }
  }

  return suggestions
}

// ==========================================
// ÖĞRENME VERİSİ KAYDETME
// ==========================================

export interface GroupToLearn {
  orderIds: string[]
  orders: {
    id: string
    pickupAddress: string
    dropoffAddress: string
    pickupTime: string
    dropoffTime?: string
  }[]
}

// Tamamlanan gruplamadan öğren
export async function learnFromGrouping(groups: GroupToLearn[], date: string): Promise<{
  pairsLearned: number
  routesLearned: number
}> {
  let pairsLearned = 0
  let routesLearned = 0

  for (const group of groups) {
    if (group.orders.length < 2) continue // Solo siparişlerden öğrenme

    // ZIP kodlarını çıkar
    const zips = group.orders
      .map(o => extractZipFromAddress(o.dropoffAddress))
      .filter((z): z is string => z !== null)

    // Zaman farklarını hesapla
    const times = group.orders.map(o => parseTimeToMinutes(o.pickupTime))
    const timeDiffs: number[] = []
    const bufferTimes: number[] = []

    for (let i = 1; i < times.length; i++) {
      timeDiffs.push(Math.abs(times[i] - times[i - 1]))
      // Buffer time = dropoff time - next pickup time (basitleştirilmiş)
      bufferTimes.push(30) // Varsayılan 30 dk
    }

    // ZIP çiftlerini güncelle
    if (zips.length >= 2) {
      await updateZipPairFrequency(zips, timeDiffs, bufferTimes)
      pairsLearned += (zips.length * (zips.length - 1)) / 2
    }

    // Rota çiftlerini güncelle
    for (const order of group.orders) {
      await updateRoutePair(order.pickupAddress, order.dropoffAddress)
      routesLearned++
    }
  }

  // Meta veriyi güncelle
  await updateLearningMeta(date, groups.length, pairsLearned)

  console.log(`[GROUPING] Öğrenme tamamlandı: ${pairsLearned} ZIP çifti, ${routesLearned} rota`)

  return { pairsLearned, routesLearned }
}

// Meta veriyi güncelle
async function updateLearningMeta(date: string, groupCount: number, pairCount: number): Promise<void> {
  if (!isRedisConfigured()) return

  try {
    const existing = await redis.get<{
      totalGroupsLearned: number
      totalPairsLearned: number
      lastLearnDate: string
      learnHistory: { date: string; groups: number; pairs: number }[]
    }>(KEYS.LEARNING_META) || {
      totalGroupsLearned: 0,
      totalPairsLearned: 0,
      lastLearnDate: '',
      learnHistory: []
    }

    existing.totalGroupsLearned += groupCount
    existing.totalPairsLearned += pairCount
    existing.lastLearnDate = date
    existing.learnHistory.push({ date, groups: groupCount, pairs: pairCount })

    // Son 30 günü tut
    if (existing.learnHistory.length > 30) {
      existing.learnHistory = existing.learnHistory.slice(-30)
    }

    await redis.set(KEYS.LEARNING_META, JSON.stringify(existing), { ex: TTL })
  } catch (error) {
    console.error('[GROUPING] Meta güncelleme hatası:', error)
  }
}

// Öğrenme meta verisini getir
export async function getLearningMeta(): Promise<{
  totalGroupsLearned: number
  totalPairsLearned: number
  lastLearnDate: string
  learnHistory: { date: string; groups: number; pairs: number }[]
} | null> {
  if (!isRedisConfigured()) return null

  try {
    return await redis.get(KEYS.LEARNING_META)
  } catch (error) {
    console.error('[GROUPING] Meta okuma hatası:', error)
    return null
  }
}

// Tüm öğrenme verisini sıfırla
export async function resetLearningData(): Promise<void> {
  if (!isRedisConfigured()) return

  try {
    await Promise.all([
      redis.del(KEYS.ZIP_PAIRS),
      redis.del(KEYS.ADDRESS_PAIRS),
      redis.del(KEYS.ROUTE_PAIRS),
      redis.del(KEYS.DAILY_STATS),
      redis.del(KEYS.LEARNING_META)
    ])
    console.log('[GROUPING] Tüm öğrenme verisi sıfırlandı')
  } catch (error) {
    console.error('[GROUPING] Sıfırlama hatası:', error)
  }
}
