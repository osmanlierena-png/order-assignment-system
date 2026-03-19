import { getImportData, getAvailableDates } from '@/lib/import-store'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const PROFILES_KEY = 'canvas:driver-profiles'
const PROFILES_UPDATED_KEY = 'canvas:driver-profiles:updated'

// ========== TYPES ==========

export interface DriverProfile {
  name: string
  totalOrders: number
  totalDays: number
  ordersPerDay: number

  // Bölge uzmanlığı (bölge adı -> sipariş sayısı)
  regions: Record<string, number>
  topRegions: string[] // en çok çalıştığı 3 bölge

  // Gün müsaitliği (gün adı -> { worked: benzersiz gün sayısı, total: toplam gün veri, pct: yüzde })
  dayAvailability: Record<string, { worked: number; total: number; pct: number }>
  bestDays: string[] // en yüksek müsaitlik yüzdesine göre top 3

  // Zaman dilimi (sabah/oglen/aksam -> sipariş sayısı)
  timeSlots: Record<string, number>

  // Grup çalışma kapasitesi
  groupedOrders: number
  soloOrders: number
  groupRate: number // % kaçı gruplu

  // Performans
  avgPrice: number
  acceptRate: number // kabul oranı (varsa)

  // Pickup ZIP uzmanlığı (top 5)
  topPickupZips: Array<{ zip: string; count: number }>

  // Son güncelleme
  updatedAt: string
}

export interface DriverRecommendation {
  driverName: string
  score: number
  regionScore: number
  dayScore: number
  capacityScore: number
  performanceScore: number
  reasons: string[]
  profile: DriverProfile
}

// ========== BÖLGE TANIMLARI ==========

const REGION_ZIPS: Record<string, string[]> = {
  'DC': [], // 200xx
  'Bethesda': ['20814','20815','20816','20817','20850','20852','20854'],
  'Gaithersburg': ['20878','20874','20876','20877','20879','20886'],
  'Silver Spring': ['20901','20902','20903','20904','20905','20906','20910','20912'],
  'Frederick': ['21701','21702','21703','21704','21777'],
  'Fredericksburg': ['22401','22405','22407','22408','22553','22554','22556'],
  'Woodbridge': ['22191','22192','22193','22025'],
  'Manassas': ['20109','20110','20111','20112','20120','20121'],
  'Loudoun': ['20147','20148','20164','20165','20166','20170','20171','20175','20176'],
  'Bowie/PG': ['20706','20707','20708','20716','20720','20737','20740','20770','20774','20782','20783','20784','20785'],
  'So MD': ['20601','20602','20603','20613','20744','20745','20746','20747','20748'],
}

export function getRegionFromZip(zip: string): string {
  if (!zip) return 'Other'

  // DC - 200xx
  if (zip.startsWith('200')) return 'DC'

  // Check specific regions
  for (const [region, zips] of Object.entries(REGION_ZIPS)) {
    if (region === 'DC') continue
    if (zips.includes(zip)) return region
  }

  // NoVA fallback
  if (zip.startsWith('220') || zip.startsWith('221') || zip.startsWith('222')) return 'NoVA'

  // MD fallback
  if (zip.startsWith('20') || zip.startsWith('21')) return 'MD-Other'

  return 'Other'
}

function extractZip(address: string): string | null {
  if (!address) return null
  const m = address.match(/\b(20\d{3}|21\d{3}|22\d{3})\b/)
  return m ? m[1] : null
}

function getDayName(dateStr: string): string {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return ['Pazar','Pazartesi','Sali','Carsamba','Persembe','Cuma','Cumartesi'][day]
}

function getTimeSlot(pickupTime: string): string {
  if (!pickupTime) return 'oglen'
  // Parse "10:30 AM" or "10:30" format
  const parts = pickupTime.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i)
  if (!parts) return 'oglen'

  let hour = parseInt(parts[1])
  const ampm = parts[3]
  if (ampm?.toUpperCase() === 'PM' && hour < 12) hour += 12
  if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0

  if (hour < 9) return 'sabah'
  if (hour < 12) return 'oglen'
  return 'aksam'
}

// ========== PROFİL HESAPLAMA ==========

