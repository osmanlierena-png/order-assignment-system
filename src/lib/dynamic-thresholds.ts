/**
 * DİNAMİK BİRLEŞTİRME EŞİK SİSTEMİ
 *
 * Günlük sipariş karakteristiklerine göre birleştirme parametrelerini
 * otomatik olarak ayarlar. Bazı günler siparişler birleşmeye çok uygun,
 * diğer günler değil - bu sistem buna adapte olur.
 *
 * TEMEL PRENSİP:
 * - Yanlış birleştirme yapmaktansa tekil bırakmak tercih edilir
 * - Optimal birleştirme oranı: %50-65 (DC Metro standardı)
 * - Her gün farklı olabilir - esnek olmak lazım
 */

import { timeToMinutes, extractZipCode, getRegion } from './utils'
import { getZipRegion, isKnownZip, getZipDistance, isReachableInTime } from './distance'

// =====================================================
// TİPLER
// =====================================================

export interface OrderForAnalysis {
  id: string
  orderNumber: string
  pickupTime: string
  dropoffTime: string
  pickupAddress: string
  dropoffAddress: string
  timeSlot: string
  groupId: string | null
}

// Günlük sipariş analizi sonucu
export interface DailyOrderAnalysis {
  // Temel metrikler
  totalOrders: number
  ungroupedOrders: number

  // Coğrafi dağılım
  regionDistribution: Record<string, number>  // { 'DC': 15, 'NoVA': 10, ... }
  farRegionCount: number                       // FAR bölgeden sipariş sayısı
  uniqueZipCount: number                       // Farklı ZIP sayısı
  avgDistanceBetweenOrders: number             // Ortalama sipariş arası mesafe (km)

  // Zaman dağılımı
  timeSlotDistribution: Record<string, number> // { 'MORNING': 20, 'AFTERNOON': 15, ... }
  avgTimeBetweenPickups: number                // Ortalama pickup arası süre (dk)
  peakHourConcentration: number                // Yoğun saat yoğunlaşması (0-1)

  // Birleştirilebilirlik puanı
  mergeabilityScore: number                    // 0-100 (yüksek = kolay birleştirme)

  // Önerilen parametreler
  recommendedThresholds: DynamicThresholds

  // Açıklama
  summary: string
}

// Dinamik eşik değerleri
export interface DynamicThresholds {
  // Buffer limitleri
  minBuffer: number              // Minimum buffer (dk)
  maxBuffer: number              // Maksimum buffer (dk)
  optimalBufferRange: [number, number]  // Optimal buffer aralığı

  // Skor limitleri
  minMergeScore: number          // Minimum birleştirme skoru (0-100)

  // Oran hedefleri
  targetMergeRatio: [number, number]  // [min, max] hedef birleştirme oranı

  // Mesafe limitleri
  maxDistanceKm: number          // Maksimum birleştirme mesafesi

  // Katman ayarları
  enableTightMerges: boolean     // Sıkı birleştirmeler açık mı?
  enableLooseMerges: boolean     // Gevşek birleştirmeler açık mı?
  maxGroupSize: number           // Maksimum grup boyutu

  // Bölge kısıtlamaları
  allowCrossRegion: boolean      // Farklı bölge birleştirmeleri?
  blockedRegions: string[]       // Birleştirme yapılmayacak bölgeler

  // Risk toleransı
  riskLevel: 'conservative' | 'moderate' | 'aggressive'
}

// =====================================================
// VARSAYILAN DEĞERLER
// =====================================================

const DEFAULT_THRESHOLDS: DynamicThresholds = {
  minBuffer: 15,
  maxBuffer: 90,
  optimalBufferRange: [20, 60],
  minMergeScore: 55,
  targetMergeRatio: [0.50, 0.65],
  maxDistanceKm: 25,
  enableTightMerges: true,
  enableLooseMerges: true,
  maxGroupSize: 4,
  allowCrossRegion: true,
  blockedRegions: ['FAR'],
  riskLevel: 'moderate'
}

// Konservatif eşikler (düşük riskli günler için)
const CONSERVATIVE_THRESHOLDS: DynamicThresholds = {
  minBuffer: 20,
  maxBuffer: 60,
  optimalBufferRange: [25, 50],
  minMergeScore: 70,
  targetMergeRatio: [0.40, 0.55],
  maxDistanceKm: 15,
  enableTightMerges: true,
  enableLooseMerges: false,
  maxGroupSize: 3,
  allowCrossRegion: false,
  blockedRegions: ['FAR', 'MD-BAL', 'VA-S'],
  riskLevel: 'conservative'
}

