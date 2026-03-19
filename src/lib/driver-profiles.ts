import { getImportData, getAvailableDates } from '@/lib/import-store'
import { geocodeAddress, haversineDistance, normalizeAddress, GeoResult } from '@/lib/geocoding'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const DRIVER_LOCATIONS_PREFIX = 'driver:locations:'
const DRIVER_INDEX_KEY = 'driver:locations:index'
const PROFILES_UPDATED_KEY = 'driver:profiles:updated'

// ========== TYPES ==========

export interface DriverLocation {
  address: string         // Orijinal adres
  normalized: string      // Normalize adres
  lat: number
  lng: number
  count: number           // Kaç kez bu adrese gidildi
  lastDate: string        // Son tarih
  type: 'pickup' | 'dropoff' | 'both'
}

export interface DriverStats {
  totalOrders: number
  totalDays: number
  ordersPerDay: number
  grouped: number
  solo: number
  groupRate: number
  dayAvailability: Record<string, number> // gün adı → müsaitlik yüzdesi
  bestDays: string[]
  timeSlots: Record<string, number> // sabah/oglen/aksam → sayı
  acceptRate: number // -1 if unknown
}

export interface DriverProfileData {
  name: string
  locations: DriverLocation[]
  stats: DriverStats
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
  profile: {
    totalOrders: number
    ordersPerDay: number
    topRegions: string[]
    bestDays: string[]
    groupRate: number
  }
}

// ========== BÖLGE (sadece UI gösterimi için) ==========

export function getRegionFromCoords(lat: number, lng: number): string {
  // DC downtown
  if (lat >= 38.87 && lat <= 38.96 && lng >= -77.08 && lng <= -76.97) return 'DC'
  // Bethesda/Chevy Chase
  if (lat >= 38.96 && lat <= 39.02 && lng >= -77.14 && lng <= -77.07) return 'Bethesda'
  // Silver Spring
  if (lat >= 38.98 && lat <= 39.07 && lng >= -77.07 && lng <= -76.96) return 'Silver Spring'
  // Gaithersburg
  if (lat >= 39.10 && lat <= 39.20 && lng >= -77.25 && lng <= -77.12) return 'Gaithersburg'
  // Frederick
  if (lat >= 39.35 && lat <= 39.50 && lng >= -77.50 && lng <= -77.30) return 'Frederick'
  // Fredericksburg
  if (lat >= 38.25 && lat <= 38.47 && lng >= -77.60 && lng <= -77.30) return 'Fredericksburg'
  // Woodbridge
  if (lat >= 38.60 && lat <= 38.70 && lng >= -77.35 && lng <= -77.25) return 'Woodbridge'
  // Arlington/Alexandria
  if (lat >= 38.80 && lat <= 38.91 && lng >= -77.15 && lng <= -77.03) return 'Arlington'
  // Tysons/McLean/Vienna
  if (lat >= 38.87 && lat <= 38.97 && lng >= -77.30 && lng <= -77.15) return 'Tysons'
  // Fairfax
  if (lat >= 38.78 && lat <= 38.88 && lng >= -77.40 && lng <= -77.25) return 'Fairfax'
  // Bowie/PG County
  if (lat >= 38.88 && lat <= 39.05 && lng >= -76.90 && lng <= -76.70) return 'Bowie/PG'
  // NoVA general
  if (lat >= 38.70 && lat <= 39.10 && lng >= -77.55 && lng <= -77.03) return 'NoVA'
  // MD general
  if (lat >= 38.70 && lat <= 39.25 && lng >= -77.10 && lng <= -76.60) return 'MD'
  return 'Other'
}

// ========== SÜRÜCÜ LOKASYON CRUD ==========

// Sürücü profili oku
export async function getDriverProfile(driverName: string): Promise<DriverProfileData | null> {
  try {
    const key = DRIVER_LOCATIONS_PREFIX + driverName.replace(/[^a-zA-Z0-9]/g, '_')
    const data = await redis.get(key)
    if (!data) return null
    return typeof data === 'string' ? JSON.parse(data) : data as DriverProfileData
  } catch {
    return null
  }
}