export async function buildDriverProfiles(): Promise<Map<string, DriverProfile>> {
  const dates = await getAvailableDates()
  if (!dates || dates.length === 0) return new Map()

  dates.sort()

  // Gün bazlı veri sayısı (toplam kaç pazartesi, salı vs var)
  const dayTotals: Record<string, Set<string>> = {
    'Pazartesi': new Set(), 'Sali': new Set(), 'Carsamba': new Set(),
    'Persembe': new Set(), 'Cuma': new Set(), 'Cumartesi': new Set(), 'Pazar': new Set()
  }

  // Driver raw data
  const driverData: Record<string, {
    orders: number
    days: Set<string>
    dayDates: Record<string, Set<string>>
    dayOrders: Record<string, number>
    regions: Record<string, number>
    pickupZips: Record<string, number>
    timeSlots: Record<string, number>
    grouped: number
    solo: number
    prices: number[]
    accepted: number
    rejected: number
  }> = {}

  for (const date of dates) {
    const dayName = getDayName(date)
    dayTotals[dayName]?.add(date)

    const data = await getImportData(date)
    if (!data?.orders) continue

    for (const order of data.orders) {
      if (!order.driverName || order.driverName === 'Atanmamış') continue

      const name = order.driverName
      if (!driverData[name]) {
        driverData[name] = {
          orders: 0, days: new Set(),
          dayDates: { Pazartesi: new Set(), Sali: new Set(), Carsamba: new Set(), Persembe: new Set(), Cuma: new Set(), Cumartesi: new Set(), Pazar: new Set() },
          dayOrders: { Pazartesi: 0, Sali: 0, Carsamba: 0, Persembe: 0, Cuma: 0, Cumartesi: 0, Pazar: 0 },
          regions: {}, pickupZips: {}, timeSlots: { sabah: 0, oglen: 0, aksam: 0 },
          grouped: 0, solo: 0, prices: [], accepted: 0, rejected: 0
        }
      }

      const d = driverData[name]
      d.orders++
      d.days.add(date)
      d.dayDates[dayName]?.add(date)
      d.dayOrders[dayName] = (d.dayOrders[dayName] || 0) + 1

      // Bölge
      const pZip = extractZip(order.pickupAddress || '')
      const dZip = extractZip(order.dropoffAddress || '')
      if (pZip) {
        const region = getRegionFromZip(pZip)
        d.regions[region] = (d.regions[region] || 0) + 1
        d.pickupZips[pZip] = (d.pickupZips[pZip] || 0) + 1
      }
      if (dZip) {
        const region = getRegionFromZip(dZip)
        if (!pZip || getRegionFromZip(pZip) !== region) {
          d.regions[region] = (d.regions[region] || 0) + 1
        }
      }

      // Zaman
      const slot = getTimeSlot(order.pickupTime || '')
      d.timeSlots[slot]++

      // Grup
      if (order.groupId) d.grouped++
      else d.solo++

      // Fiyat
      if (order.price && order.price > 5) d.prices.push(order.price)

      // Kabul/red
      if (order.driverResponse === 'ACCEPTED') d.accepted++
      else if (order.driverResponse === 'REJECTED') d.rejected++
    }
  }

  // Profillere dönüştür
  const profiles = new Map<string, DriverProfile>()

  for (const [name, d] of Object.entries(driverData)) {
    // Gün müsaitliği
    const dayAvailability: Record<string, { worked: number; total: number; pct: number }> = {}
    const dayEntries: Array<{ day: string; pct: number }> = []

    for (const dayName of Object.keys(dayTotals)) {
      const worked = d.dayDates[dayName]?.size || 0
      const total = dayTotals[dayName]?.size || 1
      const pct = Math.round((worked / total) * 100)
      dayAvailability[dayName] = { worked, total, pct }
      if (pct > 0) dayEntries.push({ day: dayName, pct })
    }

    dayEntries.sort((a, b) => b.pct - a.pct)

    // Top bölgeler
    const regionEntries = Object.entries(d.regions).sort((a, b) => b[1] - a[1])

    // Top ZIP'ler
    const zipEntries = Object.entries(d.pickupZips)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([zip, count]) => ({ zip, count }))

    // Ortalama fiyat
    const avgPrice = d.prices.length > 0
      ? d.prices.reduce((a, b) => a + b, 0) / d.prices.length
      : 0

    // Kabul oranı
    const responded = d.accepted + d.rejected
    const acceptRate = responded > 0 ? Math.round((d.accepted / responded) * 100) : -1

    const totalOrders = d.orders
    const totalDays = d.days.size

    profiles.set(name, {
      name,
      totalOrders,
      totalDays,
      ordersPerDay: totalDays > 0 ? Math.round((totalOrders / totalDays) * 10) / 10 : 0,
      regions: d.regions,
      topRegions: regionEntries.slice(0, 3).map(([r]) => r),
      dayAvailability,
      bestDays: dayEntries.slice(0, 3).map(e => e.day),
      timeSlots: d.timeSlots,
      groupedOrders: d.grouped,
      soloOrders: d.solo,
      groupRate: totalOrders > 0 ? Math.round((d.grouped / totalOrders) * 100) : 0,
      avgPrice: Math.round(avgPrice * 10) / 10,
      acceptRate,
      topPickupZips: zipEntries,
      updatedAt: new Date().toISOString()
    })
  }

  // Redis'e kaydet
  const profilesObj: Record<string, DriverProfile> = {}
  for (const [name, profile] of profiles) {
    profilesObj[name] = profile
  }
  await redis.set(PROFILES_KEY, JSON.stringify(profilesObj))
  await redis.set(PROFILES_UPDATED_KEY, new Date().toISOString())

  return profiles
}

