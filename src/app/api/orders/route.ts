import { NextRequest, NextResponse } from 'next/server'
import { getTimeSlot } from '@/lib/utils'
import { getImportedOrders, getImportData, getAvailableDates, getLatestDate, updateOrderDriver, updateOrderGroup } from '@/lib/import-store'

// GET - Tüm siparişleri listele
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeSlot = searchParams.get('timeSlot')
    const status = searchParams.get('status')
    const dateParam = searchParams.get('date') // Yeni: Tarih parametresi
    const listDates = searchParams.get('listDates') // Yeni: Mevcut tarihleri listele

    // Eğer listDates=true ise, mevcut tarihleri döndür
    if (listDates === 'true') {
      const dates = await getAvailableDates()
      const latestDate = await getLatestDate()
      return NextResponse.json({
        dates,
        latestDate,
        count: dates.length
      })
    }

    // Tarih belirtilmişse o tarihi, yoksa en son tarihi kullan
    let targetDate: string | null = dateParam
    if (!targetDate) {
      targetDate = await getLatestDate()
    }

    // Eğer hiç veri yoksa boş array döndür
    if (!targetDate) {
      return NextResponse.json([])
    }

    // Import data'yı al (tarih bilgisi için)
    const importData = await getImportData(targetDate)

    // Import store'dan siparişleri al
    let orders = await getImportedOrders(targetDate)

    // TimeSlot filtresi
    if (timeSlot) {
      orders = orders.filter(o => o.timeSlot === timeSlot)
    }

    // Status filtresi
    if (status) {
      orders = orders.filter(o => o.status === status)
    }

    // Canvas formatına dönüştür
    const formattedOrders = orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      driver: o.driverName || null,
      pickupTime: o.pickupTime,
      pickupAddress: o.pickupAddress,
      dropoffTime: o.dropoffTime,
      dropoffAddress: o.dropoffAddress,
      pickupLat: o.pickupLat || null,
      pickupLng: o.pickupLng || null,
      dropoffLat: o.dropoffLat || null,
      dropoffLng: o.dropoffLng || null,
      timeSlot: o.timeSlot || getTimeSlot(o.pickupTime),
      groupId: o.groupId || null,
      status: o.status || 'PENDING',
      notes: null,
      orderDate: importData?.date || new Date().toISOString(),
      customerName: o.customerName,
      price: o.price || 0,
      groupPrice: o.groupPrice || 0,
      tipAmount: o.tipAmount || 0,
      priceAmount: o.priceAmount || 0,
      // Sürücü yanıt bilgileri
      driverResponse: o.driverResponse || null,
      driverResponseTime: o.driverResponseTime || null,
      smsSent: o.smsSent || false,
      smsSentTime: o.smsSentTime || null,
      // Meta bilgiler
      _dateKey: importData?.dateKey,
      _importTimestamp: importData?.timestamp
    }))

    return NextResponse.json(formattedOrders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Siparisler yuklenirken hata olustu' },
      { status: 500 }
    )
  }
}

// POST - Yeni sipariş oluştur veya güncelle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Eğer güncelleme isteği ise
    if (body.action === 'updateDriver' && body.orderId) {
      const success = await updateOrderDriver(body.orderId, body.driverName, body.date)
      if (success) {
        return NextResponse.json({ success: true, message: 'Sürücü atandı' })
      }
      return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
    }

    if (body.action === 'updateGroup' && body.orderId) {
      const success = await updateOrderGroup(body.orderId, body.groupId, body.date)
      if (success) {
        return NextResponse.json({ success: true, message: 'Grup güncellendi' })
      }
      return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
    }

    // Yeni sipariş oluştur (mock)
    const order = {
      id: Date.now().toString(),
      orderNumber: body.orderNumber,
      driver: body.driver || null,
      pickupTime: body.pickupTime,
      pickupAddress: body.pickupAddress,
      dropoffTime: body.dropoffTime,
      dropoffAddress: body.dropoffAddress,
      pickupLat: body.pickupLat || null,
      pickupLng: body.pickupLng || null,
      dropoffLat: body.dropoffLat || null,
      dropoffLng: body.dropoffLng || null,
      timeSlot: body.timeSlot || getTimeSlot(body.pickupTime),
      groupId: body.groupId || null,
      status: body.driver ? 'ASSIGNED' : 'PENDING',
      notes: body.notes || null,
      orderDate: body.orderDate || new Date().toISOString(),
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Siparis olusturulurken hata olustu' },
      { status: 500 }
    )
  }
}