// Sürücü profili kaydet
async function saveDriverProfile(profile: DriverProfileData): Promise<void> {
  const key = DRIVER_LOCATIONS_PREFIX + profile.name.replace(/\s+/g, '_')
  await redis.set(key, JSON.stringify(profile))

  // Index'e ekle
  await redis.sadd(DRIVER_INDEX_KEY, profile.name)
}

// Tüm sürücü isimlerini al
export async function getAllDriverNames(): Promise<string[]> {
  try {
    return await redis.smembers(DRIVER_INDEX_KEY) || []
  } catch {
    return []
  }
}

// Tüm sürücü profillerini al
export async function getAllDriverProfiles(): Promise<Map<string, DriverProfileData>> {
  const names = await getAllDriverNames()
  const profiles = new Map<string, DriverProfileData>()

  for (const name of names) {
    const profile = await getDriverProfile(name)
    if (profile) profiles.set(name, profile)
  }

  return profiles
}

// ========== CANLI ÖĞRENME ==========

// Bir atama yapıldığında sürücü profilini güncelle
export async function learnFromAssignment(
  driverName: string,
  pickupAddress: string,
  dropoffAddress: string,
  date: string,
  timeSlot: string
): Promise<DriverProfileData> {
  // Mevcut profili al veya yeni oluştur
  let profile = await getDriverProfile(driverName)
  if (!profile) {
    profile = {
      name: driverName,
      locations: [],
      stats: {
        totalOrders: 0, totalDays: 0, ordersPerDay: 0,
        grouped: 0, solo: 0, groupRate: 0,
        dayAvailability: {}, bestDays: [], timeSlots: { sabah: 0, oglen: 0, aksam: 0 },
        acceptRate: -1
      },
      updatedAt: new Date().toISOString()
    }
  }

  // Pickup adresi geocode et ve ekle
  const pickupGeo = await geocodeAddress(pickupAddress)
  if (pickupGeo) {
    addOrUpdateLocation(profile, pickupAddress, pickupGeo, date, 'pickup')
  }

  // Dropoff adresi geocode et ve ekle
  const dropoffGeo = await geocodeAddress(dropoffAddress)
  if (dropoffGeo) {
    addOrUpdateLocation(profile, dropoffAddress, dropoffGeo, date, 'dropoff')
  }

  // Stats güncelle
  profile.stats.totalOrders++
  profile.stats.timeSlots[timeSlot] = (profile.stats.timeSlots[timeSlot] || 0) + 1

  // Gün güncelle
  const dayName = getDayName(date)
  profile.stats.dayAvailability[dayName] = (profile.stats.dayAvailability[dayName] || 0) + 1

  profile.updatedAt = new Date().toISOString()

  // Kaydet
  await saveDriverProfile(profile)

  return profile
}

function addOrUpdateLocation(
  profile: DriverProfileData,
  address: string,
  geo: GeoResult,
  date: string,
  type: 'pickup' | 'dropoff'
): void {
  const normalized = normalizeAddress(address)

  // Aynı normalize adres var mı?
  const existing = profile.locations.find(l => l.normalized === normalized)

  if (existing) {
    existing.count++
    existing.lastDate = date
    if (existing.type !== type && existing.type !== 'both') {
      existing.type = 'both'
    }
    // Koordinatları güncelle (Google API daha doğru olabilir)
    if (geo.source === 'google') {
      existing.lat = geo.lat
      existing.lng = geo.lng
    }
  } else {
    profile.locations.push({
      address,
      normalized,
      lat: geo.lat,
      lng: geo.lng,
      count: 1,
      lastDate: date,
      type
    })
  }
}

// ========== PROFİL REBUILD (geçmiş veriden toplu oluşturma) ==========

