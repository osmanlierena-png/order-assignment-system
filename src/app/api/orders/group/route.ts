import { NextRequest, NextResponse } from 'next/server'
import { generateId, extractZipCode, timeToMinutes } from '@/lib/utils'
import { getImportData, setImportData, getLatestDate } from '@/lib/import-store'
import { isReachableInTime } from '@/lib/distance'

const MIN_BUFFER_MINUTES = 5
// MAX_DRIVING_MINUTES is checked inside isReachableInTime

// POST - İki siparişi veya sipariş + grubu birleştir
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceOrderId, targetOrderId, targetGroupId, date, autoGroup, combinedPrice } = body

    console.log('[GROUP API] Birleştirme isteği:', { sourceOrderId, targetOrderId, targetGroupId, date, autoGroup, combinedPrice })

    // Tarih belirle
    const targetDate = date || await getLatestDate()
    if (!targetDate) {
      return NextResponse.json({ error: 'Veri bulunamadı' }, { status: 404 })
    }

    // Redis'ten veriyi al
    const data = await getImportData(targetDate)
    if (!data) {
      return NextResponse.json({ error: 'Veri bulunamadı' }, { status: 404 })
    }

    // Kaynak siparişi bul
    const sourceOrder = data.orders.find(o => o.id === sourceOrderId)
    if (!sourceOrder) {
      return NextResponse.json({ error: 'Kaynak sipariş bulunamadı' }, { status: 404 })
    }

    let groupId: string
    let warning: string | undefined = undefined

    // Mevcut gruba ekleme
    if (targetGroupId) {
      groupId = targetGroupId
      sourceOrder.groupId = groupId
      sourceOrder.groupSource = 'manual' // Kullanıcı tarafından eklendi
      console.log(`[GROUP API] Sipariş ${sourceOrderId} gruba eklendi: ${groupId}`)
    }
    // İki siparişi birleştir
    else if (targetOrderId) {
      const targetOrder = data.orders.find(o => o.id === targetOrderId)
      if (!targetOrder) {
        return NextResponse.json({ error: 'Hedef sipariş bulunamadı' }, { status: 404 })
      }

      // Mesafe ve süre kontrolü yap
      const sourceDropoffZip = extractZipCode(sourceOrder.dropoffAddress)
      const targetPickupZip = extractZipCode(targetOrder.pickupAddress)
      const targetDropoffZip = extractZipCode(targetOrder.dropoffAddress)
      const sourcePickupZip = extractZipCode(sourceOrder.pickupAddress)

      // Buffer hesapla (iki sipariş arasındaki zaman farkı)
      const sourceDropoffTime = timeToMinutes(sourceOrder.dropoffTime)
      const targetPickupTime = timeToMinutes(targetOrder.pickupTime)
      const targetDropoffTime = timeToMinutes(targetOrder.dropoffTime)
      const sourcePickupTime = timeToMinutes(sourceOrder.pickupTime)

      // Hangi sipariş önce? (dropoff zamanına göre)
      let firstDropoffZip, secondPickupZip, buffer

      if (sourceDropoffTime <= targetPickupTime) {
        firstDropoffZip = sourceDropoffZip
        secondPickupZip = targetPickupZip
        buffer = targetPickupTime - sourceDropoffTime
      } else {
        firstDropoffZip = targetDropoffZip
        secondPickupZip = sourcePickupZip
        buffer = sourcePickupTime - targetDropoffTime
      }

      // Mesafe ve buffer kontrolü - sadece uyarı için log, engelleme yok (manuel gruplama)
      if (buffer < MIN_BUFFER_MINUTES) {
        warning = `Uyarı: Buffer çok kısa (${buffer}dk < ${MIN_BUFFER_MINUTES}dk)`
        console.warn(`[GROUP API] ${warning}`)
      }

      if (firstDropoffZip && secondPickupZip) {
        const reachability = isReachableInTime(firstDropoffZip, secondPickupZip, buffer)
        if (!reachability.reachable) {
          warning = `Uyarı: ${reachability.reason}`
          console.warn(`[GROUP API] ${warning}`)
        } else {
          console.log(`[GROUP API] Mesafe kontrolü OK: ${reachability.reason}`)
        }
      }

      // Hedefin mevcut grubu varsa onu kullan, yoksa yeni oluştur
      groupId = targetOrder.groupId || generateId()
      sourceOrder.groupId = groupId
      sourceOrder.groupSource = autoGroup ? 'auto-driver' : 'manual' // Otomatik mı manuel mi?
      targetOrder.groupId = groupId
      targetOrder.groupSource = autoGroup ? 'auto-driver' : 'manual' // Otomatik mı manuel mi?

      // OTOMATIK GRUPLAMA: Fiyatları birleştir
      if (autoGroup && combinedPrice !== undefined) {
        // Tekil fiyatları sıfırla
        sourceOrder.price = 0
        targetOrder.price = 0
        // Grup fiyatını ayarla
        sourceOrder.groupPrice = combinedPrice
        targetOrder.groupPrice = combinedPrice
        console.log(`[GROUP API] Otomatik gruplama fiyat birleştirme: groupPrice = $${combinedPrice}`)
      }

      console.log(`[GROUP API] Siparişler birleştirildi: ${sourceOrderId} + ${targetOrderId} → ${groupId} (${autoGroup ? 'otomatik' : 'manuel'})`)
    }
    else {
      return NextResponse.json(
        { error: 'Hedef sipariş veya grup belirtilmeli' },
        { status: 400 }
      )
    }

    // Redis'e kaydet
    await setImportData(data)
    console.log(`[GROUP API] Değişiklikler Redis'e kaydedildi`)

    return NextResponse.json({
      success: true,
      message: 'Grup güncellendi',
      groupId,
      warning: warning || undefined
    })
  } catch (error) {
    console.error('Error grouping orders:', error)
    return NextResponse.json(
      { error: 'Siparişler gruplanırken hata oluştu' },
      { status: 500 }
    )
  }
}