// Agresif eşikler (birleşmeye uygun günler için)
const AGGRESSIVE_THRESHOLDS: DynamicThresholds = {
  minBuffer: 10,
  maxBuffer: 120,
  optimalBufferRange: [15, 75],
  minMergeScore: 45,
  targetMergeRatio: [0.55, 0.70],
  maxDistanceKm: 35,
  enableTightMerges: true,
  enableLooseMerges: true,
  maxGroupSize: 5,
  allowCrossRegion: true,
  blockedRegions: ['FAR'],
  riskLevel: 'aggressive'
}

// =====================================================
// ANALİZ FONKSİYONLARI
// =====================================================

/**
 * Günlük siparişleri analiz et ve birleştirilebilirlik puanı hesapla
 */
export function analyzeDailyOrders(orders: OrderForAnalysis[]): DailyOrderAnalysis {
  const ungroupedOrders = orders.filter(o => !o.groupId)

  // Coğrafi dağılım analizi
  const regionDistribution: Record<string, number> = {}
  const zipCodes = new Set<string>()
  let farRegionCount = 0

  ungroupedOrders.forEach(order => {
    const pickupZip = extractZipCode(order.pickupAddress)
    const dropoffZip = extractZipCode(order.dropoffAddress)

    if (pickupZip) {
      zipCodes.add(pickupZip)
      const region = isKnownZip(pickupZip) ? getZipRegion(pickupZip) : getRegion(pickupZip)
      regionDistribution[region] = (regionDistribution[region] || 0) + 1
      if (region === 'FAR' || region === 'UNKNOWN') farRegionCount++
    }

    if (dropoffZip) {
      zipCodes.add(dropoffZip)
      const region = isKnownZip(dropoffZip) ? getZipRegion(dropoffZip) : getRegion(dropoffZip)
      regionDistribution[region] = (regionDistribution[region] || 0) + 1
      if (region === 'FAR' || region === 'UNKNOWN') farRegionCount++
    }
  })

  // Zaman dağılımı analizi
  const timeSlotDistribution: Record<string, number> = {}
  const pickupMinutesList: number[] = []

  ungroupedOrders.forEach(order => {
    timeSlotDistribution[order.timeSlot] = (timeSlotDistribution[order.timeSlot] || 0) + 1
    const pickupMin = timeToMinutes(order.pickupTime)
    if (!isNaN(pickupMin)) pickupMinutesList.push(pickupMin)
  })

  // Pickup arası süreleri hesapla
  pickupMinutesList.sort((a, b) => a - b)
  let totalTimeBetween = 0
  for (let i = 1; i < pickupMinutesList.length; i++) {
    totalTimeBetween += pickupMinutesList[i] - pickupMinutesList[i - 1]
  }
  const avgTimeBetweenPickups = pickupMinutesList.length > 1
    ? totalTimeBetween / (pickupMinutesList.length - 1)
    : 0

  // Yoğun saat yoğunlaşması (1 saatlik pencerede max sipariş oranı)
  let maxInHour = 0
  for (let hour = 6; hour <= 20; hour++) {
    const hourStart = hour * 60
    const hourEnd = (hour + 1) * 60
    const inHour = pickupMinutesList.filter(m => m >= hourStart && m < hourEnd).length
    maxInHour = Math.max(maxInHour, inHour)
  }
  const peakHourConcentration = ungroupedOrders.length > 0
    ? maxInHour / ungroupedOrders.length
    : 0

  // Ortalama sipariş arası mesafe hesapla
  let totalDistance = 0
  let distanceCount = 0

  for (let i = 0; i < ungroupedOrders.length; i++) {
    for (let j = i + 1; j < Math.min(i + 10, ungroupedOrders.length); j++) {
      const zip1 = extractZipCode(ungroupedOrders[i].dropoffAddress)
      const zip2 = extractZipCode(ungroupedOrders[j].pickupAddress)
      if (zip1 && zip2) {
        const distance = getZipDistance(zip1, zip2)
        if (distance) {
          totalDistance += distance.distanceKm
          distanceCount++
        }
      }
    }
  }
  const avgDistanceBetweenOrders = distanceCount > 0 ? totalDistance / distanceCount : 0

  // Birleştirilebilirlik puanı hesapla (0-100)
  const mergeabilityScore = calculateMergeabilityScore({
    orderCount: ungroupedOrders.length,
    avgTimeBetweenPickups,
    peakHourConcentration,
    avgDistanceBetweenOrders,
    farRegionRatio: ungroupedOrders.length > 0 ? farRegionCount / ungroupedOrders.length / 2 : 0,
    regionDiversity: Object.keys(regionDistribution).length
  })

  // Önerilen eşikleri hesapla
  const recommendedThresholds = calculateRecommendedThresholds({
    mergeabilityScore,
    orderCount: ungroupedOrders.length,
    avgTimeBetweenPickups,
    avgDistanceBetweenOrders,
    farRegionRatio: ungroupedOrders.length > 0 ? farRegionCount / ungroupedOrders.length / 2 : 0
  })

  // Özet oluştur
  const summary = generateAnalysisSummary({
    mergeabilityScore,
    orderCount: ungroupedOrders.length,
    avgTimeBetweenPickups,
    avgDistanceBetweenOrders,
    regionDiversity: Object.keys(regionDistribution).length,
    recommendedThresholds
  })

  return {
    totalOrders: orders.length,
    ungroupedOrders: ungroupedOrders.length,
    regionDistribution,
    farRegionCount,
    uniqueZipCount: zipCodes.size,
    avgDistanceBetweenOrders: Math.round(avgDistanceBetweenOrders * 10) / 10,
    timeSlotDistribution,
    avgTimeBetweenPickups: Math.round(avgTimeBetweenPickups),
    peakHourConcentration: Math.round(peakHourConcentration * 100) / 100,
    mergeabilityScore,
    recommendedThresholds,
    summary
  }
}

