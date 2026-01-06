import { CSVOrderData } from '@/types/order'

// PDF'den çıkarılan text'i parse et
export function parsePDFContent(text: string): CSVOrderData[] {
  const orders: CSVOrderData[] = []
  const lines = text.split('\n').filter(line => line.trim())

  // Farklı PDF formatlarını dene
  // Format 1: Tablo şeklinde (satır satır)
  // Format 2: Virgülle ayrılmış
  // Format 3: Tab ile ayrılmış

  let currentOrder: Partial<CSVOrderData> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Sipariş numarası pattern'i (SS ile başlayan)
    const orderMatch = line.match(/SS\d+[_\d]*/g)
    if (orderMatch) {
      // Yeni sipariş başlıyor
      if (currentOrder.orderNumber) {
        orders.push(currentOrder as CSVOrderData)
      }
      currentOrder = {
        orderNumber: orderMatch[0],
        driver: '',
        pickupTime: '',
        pickupAddress: '',
        dropoffTime: '',
        dropoffAddress: '',
      }
    }

    // Sürücü adı (genelde büyük harfle başlayan 2 kelime)
    const driverMatch = line.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/)
    if (driverMatch && !currentOrder.driver) {
      currentOrder.driver = driverMatch[1]
    }

    // Saat pattern'i (XX:XX AM/PM)
    const timeMatches = line.match(/\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/gi)
    if (timeMatches) {
      if (!currentOrder.pickupTime && timeMatches[0]) {
        currentOrder.pickupTime = timeMatches[0]
      }
      if (!currentOrder.dropoffTime && timeMatches[1]) {
        currentOrder.dropoffTime = timeMatches[1]
      }
    }

    // Adres pattern'i (numara + sokak adı veya şehir, eyalet, zip)
    const addressMatch = line.match(/\d+\s+[\w\s]+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pl|Pkwy|Hwy)[,\s]+[\w\s]+,\s*[A-Z]{2}\s*\d{5}/gi)
    if (addressMatch) {
      if (!currentOrder.pickupAddress) {
        currentOrder.pickupAddress = addressMatch[0]
      } else if (!currentOrder.dropoffAddress) {
        currentOrder.dropoffAddress = addressMatch[0]
      }
    }

    // Alternatif adres pattern'i (virgülle ayrılmış format)
    if (!currentOrder.pickupAddress || !currentOrder.dropoffAddress) {
      const simpleAddressMatch = line.match(/\d+[^,]+,[^,]+,\s*[A-Z]{2}\s*\d{5}/gi)
      if (simpleAddressMatch) {
        if (!currentOrder.pickupAddress) {
          currentOrder.pickupAddress = simpleAddressMatch[0]
        } else if (!currentOrder.dropoffAddress) {
          currentOrder.dropoffAddress = simpleAddressMatch.length > 1
            ? simpleAddressMatch[1]
            : simpleAddressMatch[0]
        }
      }
    }
  }

  // Son siparişi ekle
  if (currentOrder.orderNumber) {
    orders.push(currentOrder as CSVOrderData)
  }

  return orders
}

// Tablo formatındaki PDF'i parse et
export function parseTablePDF(text: string): CSVOrderData[] {
  const orders: CSVOrderData[] = []
  const lines = text.split('\n').filter(line => line.trim())

  // Başlık satırını bul
  let headerIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()
    if (
      line.includes('sürücü') ||
      line.includes('driver') ||
      line.includes('sipariş') ||
      line.includes('order')
    ) {
      headerIndex = i
      break
    }
  }

  // Başlık bulunmadıysa genel parser kullan
  if (headerIndex === -1) {
    return parsePDFContent(text)
  }

  // Veri satırlarını işle
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Satırı parçalara ayır (tab, çoklu boşluk veya | ile)
    const parts = line.split(/\t+|\s{2,}|\|/).filter(p => p.trim())

    if (parts.length >= 6) {
      orders.push({
        driver: parts[0]?.trim() || '',
        orderNumber: parts[1]?.trim() || '',
        pickupTime: parts[2]?.trim() || '',
        pickupAddress: parts[3]?.trim() || '',
        dropoffTime: parts[4]?.trim() || '',
        dropoffAddress: parts[5]?.trim() || '',
      })
    }
  }

  return orders
}

// Ana PDF parse fonksiyonu
export function parsePDF(text: string): CSVOrderData[] {
  // Önce tablo formatını dene
  let orders = parseTablePDF(text)

  // Sonuç yoksa genel parser dene
  if (orders.length === 0) {
    orders = parsePDFContent(text)
  }

  // Geçerli siparişleri filtrele
  return orders.filter(order =>
    order.orderNumber &&
    order.pickupAddress &&
    order.dropoffAddress
  )
}
