// Bölge Cluster Tanımları - 30 günlük veri analizinden çıkarıldı
// Bu dosya gruplama önerilerinde coğrafi yakınlık hesaplamak için kullanılır

export interface RegionCluster {
  id: string
  name: string
  region: 'VA' | 'MD' | 'DC'
  zips: string[]
  groupRate: number // Tarihsel gruplama oranı (0-1)
}

// Analiz sonuçlarına göre bölge cluster'ları
export const REGION_CLUSTERS: RegionCluster[] = [
  // ==================== VIRGINIA ====================
  {
    id: 'va-mclean-tysons',
    name: 'McLean-Tysons-Vienna',
    region: 'VA',
    zips: ['22102', '22182', '22101', '22180', '22181', '22043'],
    groupRate: 0.89 // 2001 International Dr hub - %88.9 grup oranı
  },
  {
    id: 'va-arlington',
    name: 'Arlington',
    region: 'VA',
    zips: ['22202', '22203', '22209', '22201', '22206', '22204', '22205', '22207'],
    groupRate: 0.75
  },
  {
    id: 'va-reston-herndon',
    name: 'Reston-Herndon',
    region: 'VA',
    zips: ['20190', '20191', '20170', '20171', '20194'],
    groupRate: 0.72
  },
  {
    id: 'va-falls-church-fairfax',
    name: 'Falls Church-Fairfax',
    region: 'VA',
    zips: ['22042', '22043', '22030', '22031', '22033', '22032', '22046'],
    groupRate: 0.68
  },
  {
    id: 'va-alexandria',
    name: 'Alexandria',
    region: 'VA',
    zips: ['22314', '22304', '22306', '22310', '22315', '22301', '22302', '22303', '22305', '22311', '22312'],
    groupRate: 0.65
  },
  {
    id: 'va-springfield-annandale',
    name: 'Springfield-Annandale',
    region: 'VA',
    zips: ['22150', '22151', '22152', '22153', '22003', '22312'],
    groupRate: 0.60
  },
  {
    id: 'va-loudoun',
    name: 'Loudoun County',
    region: 'VA',
    zips: ['20176', '20175', '20147', '20148', '20152', '20166'],
    groupRate: 0.55
  },
  {
    id: 'va-woodbridge',
    name: 'Woodbridge-Dale City',
    region: 'VA',
    zips: ['22191', '22192', '22193'],
    groupRate: 0.45 // Uzak bölge - düşük gruplama
  },
  {
    id: 'va-fredericksburg',
    name: 'Fredericksburg',
    region: 'VA',
    zips: ['22401', '22405', '22407', '22408', '22554', '22556'],
    groupRate: 0.25 // Çok uzak - genellikle solo
  },
  {
    id: 'va-gainesville',
    name: 'Gainesville-Manassas',
    region: 'VA',
    zips: ['20155', '20109', '20110', '20111', '20112'],
    groupRate: 0.30 // Uzak bölge
  },

  // ==================== MARYLAND ====================
  {
    id: 'md-bethesda',
    name: 'Bethesda-Chevy Chase',
    region: 'MD',
    zips: ['20814', '20815', '20816', '20817'],
    groupRate: 0.70
  },
  {
    id: 'md-rockville',
    name: 'Rockville',
    region: 'MD',
    zips: ['20850', '20851', '20852', '20853', '20854', '20855'],
    groupRate: 0.65
  },
  {
    id: 'md-gaithersburg',
    name: 'Gaithersburg-Germantown',
    region: 'MD',
    zips: ['20877', '20878', '20879', '20874', '20876', '20886'],
    groupRate: 0.85 // 262 Crown Park Ave hub - %85 grup oranı
  },
  {
    id: 'md-silver-spring',
    name: 'Silver Spring',
    region: 'MD',
    zips: ['20901', '20902', '20903', '20904', '20905', '20906', '20910'],
    groupRate: 0.55
  },
  {
    id: 'md-college-park',
    name: 'College Park-Greenbelt',
    region: 'MD',
    zips: ['20740', '20742', '20770', '20771'],
    groupRate: 0.07 // %93.3 solo - çok düşük gruplama
  },
  {
    id: 'md-laurel-columbia',
    name: 'Laurel-Columbia',
    region: 'MD',
    zips: ['20707', '20708', '20723', '20724', '21044', '21045', '21046'],
    groupRate: 0.07 // %93.3 solo
  },
  {
    id: 'md-frederick',
    name: 'Frederick',
    region: 'MD',
    zips: ['21701', '21702', '21703', '21704'],
    groupRate: 0.10 // Çok uzak - neredeyse her zaman solo
  },

  // ==================== DC ====================
  {
    id: 'dc-downtown',
    name: 'DC Downtown-K Street',
    region: 'DC',
    zips: ['20005', '20006', '20036', '20001', '20037'],
    groupRate: 0.96 // 1275 Pennsylvania Ave hub - %96.4 grup oranı
  },
  {
    id: 'dc-capitol',
    name: 'Capitol Hill',
    region: 'DC',
    zips: ['20002', '20003', '20004'],
    groupRate: 0.80
  },
  {
    id: 'dc-nw-residential',
    name: 'NW Residential',
    region: 'DC',
    zips: ['20007', '20008', '20009', '20010', '20011', '20015', '20016'],
    groupRate: 0.75
  },
  {
    id: 'dc-ne-se',
    name: 'NE-SE DC',
    region: 'DC',
    zips: ['20017', '20018', '20019', '20020'],
    groupRate: 0.60
  }
]