/**
 * Birleştirilebilirlik puanı hesapla
 */
function calculateMergeabilityScore(params: {
  orderCount: number
  avgTimeBetweenPickups: number
  peakHourConcentration: number
  avgDistanceBetweenOrders: number
  farRegionRatio: number
  regionDiversity: number
}): number {
  let score = 50 // Başlangıç puanı

  // 1. Sipariş sayısı etkisi (10-50 arası optimal)
  if (params.orderCount >= 15 && params.orderCount <= 60) {
    score += 10
  } else if (params.orderCount >= 10 && params.orderCount <= 80) {
    score += 5
  } else if (params.orderCount < 10) {
    score -= 15 // Çok az sipariş - birleştirme fırsatı düşük
  } else {
    score -= 5 // Çok fazla sipariş - karmaşıklık artar
  }

  // 2. Pickup arası süre etkisi (15-45dk optimal)
  if (params.avgTimeBetweenPickups >= 15 && params.avgTimeBetweenPickups <= 45) {
    score += 15 // Mükemmel aralık
  } else if (params.avgTimeBetweenPickups >= 10 && params.avgTimeBetweenPickups <= 60) {
    score += 8 // İyi aralık
  } else if (params.avgTimeBetweenPickups < 10) {
    score -= 10 // Çok sık - aynı saatte çakışma riski
  } else {
    score -= 5 // Çok seyrek - uzun buffer gerekir
  }

  // 3. Yoğunlaşma etkisi (0.2-0.4 optimal)
  if (params.peakHourConcentration >= 0.15 && params.peakHourConcentration <= 0.35) {
    score += 10 // İyi dağılım
  } else if (params.peakHourConcentration > 0.5) {
    score -= 10 // Çok yoğun - çakışma riski
  }

  // 4. Mesafe etkisi (0-15km optimal)
  if (params.avgDistanceBetweenOrders <= 10) {
    score += 15 // Çok yakın - mükemmel
  } else if (params.avgDistanceBetweenOrders <= 20) {
    score += 8 // Yakın - iyi
  } else if (params.avgDistanceBetweenOrders <= 30) {
    score += 0 // Orta
  } else {
    score -= 15 // Uzak - birleştirme zor
  }

  // 5. Uzak bölge etkisi
  if (params.farRegionRatio > 0.3) {
    score -= 20 // Çok fazla uzak bölge
  } else if (params.farRegionRatio > 0.15) {
    score -= 10
  } else if (params.farRegionRatio > 0.05) {
    score -= 5
  }

  // 6. Bölge çeşitliliği (2-5 bölge optimal)
  if (params.regionDiversity >= 2 && params.regionDiversity <= 4) {
    score += 5 // Normal çeşitlilik
  } else if (params.regionDiversity === 1) {
    score += 10 // Tek bölge - mükemmel
  } else if (params.regionDiversity > 6) {
    score -= 10 // Çok fazla bölge
  }

  // 0-100 arasında sınırla
  return Math.max(0, Math.min(100, score))
}