// ========== PROFİL OKUMA ==========

export async function getDriverProfiles(): Promise<Map<string, DriverProfile>> {
  try {
    const cached = await redis.get(PROFILES_KEY)
    if (cached) {
      const obj = typeof cached === 'string' ? JSON.parse(cached) : cached as Record<string, DriverProfile>
      const map = new Map<string, DriverProfile>()
      for (const [name, profile] of Object.entries(obj)) {
        map.set(name, profile as DriverProfile)
      }
      return map
    }
  } catch (e) {
    console.error('Error reading driver profiles from cache:', e)
  }

  // Cache yoksa hesapla
  return buildDriverProfiles()
}

export async function getProfilesLastUpdated(): Promise<string | null> {
  return await redis.get(PROFILES_UPDATED_KEY)
}

// ========== ÖNERİ MOTORU V2 ==========

export function recommendDrivers(
  profiles: Map<string, DriverProfile>,
  pickupZip: string,
  dropoffZip: string | null,
  dayOfWeek: string, // "Pazartesi", "Sali", etc
  timeSlot: string, // "sabah", "oglen", "aksam"
  limit: number = 8
): DriverRecommendation[] {
  const pickupRegion = getRegionFromZip(pickupZip)
  const dropoffRegion = dropoffZip ? getRegionFromZip(dropoffZip) : null

  const recommendations: DriverRecommendation[] = []

  for (const [_, profile] of profiles) {
    let regionScore = 0
    let dayScore = 0
    let capacityScore = 0
    let performanceScore = 0
    const reasons: string[] = []

    // ===== 1. BÖLGE UYUMU (max 40 puan) =====
    // Tam ZIP eşleşmesi
    const zipMatch = profile.topPickupZips.find(z => z.zip === pickupZip)
    if (zipMatch) {
      regionScore += Math.min(25, zipMatch.count * 5)
      reasons.push(`${pickupZip}'de ${zipMatch.count}x teslim`)
    }

    // Bölge eşleşmesi
    const regionCount = profile.regions[pickupRegion] || 0
    if (regionCount > 0) {
      regionScore += Math.min(15, regionCount * 1.5)
      if (!zipMatch) reasons.push(`${pickupRegion} uzmanı (${regionCount} sip)`)
    }

    // Dropoff bölge bonusu
    if (dropoffRegion && dropoffRegion !== pickupRegion) {
      const dropRegionCount = profile.regions[dropoffRegion] || 0
      if (dropRegionCount > 0) {
        regionScore += Math.min(5, dropRegionCount * 0.5)
      }
    }

    regionScore = Math.min(40, regionScore)

    // ===== 2. GÜN MÜSAİTLİĞİ (max 25 puan) =====
    const dayInfo = profile.dayAvailability[dayOfWeek]
    if (dayInfo && dayInfo.pct > 0) {
      dayScore = Math.min(25, Math.round(dayInfo.pct * 0.5))
      if (dayInfo.pct >= 40) {
        const shortDay = dayOfWeek.substring(0, 3)
        reasons.push(`${shortDay} %${dayInfo.pct} müsait`)
      }
    }

    // ===== 3. KAPASİTE (max 20 puan) =====
    // Günlük sipariş kapasitesi
    if (profile.ordersPerDay >= 2.0) {
      capacityScore += 10
    } else if (profile.ordersPerDay >= 1.5) {
      capacityScore += 7
    } else if (profile.ordersPerDay >= 1.0) {
      capacityScore += 4
    }

    // Grup çalışma yetkinliği
    if (profile.groupRate >= 50) {
      capacityScore += 5
    } else if (profile.groupRate >= 30) {
      capacityScore += 3
    }

    // Zaman dilimi uyumu
    const slotCount = profile.timeSlots[timeSlot] || 0
    if (slotCount > 0) {
      capacityScore += Math.min(5, slotCount * 0.5)
    }

    capacityScore = Math.min(20, capacityScore)

    // ===== 4. PERFORMANS (max 15 puan) =====
    // Tecrübe
    performanceScore += Math.min(8, profile.totalOrders * 0.15)

    // Kabul oranı
    if (profile.acceptRate >= 0) {
      performanceScore += Math.min(7, (profile.acceptRate / 100) * 7)
    }

    performanceScore = Math.min(15, performanceScore)

    // ===== TOPLAM =====
    const totalScore = Math.round(regionScore + dayScore + capacityScore + performanceScore)

    // Minimum eşik: 15 puan (daha düşük eşik, daha fazla öneri)
    if (totalScore >= 15) {
      recommendations.push({
        driverName: profile.name,
        score: totalScore,
        regionScore: Math.round(regionScore),
        dayScore: Math.round(dayScore),
        capacityScore: Math.round(capacityScore),
        performanceScore: Math.round(performanceScore),
        reasons,
        profile
      })
    }
  }

  // Skora göre sırala
  recommendations.sort((a, b) => b.score - a.score)

  return recommendations.slice(0, limit)
}
