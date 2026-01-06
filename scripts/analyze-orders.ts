import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Zaman string'ini dakikaya çevir
function timeToMinutes(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!match) return 0
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

// ZIP kodu çıkar
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

async function analyzeOrders() {
  // Tüm siparişleri al
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      groupId: true,
      pickupTime: true,
      dropoffTime: true,
      pickupAddress: true,
      dropoffAddress: true,
      orderDate: true,
      timeSlot: true
    }
  })

  console.log('=== SİPARİŞ ANALİZİ ===\n')

  // Gruplu siparişleri analiz et
  const groupedOrders = orders.filter(o => o.groupId)
  const ungroupedOrders = orders.filter(o => !o.groupId)

  // Grupları analiz et
  const groups = new Map<string, typeof orders>()
  groupedOrders.forEach(o => {
    const existing = groups.get(o.groupId!) || []
    existing.push(o)
    groups.set(o.groupId!, existing)
  })

  console.log(`Toplam: ${orders.length} sipariş`)
  console.log(`Gruplu: ${groupedOrders.length} (%${(groupedOrders.length/orders.length*100).toFixed(1)})`)
  console.log(`Tekil: ${ungroupedOrders.length} (%${(ungroupedOrders.length/orders.length*100).toFixed(1)})`)
  console.log(`Grup sayısı: ${groups.size}`)
  console.log(`Ortalama grup boyutu: ${(groupedOrders.length / groups.size).toFixed(1)}`)

  // Sorunlu grupları tespit et
  console.log('\n=== SORUNLU GRUPLAR ===')

  let samePickupCount = 0
  let overlapCount = 0
  let shortBufferCount = 0
  let validGroupCount = 0

  groups.forEach((groupOrders, groupId) => {
    // Pickup'a göre sırala
    const sorted = groupOrders.map(o => ({
      ...o,
      pickupMin: timeToMinutes(o.pickupTime),
      dropoffMin: timeToMinutes(o.dropoffTime),
      pickupZip: extractZip(o.pickupAddress),
      dropoffZip: extractZip(o.dropoffAddress)
    })).sort((a, b) => a.pickupMin - b.pickupMin)

    let hasIssue = false

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      // Aynı pickup
      if (current.pickupMin === next.pickupMin) {
        samePickupCount++
        hasIssue = true
        console.log(`[AYNI PICKUP] Grup ${groupId.slice(-6)}: ${current.pickupTime}`)
        console.log(`  - ${current.orderNumber}: ${current.pickupZip} → ${current.dropoffZip}`)
        console.log(`  - ${next.orderNumber}: ${next.pickupZip} → ${next.dropoffZip}`)
      }

      // Overlap
      const buffer = next.pickupMin - current.dropoffMin
      if (buffer < 0) {
        overlapCount++
        hasIssue = true
        console.log(`[ÇAKIŞMA] Grup ${groupId.slice(-6)}: ${current.dropoffTime} → ${next.pickupTime} (${buffer}dk)`)
      } else if (buffer < 15) {
        shortBufferCount++
        hasIssue = true
        console.log(`[KISA BUFFER] Grup ${groupId.slice(-6)}: ${current.dropoffTime} → ${next.pickupTime} (${buffer}dk)`)
      }
    }

    if (!hasIssue) {
      validGroupCount++
    }
  })

  console.log('\n=== SORUN ÖZETİ ===')
  console.log(`Aynı Pickup Saati: ${samePickupCount} grup`)
  console.log(`Zaman Çakışması: ${overlapCount} grup`)
  console.log(`Kısa Buffer (<15dk): ${shortBufferCount} grup`)
  console.log(`Geçerli Grup: ${validGroupCount} / ${groups.size}`)

  // Optimal aralık hesapla
  console.log('\n=== OPTİMAL ARALIK ÖNERİSİ ===')

  const problemGroups = samePickupCount + overlapCount + shortBufferCount
  const problemRatio = (problemGroups / groups.size * 100)

  console.log(`Sorunlu grup oranı: %${problemRatio.toFixed(1)}`)

  // Eğer sorunlu gruplar temizlenirse
  const validGroupedOrders = validGroupCount * 2.3 // Ort. grup boyutu
  const projectedGroupedRatio = (validGroupedOrders / orders.length * 100)

  console.log(`\nSorunlu gruplar temizlenirse:`)
  console.log(`- Tahmini gruplu sipariş: ~${Math.round(validGroupedOrders)}`)
  console.log(`- Tahmini birleştirme oranı: ~%${projectedGroupedRatio.toFixed(0)}`)

  console.log('\n=== ENDÜSTRİ STANDARTLARI ===')
  console.log(`
DC Metro bölgesi için önerilen değerler:

1. BİRLEŞTİRME ORANI:
   - Minimum: %40 (altı = fırsat kaçırılıyor)
   - Optimum: %50-65 (ideal aralık)
   - Maksimum: %70 (üstü = zorla birleştirme riski)

2. GRUP BOYUTU:
   - Minimum: 2 sipariş
   - Optimum: 2-3 sipariş
   - Maksimum: 4 sipariş (üstü riskli)

3. BUFFER SÜRESİ:
   - Minimum: 15 dakika (şehir içi)
   - Güvenli: 20-30 dakika
   - Uzak mesafe: 45+ dakika

4. TEKİL SİPARİŞ ORANI:
   - Kabul edilebilir: %30-60
   - (Frederick, uzak bölgeler tekil kalmalı)
`)

  await prisma.$disconnect()
}

analyzeOrders().catch(console.error)