/**
 * Önerilen eşikleri hesapla
 */
function calculateRecommendedThresholds(params: {
  mergeabilityScore: number
  orderCount: number
  avgTimeBetweenPickups: number
  avgDistanceBetweenOrders: number
  farRegionRatio: number
}): DynamicThresholds {
  // Birleştirilebilirlik puanına göre temel strateji seç
  let baseThresholds: DynamicThresholds

  if (params.mergeabilityScore >= 70) {
    // Yüksek birleştirilebilirlik - agresif ol
    baseThresholds = { ...AGGRESSIVE_THRESHOLDS }
  } else if (params.mergeabilityScore >= 45) {
    // Orta birleştirilebilirlik - dengeli ol
    baseThresholds = { ...DEFAULT_THRESHOLDS }
  } else {
    // Düşük birleştirilebilirlik - konservatif ol
    baseThresholds = { ...CONSERVATIVE_THRESHOLDS }
  }

  // Parametrelere göre ince ayar yap

  // 1. Pickup arası süreye göre buffer ayarla
  if (params.avgTimeBetweenPickups < 15) {
    // Çok sık siparişler - kısa buffer gerekli
    baseThresholds.maxBuffer = Math.min(baseThresholds.maxBuffer, 60)
    baseThresholds.minBuffer = Math.max(baseThresholds.minBuffer, 15)
  } else if (params.avgTimeBetweenPickups > 60) {
    // Seyrek siparişler - uzun buffer kabul edilebilir
    baseThresholds.maxBuffer = Math.min(120, baseThresholds.maxBuffer + 30)
  }

  // 2. Mesafeye göre ayarla
  if (params.avgDistanceBetweenOrders > 25) {
    // Uzak siparişler - mesafe limitini artır ama daha konservatif ol
    baseThresholds.maxDistanceKm = Math.max(baseThresholds.maxDistanceKm, params.avgDistanceBetweenOrders + 10)
    baseThresholds.minMergeScore = Math.min(baseThresholds.minMergeScore + 10, 80)
  } else if (params.avgDistanceBetweenOrders < 10) {
    // Yakın siparişler - daha agresif olunabilir
    baseThresholds.minMergeScore = Math.max(40, baseThresholds.minMergeScore - 10)
  }

  // 3. Uzak bölge oranına göre kısıtla
  if (params.farRegionRatio > 0.2) {
    // Çok fazla uzak bölge - cross-region kapat
    baseThresholds.allowCrossRegion = false
    baseThresholds.blockedRegions = ['FAR', 'MD-BAL', 'VA-S']
    baseThresholds.enableLooseMerges = false
  }

  // 4. Sipariş sayısına göre grup boyutu ayarla
  if (params.orderCount < 15) {
    baseThresholds.maxGroupSize = Math.min(3, baseThresholds.maxGroupSize)
  } else if (params.orderCount > 50) {
    baseThresholds.maxGroupSize = Math.min(5, baseThresholds.maxGroupSize + 1)
  }

  // 5. Hedef birleştirme oranını ayarla
  if (params.mergeabilityScore >= 70) {
    baseThresholds.targetMergeRatio = [0.55, 0.70]
  } else if (params.mergeabilityScore >= 45) {
    baseThresholds.targetMergeRatio = [0.45, 0.60]
  } else {
    baseThresholds.targetMergeRatio = [0.35, 0.50]
  }

  return baseThresholds
}

/**
 * Analiz özeti oluştur
 */
