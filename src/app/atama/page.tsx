'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
// Card bileşenleri ileride kullanılacak
// import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  calculateLayeredMergeSuggestions,
  selectBestMerges
} from '@/lib/utils'

// React Flow SSR'da çalışmaz, dinamik import gerekli
const AssignmentCanvas = dynamic(
  () => import('@/components/canvas/AssignmentCanvas'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center">Yükleniyor...</div> }
)

interface Order {
  id: string
  orderNumber: string
  driver: string | null
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
  timeSlot: string
  status: string
  groupId: string | null
  orderDate?: string // ISO date string
  price?: number          // Sipariş fiyatı ($)
  groupPrice?: number     // Grup fiyatı
  tipAmount?: number      // Tip miktarı (Base44 OCR'dan)
  priceAmount?: number    // Toplam fiyat (Base44 OCR'dan)
  isHighValue?: boolean   // Büyük sipariş ($500+)
  driverResponse?: 'ACCEPTED' | 'REJECTED' | null  // Sürücü yanıtı
  driverResponseTime?: string                       // Yanıt zamanı
  smsSent?: boolean                                  // SMS gönderildi mi?
}

interface OrderGroup {
  id: string
  name: string | null
  timeSlot: string
  orderCount: number
  driverName: string | null
}

interface Driver {
  id: string
  name: string
  phone: string | null
}

export default function AtamaPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [groups, setGroups] = useState<OrderGroup[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [autoMerging, setAutoMerging] = useState(false)
  const autoMergeApplied = useRef(false)

  // Sayfa seviyesi state (gerekirse)

  // Tarih yönetimi
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [currentDateLabel, setCurrentDateLabel] = useState<string>('')

  // Tarih formatla (Türkçe gün adı ile)
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr + 'T12:00:00') // UTC offset sorununu önle
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    const dayName = days[date.getDay()]
    const day = date.getDate()
    const month = months[date.getMonth()]
    return `${day} ${month} ${dayName}`
  }

  // Verileri yükle
  const fetchData = useCallback(async (targetDate?: string) => {
    try {
      // Önce mevcut tarihleri al
      const datesRes = await fetch('/api/orders?listDates=true')
      const datesData = await datesRes.json()

      setAvailableDates(datesData.dates || [])

      // Hedef tarihi belirle
      const dateToFetch = targetDate || selectedDate || datesData.latestDate
      if (dateToFetch) {
        setSelectedDate(dateToFetch)
        setCurrentDateLabel(formatDateLabel(dateToFetch))
      }

      // Siparişleri getir (tarih parametresi ile)
      const [ordersRes, driversRes] = await Promise.all([
        fetch(`/api/orders${dateToFetch ? `?date=${dateToFetch}` : ''}`),
        fetch('/api/drivers'),
      ])

      const ordersData = await ordersRes.json()
      const driversData = await driversRes.json()

      // DEBUG: API'den gelen verilerdeki groupId değerlerini kontrol et
      const groupedOrders = ordersData.filter((o: Order) => o.groupId)
      console.log(`[PAGE] API'den gelen: Toplam ${ordersData.length}, Gruplu: ${groupedOrders.length}`)
      if (groupedOrders.length > 0) {
        console.log('[PAGE] İlk 3 gruplu sipariş:', groupedOrders.slice(0, 3).map((o: Order) => ({ orderNumber: o.orderNumber?.slice(-8), groupId: o.groupId })))
      }

      setOrders(ordersData)
      setDrivers(driversData)

      // Grupları siparişlerden çıkar
      const groupIds = [...new Set(ordersData.filter((o: Order) => o.groupId).map((o: Order) => o.groupId))]
      const groupsData: OrderGroup[] = groupIds.map((groupId) => {
        const groupOrders = ordersData.filter((o: Order) => o.groupId === groupId)
        return {
          id: groupId as string,
          name: null,
          timeSlot: groupOrders[0]?.timeSlot || 'MORNING',
          orderCount: groupOrders.length,
          driverName: groupOrders[0]?.driver || null,
        }
      })

      setGroups(groupsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      setMessage({ type: 'error', text: 'Veriler yüklenirken hata oluştu' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // İlk yükleme için sadece bir kez çalışsın


  // Polling - Sürücü yanıt güncellemeleri için (30 saniyede bir)
  useEffect(() => {
    if (!selectedDate) return

    const pollInterval = setInterval(() => {
      console.log('[POLLING] Yanıt güncellemelerini kontrol ediyor...')
      fetchData(selectedDate)
    }, 30000) // 30 saniye

    return () => clearInterval(pollInterval)
  }, [selectedDate, fetchData])

  // Tarih değiştiğinde verileri yeniden yükle
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    setCurrentDateLabel(formatDateLabel(newDate))
    autoMergeApplied.current = false // Yeni tarih için otomatik birleştirmeyi sıfırla
    fetchData(newDate)
  }

  // Otomatik birleştirme - KATMANLI SİSTEM
  // Sayfa ilk yüklendiğinde en iyi eşleşmeleri birleştir
  useEffect(() => {
    const runAutoMerge = async () => {
      // Sadece ilk seferde çalıştır ve orders yüklendiyse
      if (autoMergeApplied.current || orders.length === 0 || loading || autoMerging) return

      // Gruplanmamış sipariş sayısı
      const ungroupedCount = orders.filter(o => !o.groupId).length
      console.log(`[AUTO-MERGE] Toplam: ${orders.length}, Grupsuz: ${ungroupedCount}`)

      if (ungroupedCount < 2) {
        console.log('[AUTO-MERGE] Yetersiz grupsuz sipariş, atlanıyor')
        return
      }

      autoMergeApplied.current = true
      setAutoMerging(true)

      try {
        console.log('[AUTO-MERGE] Katmanlı analiz başlıyor...')

        // Katmanlı önerileri hesapla
        // Not: Client-side'da gerçek sürüş süresi kontrolü yapılmaz (API key server-side'da)
        // Gerçek sürüş süresi kontrolü Base44 import sırasında server-side'da yapılır
        const layeredSuggestions = await calculateLayeredMergeSuggestions(orders, false)

        console.log('[AUTO-MERGE] Katmanlı Öneriler:')
        console.log('  TIGHT:', layeredSuggestions.tight.length, layeredSuggestions.tight.slice(0, 3).map(s => `${s.orderNumbers.join('+')}(${s.score})`))
        console.log('  NORMAL:', layeredSuggestions.normal.length)
        console.log('  LOOSE:', layeredSuggestions.loose.length)

        // En iyi birleştirmeleri seç (çakışma olmadan)
        const bestMerges = selectBestMerges(layeredSuggestions)

        if (bestMerges.length === 0) {
          console.log('Uygun birleştirme bulunamadı')
          setAutoMerging(false)
          return
        }

        console.log(`Otomatik birleştirme: ${bestMerges.length} birleştirme yapılacak`)

        // Birleştirmeleri sırayla yap
        let mergedCount = 0
        const mergeStats = { tight: 0, normal: 0, loose: 0 }

        for (const suggestion of bestMerges) {
          try {
            // 2'li birleştirme
            if (suggestion.orderIds.length === 2) {
              const response = await fetch('/api/orders/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceOrderId: suggestion.orderIds[0],
                  targetOrderId: suggestion.orderIds[1],
                  targetGroupId: null
                }),
              })

              if (response.ok) {
                mergedCount++
                mergeStats[suggestion.layer.toLowerCase() as keyof typeof mergeStats]++
                console.log(`[${suggestion.layer}] Birleştirildi: ${suggestion.orderNumbers.join(' + ')} (Skor: ${suggestion.score})`)
              }
            }
            // 3+ birleştirme - sırayla ekle
            else if (suggestion.orderIds.length >= 3) {
              // İlk iki siparişi birleştir
              const firstResponse = await fetch('/api/orders/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceOrderId: suggestion.orderIds[0],
                  targetOrderId: suggestion.orderIds[1],
                  targetGroupId: null
                }),
              })

              if (firstResponse.ok) {
                const firstData = await firstResponse.json()
                const groupId = firstData.groupId

                // Kalan siparişleri gruba ekle
                for (let i = 2; i < suggestion.orderIds.length; i++) {
                  await fetch('/api/orders/group', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sourceOrderId: suggestion.orderIds[i],
                      targetOrderId: null,
                      targetGroupId: groupId
                    }),
                  })
                }

                mergedCount++
                mergeStats[suggestion.layer.toLowerCase() as keyof typeof mergeStats]++
                console.log(`[${suggestion.layer}] Birleştirildi (${suggestion.orderIds.length}'lü): ${suggestion.orderNumbers.join(' + ')} (Skor: ${suggestion.score})`)
              }
            }
          } catch (err) {
            console.error('Birleştirme hatası:', err)
          }
        }

        // Verileri yeniden yükle
        if (mergedCount > 0) {
          await fetchData()

          // Detaylı mesaj
          const details: string[] = []
          if (mergeStats.tight > 0) details.push(`${mergeStats.tight} sıkı`)
          if (mergeStats.normal > 0) details.push(`${mergeStats.normal} normal`)
          if (mergeStats.loose > 0) details.push(`${mergeStats.loose} gevşek`)

          setMessage({
            type: 'success',
            text: `${mergedCount} grup oluşturuldu (${details.join(', ')})`
          })
          setTimeout(() => setMessage(null), 5000)
        }
      } catch (error) {
        console.error('Otomatik birleştirme hatası:', error)
      } finally {
        setAutoMerging(false)
      }
    }

    runAutoMerge()
  }, [orders, loading, autoMerging, fetchData])

  // Sipariş ataması - Aynı sürücüye 2. sipariş atanırsa otomatik gruplama yapar
  const handleAssign = async (orderId: string, driverName: string) => {
    // Önceki değeri sakla (geri alma için)
    const previousOrder = orders.find(o => o.id === orderId)

    // Atama silme (boş driverName)
    if (!driverName) {
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, driver: null, status: 'PENDING' } : o))
      )

      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driver: null,
            status: 'PENDING',
            date: selectedDate
          }),
        })

        if (!response.ok) {
          if (previousOrder) {
            setOrders(prev =>
              prev.map(o => (o.id === orderId ? previousOrder : o))
            )
          }
        }
      } catch (error) {
        console.error('Atama silme hatası:', error)
      }
      return
    }

    // OTOMATIK GRUPLAMA: Bu sürücüye atanmış başka tekil sipariş var mı kontrol et
    const currentOrder = orders.find(o => o.id === orderId)
    const otherOrdersWithSameDriver = orders.filter(o =>
      o.id !== orderId &&           // Kendisi değil
      o.driver === driverName &&    // Aynı sürücü
      !o.groupId                    // Tekil (grupta değil)
    )

    // Eğer bu sipariş tekil VE başka tekil sipariş(ler) aynı sürücüye atanmışsa → OTOMATİK GRUPLAMA
    if (!currentOrder?.groupId && otherOrdersWithSameDriver.length > 0) {
      console.log(`[AUTO-GROUP] ${driverName} için otomatik gruplama: ${orderId} + ${otherOrdersWithSameDriver.map(o => o.id).join(', ')}`)

      // Önce mevcut siparişi ata
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, driver: driverName, status: 'ASSIGNED' } : o))
      )

      try {
        // Sipariş atamasını yap
        const assignResponse = await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driver: driverName,
            status: 'ASSIGNED',
            date: selectedDate
          }),
        })

        if (!assignResponse.ok) {
          if (previousOrder) {
            setOrders(prev =>
              prev.map(o => (o.id === orderId ? previousOrder : o))
            )
          }
          throw new Error('Atama başarısız')
        }

        // Şimdi otomatik gruplama yap
        // İlk olarak, bu sipariş ile ilk eşleşeni birleştir
        const firstMatch = otherOrdersWithSameDriver[0]

        // Fiyatları hesapla: groupPrice = her iki siparişin fiyatı toplamı
        const currentPrice = currentOrder?.price || 0
        const firstMatchPrice = firstMatch.price || 0
        const combinedPrice = currentPrice + firstMatchPrice

        // Birleştirme API çağrısı
        const mergeResponse = await fetch('/api/orders/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceOrderId: orderId,
            targetOrderId: firstMatch.id,
            targetGroupId: null,
            date: selectedDate,
            // Otomatik gruplama için: fiyatları sıfırla, groupPrice'a aktar
            autoGroup: true,
            combinedPrice: combinedPrice
          }),
        })

        const mergeData = await mergeResponse.json()

        if (mergeResponse.ok && mergeData.groupId) {
          // Diğer eşleşen siparişleri de gruba ekle (varsa)
          for (let i = 1; i < otherOrdersWithSameDriver.length; i++) {
            const additionalOrder = otherOrdersWithSameDriver[i]
            await fetch('/api/orders/group', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceOrderId: additionalOrder.id,
                targetOrderId: null,
                targetGroupId: mergeData.groupId,
                date: selectedDate
              }),
            })
          }

          // Verileri yeniden yükle
          await fetchData(selectedDate || undefined)

          setMessage({
            type: 'success',
            text: `${driverName} için otomatik grup oluşturuldu (${otherOrdersWithSameDriver.length + 1} sipariş) - Grup Fiyatı: $${combinedPrice}`
          })
          setTimeout(() => setMessage(null), 5000)
        } else {
          // Gruplama başarısız ama atama yapıldı
          setMessage({ type: 'success', text: `Sipariş ${driverName}'e atandı (gruplama başarısız)` })
          setTimeout(() => setMessage(null), 3000)
        }

      } catch (error) {
        console.error('Otomatik gruplama hatası:', error)
        setMessage({ type: 'error', text: 'Atama başarısız oldu' })
      }

      return
    }

    // GRUPLU SİPARİŞ: Aynı sürücüye atanmış başka gruplar varsa birleştir
    if (currentOrder?.groupId) {
      // Aynı sürücüye atanmış BAŞKA grupları bul
      const otherGroupsWithSameDriver = orders.filter(o =>
        o.id !== orderId &&           // Kendisi değil
        o.driver === driverName &&    // Aynı sürücü
        o.groupId &&                  // Grupta
        o.groupId !== currentOrder.groupId  // Farklı grup
      )

      console.log(`[AUTO-GROUP-MERGE] Check: currentOrder.groupId=${currentOrder.groupId}, driverName=${driverName}`)
      console.log(`[AUTO-GROUP-MERGE] Other orders with same driver:`, otherGroupsWithSameDriver.map(o => ({ id: o.id, driver: o.driver, groupId: o.groupId })))

      // Benzersiz grup ID'lerini al
      const uniqueGroupIds = [...new Set(otherGroupsWithSameDriver.map(o => o.groupId).filter((id): id is string => id !== null))]

      if (uniqueGroupIds.length > 0) {
        console.log(`[AUTO-GROUP-MERGE] ${driverName} için grup birleştirme: ${currentOrder.groupId} + ${uniqueGroupIds.join(', ')}`)

        // Önce mevcut siparişi ata
        setOrders(prev =>
          prev.map(o => (o.id === orderId ? { ...o, driver: driverName, status: 'ASSIGNED' } : o))
        )

        try {
          // Sipariş atamasını yap
          await fetch(`/api/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driver: driverName,
              status: 'ASSIGNED',
              date: selectedDate
            }),
          })

          // FİYAT TOPLAMA: Mevcut grubun fiyatını al
          const currentGroupOrders = orders.filter(o => o.groupId === currentOrder.groupId)
          let totalGroupPrice = currentGroupOrders[0]?.groupPrice || 0

          // Diğer grupların fiyatlarını topla
          for (const otherGroupId of uniqueGroupIds) {
            const otherGroupOrders = orders.filter(o => o.groupId === otherGroupId)
            const otherGroupPrice = otherGroupOrders[0]?.groupPrice || 0
            totalGroupPrice += otherGroupPrice
            console.log(`[AUTO-GROUP-MERGE] Fiyat eklendi: +$${otherGroupPrice} (toplam: $${totalGroupPrice})`)
          }

          // Diğer grupları bu gruba birleştir
          let mergedOrderCount = 0
          for (const otherGroupId of uniqueGroupIds) {
            const groupOrders = orders.filter(o => o.groupId === otherGroupId)
            for (const order of groupOrders) {
              await fetch('/api/orders/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceOrderId: order.id,
                  targetOrderId: null,
                  targetGroupId: currentOrder.groupId,
                  date: selectedDate
                }),
              })
              mergedOrderCount++
            }
          }

          // Toplanan fiyatı gruba kaydet
          if (totalGroupPrice > 0) {
            await fetch('/api/orders/price', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                groupId: currentOrder.groupId,
                groupPrice: totalGroupPrice,
                date: selectedDate
              }),
            })
            console.log(`[AUTO-GROUP-MERGE] Toplam grup fiyatı kaydedildi: $${totalGroupPrice}`)
          }

          // Verileri yeniden yükle
          await fetchData(selectedDate || undefined)

          setMessage({
            type: 'success',
            text: `${driverName} için ${uniqueGroupIds.length} grup birleştirildi (${mergedOrderCount} sipariş, toplam $${totalGroupPrice})`
          })
          setTimeout(() => setMessage(null), 5000)

        } catch (error) {
          console.error('Grup birleştirme hatası:', error)
          setMessage({ type: 'error', text: 'Grup birleştirme başarısız oldu' })
        }

        return
      }
    }

    // Normal atama (otomatik gruplama yok)
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, driver: driverName, status: 'ASSIGNED' } : o))
    )

    try {
      // PUT isteği - tarih parametresi ile Redis'e kaydedilecek
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver: driverName,
          status: 'ASSIGNED',
          date: selectedDate  // Tarih parametresi eklendi
        }),
      })

      if (!response.ok) {
        // Hata olursa geri al
        if (previousOrder) {
          setOrders(prev =>
            prev.map(o => (o.id === orderId ? previousOrder : o))
          )
        }
        throw new Error('Atama başarısız')
      }

      setMessage({ type: 'success', text: `Sipariş ${driverName}'e atandı` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Atama başarısız oldu' })
    }
  }

  // Grup ataması
  const handleGroupAssign = async (groupId: string, driverName: string) => {
    try {
      // Gruptaki tüm siparişleri tek seferde güncelle (race condition önlenir)
      const groupOrders = orders.filter(o => o.groupId === groupId)

      const response = await fetch('/api/orders/group-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          driverName,
          date: selectedDate
        }),
      })

      if (!response.ok) {
        throw new Error('Grup ataması başarısız')
      }

      // State güncelle
      setOrders(prev =>
        prev.map(o =>
          o.groupId === groupId ? { ...o, driver: driverName, status: 'ASSIGNED' } : o
        )
      )

      setGroups(prev =>
        prev.map(g => (g.id === groupId ? { ...g, driverName } : g))
      )

      setMessage({ type: 'success', text: `Grup ${driverName}'e atandı (${groupOrders.length} sipariş)` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Grup ataması başarısız oldu' })
    }
  }

  // Siparişi gruptan çıkar
  const handleRemoveFromGroup = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order?.groupId) return

    const groupId = order.groupId

    // Optimistik güncelleme - önce UI'ı güncelle
    const groupOrderCount = orders.filter(o => o.groupId === groupId).length

    if (groupOrderCount <= 2) {
      // Grupta 2 sipariş varsa, ikisinin de groupId'sini null yap (grup çözülür)
      setOrders(prev => prev.map(o =>
        o.groupId === groupId ? { ...o, groupId: null } : o
      ))
      setGroups(prev => prev.filter(g => g.id !== groupId))
    } else {
      // Grupta 3+ sipariş varsa, sadece bu siparişi çıkar
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, groupId: null } : o
      ))
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, orderCount: g.orderCount - 1 } : g
      ))
    }

    try {
      const response = await fetch(`/api/orders/${orderId}/ungroup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      })

      if (!response.ok) {
        // Hata olursa geri al
        await fetchData()
        throw new Error('Gruptan çıkarma başarısız')
      }

      console.log(`[UNGROUP] Sipariş ${orderId} gruptan çıkarıldı ve Redis'e kaydedildi`)
    } catch (error) {
      setMessage({ type: 'error', text: 'Sipariş gruptan çıkarılamadı' })
    }
  }

  // Siparişleri birleştir (sürükle-bırak ile)
  const handleMergeOrders = async (
    sourceOrderId: string,
    targetOrderId: string | null,
    targetGroupId: string | null
  ) => {
    // Optimistik güncelleme için geçici groupId oluştur
    const tempGroupId = targetGroupId || `temp-${Date.now()}`

    // Optimistik güncelleme - önce UI'ı güncelle
    if (targetGroupId) {
      // Mevcut gruba ekle
      setOrders(prev => prev.map(o =>
        o.id === sourceOrderId ? { ...o, groupId: targetGroupId } : o
      ))
      setGroups(prev => prev.map(g =>
        g.id === targetGroupId ? { ...g, orderCount: g.orderCount + 1 } : g
      ))
    } else if (targetOrderId) {
      // Yeni grup oluştur
      const targetOrder = orders.find(o => o.id === targetOrderId)
      const sourceOrder = orders.find(o => o.id === sourceOrderId)

      setOrders(prev => prev.map(o => {
        if (o.id === sourceOrderId || o.id === targetOrderId) {
          return { ...o, groupId: tempGroupId }
        }
        return o
      }))

      // Yeni grubu ekle
      setGroups(prev => [...prev, {
        id: tempGroupId,
        name: null,
        timeSlot: targetOrder?.timeSlot || sourceOrder?.timeSlot || 'MORNING',
        orderCount: 2,
        driverName: targetOrder?.driver || sourceOrder?.driver || null,
      }])
    }

    try {
      // POST isteği - tarih parametresi ile Redis'e kaydedilecek
      const response = await fetch('/api/orders/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceOrderId,
          targetOrderId,
          targetGroupId,
          date: selectedDate  // Tarih parametresi eklendi
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Hata olursa geri al
        await fetchData()
        const errorMessage = data.error || 'Birleştirme başarısız'
        setMessage({ type: 'error', text: errorMessage })
        setTimeout(() => setMessage(null), 5000)
        return
      }

      // Başarılıysa gerçek groupId ile güncelle (temp olanı değiştir)
      if (!targetGroupId && data.groupId) {
        setOrders(prev => prev.map(o =>
          o.groupId === tempGroupId ? { ...o, groupId: data.groupId } : o
        ))
        setGroups(prev => prev.map(g =>
          g.id === tempGroupId ? { ...g, id: data.groupId } : g
        ))
      }

      setMessage({ type: 'success', text: 'Siparişler birleştirildi' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Merge error:', error)
      await fetchData()
      setMessage({ type: 'error', text: 'Siparişler birleştirilemedi' })
    }
  }

  // Sipariş fiyatını güncelle
  const handlePriceChange = async (orderId: string, price: number) => {
    // Siparişi bul
    const order = orders.find(o => o.id === orderId)

    // Optimistik güncelleme
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, price } : o))
    )

    try {
      const response = await fetch('/api/orders/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          price,
          date: selectedDate
        }),
      })

      if (!response.ok) {
        // Hata olursa geri al
        await fetchData()
        setMessage({ type: 'error', text: 'Fiyat güncellenemedi' })
        return
      }

      // Sipariş gruptaysa, grup fiyatını otomatik güncelle
      if (order?.groupId) {
        const groupOrders = orders.filter(o => o.groupId === order.groupId)
        const newGroupPrice = groupOrders.reduce((sum, o) =>
          sum + (o.id === orderId ? price : (o.price || 0)), 0)

        // State güncelle
        setOrders(prev =>
          prev.map(o => (o.groupId === order.groupId ? { ...o, groupPrice: newGroupPrice } : o))
        )

        // API'ye kaydet
        await fetch('/api/orders/group-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: order.groupId,
            groupPrice: newGroupPrice,
            date: selectedDate
          }),
        })
      }
    } catch (error) {
      console.error('Price update error:', error)
    }
  }

  // Grup fiyatını güncelle
  const handleGroupPriceChange = async (groupId: string, groupPrice: number) => {
    // Optimistik güncelleme - gruptaki tüm siparişlerin groupPrice'ını güncelle
    setOrders(prev =>
      prev.map(o => (o.groupId === groupId ? { ...o, groupPrice } : o))
    )

    try {
      const response = await fetch('/api/orders/group-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          groupPrice,
          date: selectedDate
        }),
      })

      if (!response.ok) {
        await fetchData()
        setMessage({ type: 'error', text: 'Grup fiyatı güncellenemedi' })
      }
    } catch (error) {
      console.error('Group price update error:', error)
    }
  }

  // Gruplamayı kaydet (öğrenme sistemi)
  const [savingGrouping, setSavingGrouping] = useState(false)

  const handleSaveGrouping = async () => {
    if (!selectedDate) {
      setMessage({ type: 'error', text: 'Tarih seçilmedi' })
      return
    }

    const groupedCount = orders.filter(o => o.groupId).length
    if (groupedCount === 0) {
      setMessage({ type: 'error', text: 'Kaydedilecek grup bulunamadı' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setSavingGrouping(true)
    try {
      const response = await fetch('/api/grouping/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({
          type: 'success',
          text: `Gruplama kaydedildi! ${result.saved.pairsLearned} pattern öğrenildi`
        })
      } else {
        setMessage({ type: 'error', text: result.error || 'Kaydetme başarısız' })
      }
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      console.error('Save grouping error:', error)
      setMessage({ type: 'error', text: 'Gruplama kaydedilemedi' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setSavingGrouping(false)
    }
  }

  // Otomatik fiyatlama
  const [autoPricing, setAutoPricing] = useState(false)
  const [pricingStats, setPricingStats] = useState<{ averagePrice: number; pricedOrders: number; totalOrders: number; averageWarning: boolean } | null>(null)

  const handleAutoPrice = async () => {
    if (!selectedDate) {
      setMessage({ type: 'error', text: 'Tarih seçilmedi' })
      return
    }

    setAutoPricing(true)
    try {
      const response = await fetch('/api/orders/auto-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setPricingStats(result.stats)
        setMessage({
          type: 'success',
          text: `${result.stats.pricedOrders} sipariş fiyatlandı, ort: $${result.stats.averagePrice.toFixed(2)}${result.stats.averageWarning ? ' ⚠️ Ortalama $32.50 üstünde' : ''}`
        })
        // Siparişleri yeniden yükle
        await fetchData(selectedDate)
      } else {
        setMessage({ type: 'error', text: result.error || 'Fiyatlama başarısız' })
      }
    } catch (error) {
      console.error('Auto pricing error:', error)
      setMessage({ type: 'error', text: 'Fiyatlama sırasında hata oluştu' })
    } finally {
      setAutoPricing(false)
    }
  }

  // Base44'e atamaları gönder
  const [exporting, setExporting] = useState(false)

  const handleExportToBase44 = async () => {
    // Sadece atanmış siparişleri filtrele
    const assignedOrders = orders.filter(o => o.driver)

    if (assignedOrders.length === 0) {
      setMessage({ type: 'error', text: 'Atanmış sipariş bulunamadı' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    // Fiyatı olmayan siparişleri kontrol et
    const unpricedOrders = assignedOrders.filter(o => !o.price || o.price <= 0)
    if (unpricedOrders.length > 0) {
      const proceed = window.confirm(
        `⚠️ ${unpricedOrders.length} siparişin fiyatı boş (canvas_price = $0).\n\nSiparişler: ${unpricedOrders.map(o => o.orderNumber).join(', ')}\n\nYine de göndermek istiyor musunuz?`
      )
      if (!proceed) return
    }

    setExporting(true)
    try {
      const assignments = assignedOrders.map(o => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        driverName: o.driver,
        groupId: o.groupId,
        price: o.price || 0,
        groupPrice: o.groupPrice || 0
      }))

      const response = await fetch('/api/base44/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          assignments,
          triggerSMS: false
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({
          type: 'success',
          text: `${result.updatedOrders || assignments.length} atama Base44'e gönderildi`
        })
      } else {
        setMessage({ type: 'error', text: result.error || 'Export başarısız' })
      }
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      console.error('Export error:', error)
      setMessage({ type: 'error', text: 'Base44\'e gönderim başarısız' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (autoMerging) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Siparişler analiz ediliyor ve birleştiriliyor...</p>
          <p className="text-sm text-gray-500 mt-2">Yüksek skorlu eşleşmeler otomatik birleştiriliyor</p>
        </div>
      </div>
    )
  }

  // İstatistikler
  const stats = {
    morning: { total: orders.filter(o => o.timeSlot === 'MORNING').length, grouped: orders.filter(o => o.timeSlot === 'MORNING' && o.groupId).length },
    afternoon: { total: orders.filter(o => o.timeSlot === 'AFTERNOON').length, grouped: orders.filter(o => o.timeSlot === 'AFTERNOON' && o.groupId).length },
    evening: { total: orders.filter(o => o.timeSlot === 'EVENING').length, grouped: orders.filter(o => o.timeSlot === 'EVENING' && o.groupId).length },
  }

  return (
    <div className="space-y-2">
      {/* Header - İstatistikler ve Aksiyonlar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Üst Satır - Tarih Seçici ve Aksiyonlar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {/* Tarih Seçici - ÖNEMLİ */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <select
                value={selectedDate || ''}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg px-4 py-2 rounded-lg shadow-md cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {availableDates.length === 0 ? (
                  <option value="">Veri yok</option>
                ) : (
                  availableDates.map(date => (
                    <option key={date} value={date} className="bg-white text-gray-800">
                      {formatDateLabel(date)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Gün Etiketi */}
            {currentDateLabel && (
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-orange-300 px-4 py-1.5 rounded-full">
                <span className="text-orange-800 font-bold text-sm">{currentDateLabel}</span>
              </div>
            )}

            {/* İstatistikler */}
            <div className="flex items-center gap-2 text-xs bg-gray-50 px-3 py-1 rounded-full">
              <span><b className="text-blue-600">{orders.length}</b> sipariş</span>
              <span className="text-gray-300">|</span>
              <span><b className="text-purple-600">{groups.length}</b> grup</span>
              <span className="text-gray-300">|</span>
              <span><b className="text-green-600">{drivers.length}</b> sürücü</span>
            </div>

          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleAutoPrice}
              disabled={autoPricing || orders.length === 0}
              variant="outline"
              className="text-xs py-1.5 px-3 bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              {autoPricing ? '⏳ Fiyatlanıyor...' : '💲 Fiyatla'}
            </Button>
            {(() => {
              const pricedOrders = orders.filter(o => o.price && o.price > 0)
              if (pricedOrders.length === 0) return null
              const avg = pricedOrders.reduce((s, o) => s + (o.price || 0), 0) / pricedOrders.length
              const isWarning = avg > 32.50
              // Net Kâr: Gelir (tip + $25 fee) - Gider (canvas_price)
              const totalRevenue = orders.reduce((s, o) => s + (o.tipAmount || 0) + 25, 0)
              const totalCost = orders.reduce((s, o) => s + (o.price || 0), 0)
              const netProfit = totalRevenue - totalCost
              const perOrder = orders.length > 0 ? netProfit / orders.length : 0
              return (
                <>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${isWarning ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'}`}>
                    Ort: ${avg.toFixed(2)} | {pricedOrders.length}/{orders.length}
                  </span>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${netProfit >= 0 ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                    Net: ${netProfit.toFixed(0)} (${perOrder.toFixed(1)}/sip)
                  </span>
                </>
              )
            })()}
            <Button
              onClick={() => {
                autoMergeApplied.current = false
                fetchData(selectedDate || undefined)
              }}
              variant="outline"
              className="text-xs py-1.5 px-3 bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              🔄 Otomatik Birleştir
            </Button>
            <Button onClick={() => fetchData(selectedDate || undefined)} variant="outline" className="text-xs py-1.5 px-3">
              ↻ Yenile
            </Button>
            <Button
              onClick={handleSaveGrouping}
              disabled={savingGrouping || orders.filter(o => o.groupId).length === 0}
              variant="outline"
              className="text-xs py-1.5 px-3 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {savingGrouping ? '⏳ Kaydediliyor...' : '💾 Gruplamayı Kaydet'}
            </Button>
            <Button
              onClick={handleExportToBase44}
              disabled={exporting || orders.filter(o => o.driver).length === 0}
              variant="outline"
              className="text-xs py-1.5 px-3 bg-green-50 border-green-300 text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              {exporting ? '⏳ Gönderiliyor...' : '📤 Base44\'e Gönder'}
            </Button>
          </div>
        </div>

        {/* Alt Satır - Zaman Dilimi İstatistikleri */}
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Sabah */}
          <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-1.5">
            <span className="text-sm">🌅</span>
            <span className="text-xs font-bold text-gray-800">Sabah</span>
            <span className="text-xs bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-full font-bold">{stats.morning.total}</span>
            <span className="text-[10px] text-gray-700">({stats.morning.grouped}g / {stats.morning.total - stats.morning.grouped}t)</span>
          </div>

          {/* Öğlen */}
          <div className="flex items-center gap-2 bg-orange-100 border border-orange-300 rounded-lg px-3 py-1.5">
            <span className="text-sm">☀️</span>
            <span className="text-xs font-bold text-gray-800">Öğlen</span>
            <span className="text-xs bg-orange-400 text-gray-900 px-2 py-0.5 rounded-full font-bold">{stats.afternoon.total}</span>
            <span className="text-[10px] text-gray-700">({stats.afternoon.grouped}g / {stats.afternoon.total - stats.afternoon.grouped}t)</span>
          </div>

          {/* Akşam */}
          <div className="flex items-center gap-2 bg-violet-100 border border-violet-300 rounded-lg px-3 py-1.5">
            <span className="text-sm">🌙</span>
            <span className="text-xs font-bold text-gray-800">Akşam</span>
            <span className="text-xs bg-violet-400 text-gray-900 px-2 py-0.5 rounded-full font-bold">{stats.evening.total}</span>
            <span className="text-[10px] text-gray-700">({stats.evening.grouped}g / {stats.evening.total - stats.evening.grouped}t)</span>
          </div>

          {/* Ayraç */}
          <div className="h-6 w-px bg-gray-300 mx-1"></div>

          {/* Özet */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 bg-purple-100 px-2 py-1 rounded">
              <span className="w-2 h-2 rounded bg-purple-600"></span>
              <b className="text-gray-800">{orders.filter(o => o.groupId).length}</b>
              <span className="text-gray-600">gruplu</span>
            </span>
            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
              <span className="w-2 h-2 rounded bg-gray-500"></span>
              <b className="text-gray-800">{orders.filter(o => !o.groupId).length}</b>
              <span className="text-gray-600">tekil</span>
            </span>
          </div>
        </div>
      </div>

      {/* Mesajlar */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Canvas */}
      <AssignmentCanvas
        orders={orders}
        groups={groups}
        drivers={drivers}
        selectedDate={selectedDate}
        onAssign={handleAssign}
        onGroupAssign={handleGroupAssign}
        onRemoveFromGroup={handleRemoveFromGroup}
        onMergeOrders={handleMergeOrders}
        onPriceChange={handlePriceChange}
        onGroupPriceChange={handleGroupPriceChange}
        onDriverAdded={async () => {
          // Sürücü listesini yeniden yükle
          const driversRes = await fetch('/api/drivers')
          const driversData = await driversRes.json()
          setDrivers(driversData)
        }}
      />
    </div>
  )
}
