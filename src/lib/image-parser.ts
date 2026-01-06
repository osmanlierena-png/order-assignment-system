import Tesseract from 'tesseract.js'

export interface ParsedOrderFromImage {
  driver: string
  orderNumber: string
  customer: string
  pickupTime: string
  pickupAddress: string
  dropoffTime: string
  dropoffAddress: string
}

// OCR ile resimden metin çıkarma
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const result = await Tesseract.recognize(imageBuffer, 'eng', {
    logger: (m) => console.log(m),
  })
  return result.data.text
}

// Screenshot tablo formatından order verilerini parse etme
// Beklenen kolonlar: Order No, Priority, Order Status, Pickup Address, Delivery Address, Pickup Time, Suggested Pu, Delivery Time
export function parseOrdersFromText(text: string): ParsedOrderFromImage[] {
  const orders: ParsedOrderFromImage[] = []
  const lines = text.split('\n').filter((line) => line.trim())

  // Order No pattern'i (Ez ile başlayan kodlar)
  const orderNoPattern = /\b(Ez[A-Z0-9]{5,})\b/gi

  // Zaman pattern'i (10:15 AM formatı)
  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi

  // Adres pattern'i (ABD formatı - sokak numarası + isim + şehir + eyalet + zip)
  const addressPattern = /(\d+\s+[^,]+,\s*[^,]+,\s*(?:VA|MD|DC)\s*\d{5})/gi

  let currentOrder: Partial<ParsedOrderFromImage> | null = null

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.length < 5) continue

    // Order No bul
    const orderMatch = trimmedLine.match(orderNoPattern)
    if (orderMatch) {
      // Önceki siparişi kaydet
      if (currentOrder && currentOrder.orderNumber) {
        orders.push({
          driver: currentOrder.driver || '',
          orderNumber: currentOrder.orderNumber,
          customer: currentOrder.customer || '',
          pickupTime: currentOrder.pickupTime || '',
          pickupAddress: currentOrder.pickupAddress || '',
          dropoffTime: currentOrder.dropoffTime || '',
          dropoffAddress: currentOrder.dropoffAddress || '',
        })
      }

      // Yeni sipariş başlat
      currentOrder = {
        orderNumber: orderMatch[0],
        driver: '',
        customer: '',
        pickupTime: '',
        pickupAddress: '',
        dropoffTime: '',
        dropoffAddress: '',
      }
    }

    // Eğer aktif sipariş varsa, diğer bilgileri topla
    if (currentOrder) {
      // Adres bul
      const addresses = trimmedLine.match(addressPattern)
      if (addresses) {
        for (const addr of addresses) {
          if (!currentOrder.pickupAddress) {
            currentOrder.pickupAddress = addr
          } else if (!currentOrder.dropoffAddress) {
            currentOrder.dropoffAddress = addr
          }
        }
      }

      // Zaman bul (AM/PM formatı)
      const times = trimmedLine.match(timePattern)
      if (times) {
        for (const time of times) {
          // İlk bulunan zaman pickup, sonraki delivery
          if (!currentOrder.pickupTime) {
            currentOrder.pickupTime = time.trim()
          } else if (!currentOrder.dropoffTime && time !== currentOrder.pickupTime) {
            currentOrder.dropoffTime = time.trim()
          }
        }
      }
    }
  }

  // Son siparişi kaydet
  if (currentOrder && currentOrder.orderNumber) {
    orders.push({
      driver: currentOrder.driver || '',
      orderNumber: currentOrder.orderNumber,
      customer: currentOrder.customer || '',
      pickupTime: currentOrder.pickupTime || '',
      pickupAddress: currentOrder.pickupAddress || '',
      dropoffTime: currentOrder.dropoffTime || '',
      dropoffAddress: currentOrder.dropoffAddress || '',
    })
  }

  // Eğer hiç order bulunamadıysa, alternatif parsing dene
  if (orders.length === 0) {
    return parseOrdersAlternative(text)
  }

  return orders
}

// Alternatif parsing (satır bazlı)
function parseOrdersAlternative(text: string): ParsedOrderFromImage[] {
  const orders: ParsedOrderFromImage[] = []
  const lines = text.split('\n').filter((line) => line.trim().length > 10)

  // Her satırda adres ve zaman ara
  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM))/gi
  const addressKeywords = ['st', 'ave', 'blvd', 'dr', 'rd', 'ln', 'way', 'pkwy', 'ct']

  for (const line of lines) {
    const lowerLine = line.toLowerCase()

    // Adres içeren satır mı?
    const hasAddress = addressKeywords.some((kw) => lowerLine.includes(` ${kw} `) || lowerLine.includes(` ${kw},`))
    const times = line.match(timePattern)

    if (hasAddress && times && times.length > 0) {
      // Bu satırda hem adres hem zaman var
      const order: ParsedOrderFromImage = {
        driver: '',
        orderNumber: generateOrderNumber(),
        customer: '',
        pickupTime: times[0] || '',
        pickupAddress: extractAddress(line),
        dropoffTime: times[1] || '',
        dropoffAddress: '',
      }

      if (order.pickupAddress) {
        orders.push(order)
      }
    }
  }

  return orders
}

// Satırdan adres çıkar
function extractAddress(line: string): string {
  // Basit adres çıkarma - sayı ile başlayan kısımları al
  const match = line.match(/\d+\s+[^,]+(?:,\s*[^,]+){1,3}/)
  return match ? match[0].trim() : line.trim()
}

function generateOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}

// Ana parse fonksiyonu
export async function parseImageToOrders(imageBuffer: Buffer): Promise<ParsedOrderFromImage[]> {
  const text = await extractTextFromImage(imageBuffer)
  console.log('OCR Text:', text)
  return parseOrdersFromText(text)
}