function generateAnalysisSummary(params: {
  mergeabilityScore: number
  orderCount: number
  avgTimeBetweenPickups: number
  avgDistanceBetweenOrders: number
  regionDiversity: number
  recommendedThresholds: DynamicThresholds
}): string {
  const lines: string[] = []

  // Genel değerlendirme
  if (params.mergeabilityScore >= 70) {
    lines.push('📈 YÜKSEK BİRLEŞTİRİLEBİLİRLİK: Siparişler birleşmeye çok uygun')
  } else if (params.mergeabilityScore >= 45) {
    lines.push('📊 ORTA BİRLEŞTİRİLEBİLİRLİK: Normal birleştirme fırsatları mevcut')
  } else {
    lines.push('📉 DÜŞÜK BİRLEŞTİRİLEBİLİRLİK: Siparişler birleşmeye uygun değil, tekil kalması tercih edilir')
  }

  // Metrik detayları
  lines.push(`• Sipariş sayısı: ${params.orderCount}`)
  lines.push(`• Ortalama pickup arası: ${params.avgTimeBetweenPickups}dk`)
  lines.push(`• Ortalama mesafe: ${params.avgDistanceBetweenOrders}km`)
  lines.push(`• Bölge çeşitliliği: ${params.regionDiversity} farklı bölge`)

  // Öneriler
  lines.push(`\n⚙️ ÖNERİLEN AYARLAR:`)
  lines.push(`• Strateji: ${params.recommendedThresholds.riskLevel.toUpperCase()}`)
  lines.push(`• Buffer aralığı: ${params.recommendedThresholds.minBuffer}-${params.recommendedThresholds.maxBuffer}dk`)
  lines.push(`• Min skor: ${params.recommendedThresholds.minMergeScore}`)
  lines.push(`• Hedef oran: %${Math.round(params.recommendedThresholds.targetMergeRatio[0] * 100)}-${Math.round(params.recommendedThresholds.targetMergeRatio[1] * 100)}`)
  lines.push(`• Max grup: ${params.recommendedThresholds.maxGroupSize} sipariş`)

  return lines.join('\n')
}

// =====================================================
// VALİDASYON FONKSİYONLARI
// =====================================================

/**
 * İki sipariş birleştirilebilir mi? (Dinamik eşiklerle)
 */
