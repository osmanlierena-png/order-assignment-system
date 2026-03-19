import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const GEOCODE_CACHE_PREFIX = 'geocode:'
const GEOCODE_TTL = 0 // Kalıcı cache — bir adres bir kez geocode edilir, bir daha API çağrılmaz

// ZIP koordinat tablosu (fallback)
const ZIP_COORDS: Record<string, [number, number]> = {
  '20001': [38.9101, -77.0177], '20002': [38.9046, -76.9892], '20003': [38.8818, -76.9862],
  '20004': [38.8945, -77.0164], '20005': [38.9046, -77.0318], '20006': [38.8993, -77.0429],
  '20007': [38.9103, -77.0728], '20008': [38.9355, -77.0571], '20009': [38.9198, -77.0377],
  '20010': [38.9318, -77.0307], '20011': [38.9531, -77.0216], '20012': [38.9756, -77.0280],
  '20015': [38.9673, -77.0560], '20016': [38.9421, -77.0897], '20017': [38.9418, -76.9961],
  '20018': [38.9297, -76.9728], '20019': [38.8932, -76.9381], '20020': [38.8644, -76.9734],
  '20024': [38.8752, -77.0149], '20036': [38.9075, -77.0413], '20037': [38.8996, -77.0555],
  '20814': [38.9918, -77.0953], '20815': [38.9783, -77.0788], '20816': [38.9588, -77.1118],
  '20817': [39.0091, -77.1361], '20850': [39.0839, -77.1527], '20852': [39.0522, -77.1241],
  '20854': [39.0307, -77.1468], '20878': [39.1285, -77.2148], '20874': [39.1574, -77.1956],
  '20876': [39.1871, -77.1750], '20877': [39.1371, -77.1814], '20879': [39.1538, -77.1636],
  '20886': [39.1634, -77.1395], '20901': [39.0151, -77.0015], '20902': [39.0237, -77.0200],
  '20903': [39.0243, -76.9721], '20904': [39.0663, -76.9794], '20905': [39.1099, -76.9847],
  '20906': [39.0823, -77.0554], '20910': [38.9979, -77.0344], '20912': [38.9809, -76.9838],
  '20716': [38.9475, -76.7428], '20720': [39.0136, -76.7986], '20774': [38.8876, -76.7994],
  '20706': [38.9656, -76.8517], '20707': [39.0079, -76.8714], '20708': [39.0247, -76.8531],
  '20737': [38.9654, -76.9219], '20740': [38.9897, -76.9375], '20782': [38.9640, -76.9684],
  '20783': [39.0022, -76.9670], '20784': [38.9446, -76.8908], '20785': [38.9244, -76.8770],
  '20770': [38.9827, -76.8777],
  '21701': [39.4143, -77.4105], '21703': [39.3780, -77.4570], '21704': [39.3644, -77.3613],
  '22030': [38.8462, -77.3064], '22031': [38.8593, -77.2610], '22041': [38.8489, -77.1383],
  '22042': [38.8670, -77.1899], '22043': [38.8828, -77.2005], '22044': [38.8563, -77.1526],
  '22046': [38.8841, -77.1682], '22101': [38.9303, -77.1779], '22102': [38.9532, -77.2225],
  '22150': [38.7644, -77.1666], '22180': [38.9016, -77.2594], '22182': [38.9369, -77.2319],
  '22201': [38.8856, -77.0951], '22202': [38.8574, -77.0523], '22203': [38.8682, -77.1071],
  '22204': [38.8568, -77.1180], '22205': [38.8794, -77.1310], '22206': [38.8378, -77.0848],
  '22207': [38.9004, -77.1234], '22301': [38.8151, -77.0573], '22302': [38.8233, -77.0774],
  '22303': [38.7906, -77.0819], '22304': [38.8068, -77.1097], '22306': [38.7621, -77.0851],
  '22312': [38.8145, -77.1490], '22314': [38.8048, -77.0514],
  '22401': [38.3032, -77.4606], '22554': [38.4306, -77.4200], '22556': [38.4572, -77.3869],
  '22405': [38.3200, -77.4200], '22407': [38.3400, -77.5200], '22408': [38.2700, -77.4400],
  '20109': [38.7608, -77.4785], '20110': [38.7460, -77.4710], '20111': [38.7310, -77.4885],
  '20120': [38.8100, -77.4400], '20121': [38.8000, -77.4600],
  '20147': [39.0355, -77.4655], '20148': [39.0050, -77.5152], '20170': [38.9696, -77.3861],
  '20171': [38.9299, -77.3936], '20175': [39.0900, -77.5600], '20176': [39.1027, -77.5415],
  '22191': [38.6430, -77.2700], '22192': [38.6650, -77.3000], '22193': [38.6200, -77.3300],
  '20601': [38.6500, -76.9000], '20602': [38.6300, -76.9200], '20603': [38.5900, -76.9600],
  '20190': [38.9600, -77.3500],
}

export interface GeoResult {
  lat: number
  lng: number
  source: 'google' | 'cache' | 'zip-fallback'
}

// Adres normalize
export function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .trim()
}

// ZIP çıkar (güvenli — sadece state kısaltmasından sonra gelen 5 haneli sayılar)
function extractZipSafe(addr: string): string | null {
  // "VA 22102" veya "MD 20814" veya "DC 20007" formatı
  const m = addr.match(/\b(?:VA|MD|DC)\s+(\d{5})\b/i)
  return m ? m[1] : null
}

// Google Maps Geocoding API ile adres → koordinat
async function geocodeViaGoogle(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null

  try {
    const params = new URLSearchParams({
      address,
      key: GOOGLE_MAPS_API_KEY,
      region: 'us',
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    )

    if (!response.ok) return null

    const data = await response.json()

    if (data.status === 'OK' && data.results?.length > 0) {
      const location = data.results[0].geometry.location
      return { lat: location.lat, lng: location.lng }
    }

    return null
  } catch (error) {
    console.error('Geocoding API error:', error)
    return null
  }
}

// Ana fonksiyon: adres → koordinat (cache → Google → ZIP fallback)
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!address) return null

  const normalized = normalizeAddress(address)
  const cacheKey = `${GEOCODE_CACHE_PREFIX}${normalized}`

  // 1. Redis cache kontrol
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached as { lat: number; lng: number }
      return { lat: data.lat, lng: data.lng, source: 'cache' }
    }
  } catch { /* cache miss */ }

  // 2. Google Maps Geocoding API
  const googleResult = await geocodeViaGoogle(address)
  if (googleResult) {
    // Cache'e kaydet
    try {
      // Kalıcı cache — TTL yok, adres koordinatı değişmez
      await redis.set(cacheKey, JSON.stringify(googleResult))
    } catch { /* cache write fail — non-critical */ }
    return { ...googleResult, source: 'google' }
  }

  // 3. ZIP fallback
  const zip = extractZipSafe(address)
  if (zip && ZIP_COORDS[zip]) {
    const coords = ZIP_COORDS[zip]
    return { lat: coords[0], lng: coords[1], source: 'zip-fallback' }
  }

  return null
}

// Batch geocoding — birden fazla adres
export async function geocodeAddresses(
  addresses: string[]
): Promise<Map<string, GeoResult>> {
  const results = new Map<string, GeoResult>()

  // Paralel ama rate limit'e dikkat (10/s)
  const batchSize = 8
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize)
    const promises = batch.map(async (addr) => {
      const result = await geocodeAddress(addr)
      if (result) results.set(addr, result)
    })
    await Promise.all(promises)

    // Rate limit
    if (i + batchSize < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return results
}

// Haversine mesafe (mil)
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3959 // mil
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