export async function rebuildAllProfiles(): Promise<number> {
  const dates = await getAvailableDates()
  if (!dates || dates.length === 0) return 0

  dates.sort()

  // Gün totalleri (müsaitlik yüzdesi için)
  const dayTotals: Record<string, number> = {}

  // Tüm veriyi topla
  const driverRawData: Record<string, {
    orders: number
    days: Set<string>
    dayDates: Record<string, Set<string>>
    pickupAddresses: Map<string, { address: string; count: number; date: string }>
    dropoffAddresses: Map<string, { address: string; count: number; date: string }>
    timeSlots: Record<string, number>
    grouped: number
    solo: number
    accepted: number
    rejected: number
  }> = {}

  for (const date of dates) {
    const dayName = getDayName(date)
    dayTotals[dayName] = (dayTotals[dayName] || 0) + 1

    const data = await getImportData(date)
    if (!data?.orders) continue

    for (const order of data.orders) {
      if (!order.driverName || order.driverName === 'Atanmamış') continue

      const name = order.driverName
      if (!driverRawData[name]) {
        driverRawData[name] = {
          orders: 0, days: new Set(),
          dayDates: {},
          pickupAddresses: new Map(),
          dropoffAddresses: new Map(),
          timeSlots: { sabah: 0, oglen: 0, aksam: 0 },
          grouped: 0, solo: 0, accepted: 0, rejected: 0
        }
      }

      const d = driverRawData[name]
      d.orders++
      d.days.add(date)

      if (!d.dayDates[dayName]) d.dayDates[dayName] = new Set()
      d.dayDates[dayName].add(date)

      // Pickup
      if (order.pickupAddress) {
        const norm = normalizeAddress(order.pickupAddress)
        const existing = d.pickupAddresses.get(norm)
        if (existing) { existing.count++; existing.date = date }
        else d.pickupAddresses.set(norm, { address: order.pickupAddress, count: 1, date })
      }

      // Dropoff
      if (order.dropoffAddress) {
        const norm = normalizeAddress(order.dropoffAddress)
        const existing = d.dropoffAddresses.get(norm)
        if (existing) { existing.count++; existing.date = date }
        else d.dropoffAddresses.set(norm, { address: order.dropoffAddress, count: 1, date })
      }

      // Time slot
      const slot = getTimeSlot(order.pickupTime || '')
      d.timeSlots[slot]++

      // Group
      if (order.groupId) d.grouped++
      else d.solo++

      // Response
      if (order.driverResponse === 'ACCEPTED') d.accepted++
      else if (order.driverResponse === 'REJECTED') d.rejected++
    }
  }

  // Her sürücü için profil oluştur (geocoding ile)
  let profileCount = 0

  for (const [name, d] of Object.entries(driverRawData)) {
    // Tüm benzersiz adresleri topla
    const allAddresses = new Map<string, { address: string; count: number; date: string; type: 'pickup' | 'dropoff' | 'both' }>()

    for (const [norm, data] of d.pickupAddresses) {
      allAddresses.set(norm, { ...data, type: 'pickup' })
    }
    for (const [norm, data] of d.dropoffAddresses) {
      const existing = allAddresses.get(norm)
      if (existing) {
        existing.count += data.count
        existing.type = 'both'
        if (data.date > existing.date) existing.date = data.date
      } else {
        allAddresses.set(norm, { ...data, type: 'dropoff' })
      }
    }

    // Geocode — en çok gidilen adresleri önce (max 100 adres)
    const sortedAddresses = Array.from(allAddresses.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 100)

    const locations: DriverLocation[] = []

    for (const [norm, data] of sortedAddresses) {
      const geo = await geocodeAddress(data.address)
      if (geo) {
        locations.push({
          address: data.address,
          normalized: norm,
          lat: geo.lat,
          lng: geo.lng,
          count: data.count,
          lastDate: data.date,
          type: data.type
        })
      }
    }

    // Gün müsaitliği
    const dayAvailability: Record<string, number> = {}
    const dayEntries: Array<{ day: string; pct: number }> = []
    for (const [dayName, total] of Object.entries(dayTotals)) {
      const worked = d.dayDates[dayName]?.size || 0
      const pct = Math.round((worked / total) * 100)
      dayAvailability[dayName] = pct
      if (pct > 0) dayEntries.push({ day: dayName, pct })
    }
    dayEntries.sort((a, b) => b.pct - a.pct)

    const totalDays = d.days.size
    const responded = d.accepted + d.rejected

    const profile: DriverProfileData = {
      name,
      locations,
      stats: {
        totalOrders: d.orders,
        totalDays,
        ordersPerDay: totalDays > 0 ? Math.round((d.orders / totalDays) * 10) / 10 : 0,
        grouped: d.grouped,
        solo: d.solo,
        groupRate: d.orders > 0 ? Math.round((d.grouped / d.orders) * 100) : 0,
        dayAvailability,
        bestDays: dayEntries.slice(0, 3).map(e => e.day),
        timeSlots: d.timeSlots,
        acceptRate: responded > 0 ? Math.round((d.accepted / responded) * 100) : -1
      },
      updatedAt: new Date().toISOString()
    }

    await saveDriverProfile(profile)
    profileCount++
  }

  await redis.set(PROFILES_UPDATED_KEY, new Date().toISOString())
  return profileCount
}