export function canMergeWithDynamicThresholds(
  order1: OrderForAnalysis,
  order2: OrderForAnalysis,
  thresholds: DynamicThresholds
): { canMerge: boolean; reason: string; score?: number } {
  // 1. Zamanları hesapla
  const pickup1 = timeToMinutes(order1.pickupTime)
  const dropoff1 = timeToMinutes(order1.dropoffTime)
  const pickup2 = timeToMinutes(order2.pickupTime)
  const dropoff2 = timeToMinutes(order2.dropoffTime)

  if (isNaN(pickup1) || isNaN(dropoff1) || isNaN(pickup2) || isNaN(dropoff2)) {
    return { canMerge: false, reason: 'Geçersiz zaman bilgisi' }
  }

  // 2. Aynı pickup kontrolü
  if (pickup1 === pickup2) {
    return { canMerge: false, reason: 'Aynı saatte iki sipariş alınamaz' }
  }

  // 3. Sıralama ve buffer hesapla
  const [first, second] = pickup1 < pickup2
    ? [{ ...order1, pickup: pickup1, dropoff: dropoff1 }, { ...order2, pickup: pickup2, dropoff: dropoff2 }]
    : [{ ...order2, pickup: pickup2, dropoff: dropoff2 }, { ...order1, pickup: pickup1, dropoff: dropoff1 }]

  const buffer = second.pickup - first.dropoff

  // 4. Zaman çakışması kontrolü
  if (buffer < 0) {
    return { canMerge: false, reason: `Zaman çakışması: ${buffer}dk` }
  }

  // 5. Buffer limitleri kontrolü
  if (buffer < thresholds.minBuffer) {
    return { canMerge: false, reason: `Buffer çok kısa: ${buffer}dk < ${thresholds.minBuffer}dk minimum` }
  }

  if (buffer > thresholds.maxBuffer) {
    return { canMerge: false, reason: `Buffer çok uzun: ${buffer}dk > ${thresholds.maxBuffer}dk maksimum` }
  }

  // 6. Mesafe kontrolü
  const dropoffZip = extractZipCode(first.dropoffAddress)
  const pickupZip = extractZipCode(second.pickupAddress)

  if (dropoffZip && pickupZip) {
    // Bölge kontrolü
    const fromRegion = isKnownZip(dropoffZip) ? getZipRegion(dropoffZip) : getRegion(dropoffZip)
    const toRegion = isKnownZip(pickupZip) ? getZipRegion(pickupZip) : getRegion(pickupZip)

    // Engellenen bölge kontrolü
    if (thresholds.blockedRegions.includes(fromRegion) || thresholds.blockedRegions.includes(toRegion)) {
      return { canMerge: false, reason: `Engellenen bölge: ${fromRegion} → ${toRegion}` }
    }

    // Cross-region kontrolü
    if (!thresholds.allowCrossRegion && fromRegion !== toRegion) {
      return { canMerge: false, reason: `Farklı bölge birleştirmesi kapalı: ${fromRegion} → ${toRegion}` }
    }

    // Mesafe ve ulaşılabilirlik kontrolü
    const reachability = isReachableInTime(dropoffZip, pickupZip, buffer)
    if (!reachability.reachable) {
      return { canMerge: false, reason: reachability.reason }
    }

    // Mesafe limiti kontrolü
    if (reachability.distance && reachability.distance.distanceKm > thresholds.maxDistanceKm) {
      return {
        canMerge: false,
        reason: `Mesafe çok uzak: ${reachability.distance.distanceKm}km > ${thresholds.maxDistanceKm}km`
      }
    }
  }

  // 7. Skor hesapla
  let score = 50 // Baz skor

  // Buffer skoru (optimal aralıkta +20, yakın +10)
  const [optMin, optMax] = thresholds.optimalBufferRange
  if (buffer >= optMin && buffer <= optMax) {
    score += 20
  } else if (buffer >= optMin - 10 && buffer <= optMax + 15) {
    score += 10
  }

  // Aynı time slot bonus
  if (order1.timeSlot === order2.timeSlot) {
    score += 15
  }

  // Aynı/yakın ZIP bonus
  if (dropoffZip && pickupZip) {
    if (dropoffZip === pickupZip) {
      score += 15
    } else if (dropoffZip.substring(0, 3) === pickupZip.substring(0, 3)) {
      score += 10
    }
  }

  // 8. Minimum skor kontrolü
  if (score < thresholds.minMergeScore) {
    return { canMerge: false, reason: `Skor yetersiz: ${score} < ${thresholds.minMergeScore}`, score }
  }

  return { canMerge: true, reason: 'OK', score }
}

/**
 * Mevcut birleştirme oranını hesapla
 */
export function calculateCurrentMergeRatio(orders: OrderForAnalysis[]): {
  ratio: number
  grouped: number
  ungrouped: number
  groups: number
} {
  const grouped = orders.filter(o => o.groupId).length
  const ungrouped = orders.filter(o => !o.groupId).length
  const uniqueGroups = new Set(orders.filter(o => o.groupId).map(o => o.groupId)).size

  return {
    ratio: orders.length > 0 ? grouped / orders.length : 0,
    grouped,
    ungrouped,
    groups: uniqueGroups
  }
}

/**
 * Birleştirme oranı hedefe uygun mu?
 */
export function isMergeRatioInTarget(
  currentRatio: number,
  thresholds: DynamicThresholds
): { inTarget: boolean; status: 'LOW' | 'OK' | 'HIGH'; message: string } {
  const [minTarget, maxTarget] = thresholds.targetMergeRatio

  if (currentRatio < minTarget) {
    return {
      inTarget: false,
      status: 'LOW',
      message: `Birleştirme oranı düşük: %${Math.round(currentRatio * 100)} (hedef: %${Math.round(minTarget * 100)}-${Math.round(maxTarget * 100)})`
    }
  }

  if (currentRatio > maxTarget) {
    return {
      inTarget: false,
      status: 'HIGH',
      message: `Birleştirme oranı yüksek: %${Math.round(currentRatio * 100)} (hedef: %${Math.round(minTarget * 100)}-${Math.round(maxTarget * 100)}) - zorla birleştirme riski!`
    }
  }

  return {
    inTarget: true,
    status: 'OK',
    message: `Birleştirme oranı optimal: %${Math.round(currentRatio * 100)}`
  }
}

// =====================================================
// EXPORT
// =====================================================

export {
  DEFAULT_THRESHOLDS,
  CONSERVATIVE_THRESHOLDS,
  AGGRESSIVE_THRESHOLDS
}