// Yüksek gruplama oranlı hub adresleri (analiz sonuçlarından)
export const HIGH_VALUE_HUBS: { address: string; groupRate: number; frequency: number }[] = [
  { address: '1275 Pennsylvania Ave NW', groupRate: 0.964, frequency: 28 },
  { address: '2001 International Dr, McLean', groupRate: 0.889, frequency: 36 },
  { address: '1900 L St NW', groupRate: 0.857, frequency: 35 },
  { address: '262 Crown Park Ave, Gaithersburg', groupRate: 0.850, frequency: 20 },
  { address: '1152 15th St NW', groupRate: 0.842, frequency: 19 },
  { address: '901 N Glebe Rd, Arlington', groupRate: 0.800, frequency: 45 },
  { address: '1350 Connecticut Ave NW', groupRate: 0.780, frequency: 45 },
  { address: '2200 Pennsylvania Ave NW', groupRate: 0.750, frequency: 44 },
  { address: '4616 Kenmore Ave, Alexandria', groupRate: 0.720, frequency: 36 }
]

// Düşük gruplama oranlı bölgeler (solo oranı yüksek)
export const LOW_GROUPING_AREAS = [
  'College Park', 'Greenbelt', 'Laurel', 'Columbia',
  'Frederick', 'Fredericksburg', 'Gainesville', 'Warrenton'
]

// Bilinen rota çiftleri (sık birlikte gruplanan)
export const KNOWN_ROUTE_PAIRS: { pickup: string; dropoff: string; count: number }[] = [
  { pickup: '2200 Pennsylvania Ave NW', dropoff: '1000 Wilson Blvd', count: 19 },
  { pickup: '1005 First St NE', dropoff: '250 Massachusetts Ave NW', count: 19 },
  { pickup: '6332 Richmond Hwy', dropoff: '815 Slaters Ln, Alexandria', count: 16 }
]

// ZIP kodundan cluster bul
export function getClusterForZip(zip: string): RegionCluster | null {
  return REGION_CLUSTERS.find(c => c.zips.includes(zip)) || null
}

// İki ZIP aynı cluster'da mı?
export function areZipsInSameCluster(zip1: string, zip2: string): boolean {
  const cluster1 = getClusterForZip(zip1)
  const cluster2 = getClusterForZip(zip2)
  return cluster1 !== null && cluster2 !== null && cluster1.id === cluster2.id
}

// İki ZIP aynı bölgede mi? (VA/MD/DC)
export function areZipsInSameRegion(zip1: string, zip2: string): boolean {
  const cluster1 = getClusterForZip(zip1)
  const cluster2 = getClusterForZip(zip2)
  return cluster1 !== null && cluster2 !== null && cluster1.region === cluster2.region
}

// ZIP'in bölgesini al
export function getRegionForZip(zip: string): 'VA' | 'MD' | 'DC' | null {
  const cluster = getClusterForZip(zip)
  return cluster?.region || null
}

// Adresten ZIP kodu çıkar (akıllı parse - sokak numarasını ZIP sanma bugı düzeltildi)
export function extractZipFromAddress(address: string): string | null {
  // Yöntem 1: Eyalet kısaltmasından sonra ZIP ara (en güvenilir)
  // "Washington, DC 20008" veya "Alexandria, VA 22314"
  const stateZipMatch = address.match(/\b(DC|VA|MD)\s*(\d{5})(?:-\d{4})?\b/i)
  if (stateZipMatch) {
    return stateZipMatch[2]
  }

  // Yöntem 2: Bilinen DC/MD/VA ZIP aralıklarını ara
  // DC: 20001-20099, 20201-20599
  // MD: 20601-21999
  // VA: 22001-24699
  const allZips = address.match(/\b(\d{5})(?:-\d{4})?\b/g)
  if (allZips) {
    for (const zip of allZips) {
      const zipNum = parseInt(zip)
      // DC/MD/VA bölgesi ZIP'leri
      if (zipNum >= 20001 && zipNum <= 24699) {
        return zip
      }
    }
  }

  // Yöntem 3: Son 5 haneli sayıyı al (fallback)
  const matches = address.match(/\b(\d{5})(?:-\d{4})?\b/g)
  if (matches && matches.length > 0) {
    return matches[matches.length - 1].slice(0, 5)
  }

  return null
}

// Adres hub listesinde mi kontrol et
export function isHighValueHub(address: string): { isHub: boolean; groupRate: number } {
  const normalizedAddress = address.toLowerCase()
  const hub = HIGH_VALUE_HUBS.find(h =>
    normalizedAddress.includes(h.address.toLowerCase().split(',')[0])
  )
  return hub
    ? { isHub: true, groupRate: hub.groupRate }
    : { isHub: false, groupRate: 0 }
}

// Adres düşük gruplama bölgesinde mi?
export function isLowGroupingArea(address: string): boolean {
  const normalizedAddress = address.toLowerCase()
  return LOW_GROUPING_AREAS.some(area =>
    normalizedAddress.includes(area.toLowerCase())
  )
}

// Cluster'ın gruplama oranını al
export function getClusterGroupRate(zip: string): number {
  const cluster = getClusterForZip(zip)
  return cluster?.groupRate || 0.5 // Bilinmeyen için %50
}

// İki bölge arası kombinasyon bonusu
export function getCrossRegionBonus(region1: 'VA' | 'MD' | 'DC' | null, region2: 'VA' | 'MD' | 'DC' | null): number {
  if (!region1 || !region2) return 0

  // Analiz sonuçlarına göre cross-region kombinasyon skorları
  if (region1 === region2) return 10 // Aynı bölge

  const combo = [region1, region2].sort().join('-')
  switch (combo) {
    case 'DC-VA': return 8  // En yaygın cross-region (162 grup)
    case 'MD-VA': return 5  // İkinci yaygın (81 grup)
    case 'DC-MD': return 4  // Üçüncü (45 grup)
    default: return 0
  }
}