// ========== ÖNERİ MOTORU V3 ==========

export function recommendDrivers(
  profiles: Map<string, DriverProfileData>,
  pickupCoord: { lat: number; lng: number },
  dropoffCoord: { lat: number; lng: number } | null,
  pickupAddress: string,
  dropoffAddress: string | null,
  dayOfWeek: string,
  timeSlot: string,
  limit: number = 8
): DriverRecommendation[] {
  const pickupNorm = normalizeAddress(pickupAddress)
  const dropoffNorm = dropoffAddress ? normalizeAddress(dropoffAddress) : null

  const recommendations: DriverRecommendation[] = []

  for (const [_, profile] of profiles) {
    let locationScore = 0
    let dayScore = 0
    let capacityScore = 0
    let performanceScore = 0
    const reasons: string[] = []

    // ===== 1. ADRES YAKINLIĞI (max 40) =====

    // -- PICKUP (max 30) --
    let pickupScore = 0
    let bestPickupDist = Infinity
    let bestPickupLoc: DriverLocation | null = null

    for (const loc of profile.locations) {
      // A) Tam adres eşleşmesi
      if (loc.normalized === pickupNorm) {
        pickupScore = Math.min(30, 15 + loc.count * 3) // 15 base + count bonus
        bestPickupLoc = loc
        break
      }

      // B) Mesafe bazlı yakınlık
      const dist = haversineDistance(pickupCoord.lat, pickupCoord.lng, loc.lat, loc.lng)
      if (dist < bestPickupDist) {
        bestPickupDist = dist
        bestPickupLoc = loc
      }
    }

    // Eğer tam eşleşme yoksa mesafe skorunu hesapla
    if (pickupScore === 0 && bestPickupLoc) {
      // Yakın lokasyonlar daha yüksek puan (pickup ağırlıklı)
      if (bestPickupDist <= 1) {
        pickupScore = Math.min(25, 12 + bestPickupLoc.count * 2)
      } else if (bestPickupDist <= 3) {
        pickupScore = Math.min(20, 8 + bestPickupLoc.count * 1.5)
      } else if (bestPickupDist <= 5) {
        pickupScore = Math.min(15, 5 + bestPickupLoc.count)
      } else if (bestPickupDist <= 8) {
        pickupScore = Math.min(10, 3 + bestPickupLoc.count * 0.5)
      } else if (bestPickupDist <= 12) {
        pickupScore = Math.min(5, bestPickupLoc.count * 0.3)
      }

      // Birden fazla yakın lokasyon bonusu
      const nearbyCount = profile.locations.filter(
        l => haversineDistance(pickupCoord.lat, pickupCoord.lng, l.lat, l.lng) <= 5
      ).reduce((sum, l) => sum + l.count, 0)

      if (nearbyCount > 3) pickupScore = Math.min(30, pickupScore + Math.min(5, nearbyCount * 0.5))
    }

    // -- DROPOFF (max 10) --
    let dropoffScore = 0
    if (dropoffCoord && dropoffNorm) {
      for (const loc of profile.locations) {
        if (loc.normalized === dropoffNorm) {
          dropoffScore = Math.min(10, 5 + loc.count)
          break
        }
        const dist = haversineDistance(dropoffCoord.lat, dropoffCoord.lng, loc.lat, loc.lng)
        if (dist <= 3) {
          dropoffScore = Math.max(dropoffScore, Math.min(7, 3 + loc.count * 0.5))
        } else if (dist <= 8) {
          dropoffScore = Math.max(dropoffScore, Math.min(4, loc.count * 0.3))
        }
      }
    }

    locationScore = Math.min(40, pickupScore + dropoffScore)

    // Sebep oluştur
    if (pickupScore >= 15 && bestPickupLoc) {
      if (bestPickupDist < 0.5) {
        reasons.push(`${bestPickupLoc.count}x bu adrese gitmiş`)
      } else if (bestPickupDist <= 3) {
        reasons.push(`${bestPickupDist.toFixed(1)} mil yakında ${bestPickupLoc.count}x`)
      } else {
        const region = getRegionFromCoords(pickupCoord.lat, pickupCoord.lng)
        reasons.push(`${region} bölgesinde deneyimli`)
      }
    }

    // ===== 2. GÜN MÜSAİTLİĞİ (max 25) =====
    const dayPct = profile.stats.dayAvailability[dayOfWeek] || 0
    dayScore = Math.min(25, Math.round(dayPct * 0.5))
    if (dayPct >= 40) {
      reasons.push(`${dayOfWeek.substring(0, 3)} %${dayPct} müsait`)
    }

    // ===== 3. KAPASİTE (max 20) =====
    const opd = profile.stats.ordersPerDay
    if (opd >= 2.0) capacityScore += 10
    else if (opd >= 1.5) capacityScore += 7
    else if (opd >= 1.0) capacityScore += 4

    if (profile.stats.groupRate >= 50) capacityScore += 5
    else if (profile.stats.groupRate >= 30) capacityScore += 3

    const slotCount = profile.stats.timeSlots[timeSlot] || 0
    if (slotCount > 0) capacityScore += Math.min(5, slotCount * 0.3)
    capacityScore = Math.min(20, capacityScore)

    // ===== 4. PERFORMANS (max 15) =====
    performanceScore = Math.min(8, profile.stats.totalOrders * 0.15)
    if (profile.stats.acceptRate >= 0) {
      performanceScore += Math.min(7, (profile.stats.acceptRate / 100) * 7)
    }
    performanceScore = Math.min(15, performanceScore)

    // ===== TOPLAM =====
    const totalScore = Math.round(locationScore + dayScore + capacityScore + performanceScore)

    if (totalScore >= 10) {
      // Top bölgeler hesapla
      const regionCounts: Record<string, number> = {}
      for (const loc of profile.locations) {
        const region = getRegionFromCoords(loc.lat, loc.lng)
        regionCounts[region] = (regionCounts[region] || 0) + loc.count
      }
      const topRegions = Object.entries(regionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([r]) => r)

      recommendations.push({
        driverName: profile.name,
        score: totalScore,
        regionScore: Math.round(locationScore),
        dayScore: Math.round(dayScore),
        capacityScore: Math.round(capacityScore),
        performanceScore: Math.round(performanceScore),
        reasons,
        profile: {
          totalOrders: profile.stats.totalOrders,
          ordersPerDay: profile.stats.ordersPerDay,
          topRegions,
          bestDays: profile.stats.bestDays,
          groupRate: profile.stats.groupRate
        }
      })
    }
  }

  recommendations.sort((a, b) => b.score - a.score)
  return recommendations.slice(0, limit)
}

// ========== YARDIMCI ==========

function getDayName(dateStr: string): string {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'][day]
}

function getTimeSlot(pickupTime: string): string {
  if (!pickupTime) return 'oglen'
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

export async function getProfilesLastUpdated(): Promise<string | null> {
  return await redis.get(PROFILES_UPDATED_KEY)
}
