// Google Cloud Vision API ile görüntüden sipariş verisi çıkarma
// NOT: Bu dosya server-side'da çalışır (API route içinde)

// Screenshot kolon yapısı:
// Order No | Priority | Order Status | Pickup Address | Delivery Address | Pickup Time | Suggested Pu | Delivery Time | Tip | Price | Region

export interface ParsedOrderFromVision {
  orderNumber: string
  pickupTime: string      // "Pickup Time" kolonundan (sadece saat: 10:15 AM)
  pickupAddress: string   // "Pickup Address" kolonundan
  dropoffTime: string     // "Delivery Time" kolonundan (tarih + saat: 12/24/2025 11:00:00 AM)
  dropoffAddress: string  // "Delivery Address" kolonundan
}

interface VisionTextAnnotation {
  description: string
  boundingPoly: {
    vertices: { x: number; y: number }[]
  }
}

// Google Vision API ile OCR
export async function extractTextWithVision(
  imageBuffer: Buffer,
  apiKey: string
): Promise<string> {
  const base64Image = imageBuffer.toString('base64')

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vision API error: ${error}`)
  }

  const data = await response.json()

  if (data.responses?.[0]?.error) {
    throw new Error(`Vision API error: ${data.responses[0].error.message}`)
  }

  // Full text annotation
  const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''
  return fullText
}

// Tablo formatındaki metinden siparişleri parse et
// OCR metni satır bazlı geliyor, adresler ve zamanlar karışık
export function parseOrdersFromVisionText(text: string): ParsedOrderFromVision[] {
  const orders: ParsedOrderFromVision[] = []

  console.log('Vision OCR Text:', text)

  // Metni tek satıra çevir, newline'ları boşlukla değiştir
  const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ')

  // Order No pattern (Ez ile başlayan)
  const orderNoPattern = /\b(Ez[A-Z0-9]{5,})\b/gi

  // Tüm order numaralarını bul (unique)
  const allOrderNumbers = [...new Set(cleanText.match(orderNoPattern) || [])]

  console.log('Found order numbers:', allOrderNumbers)

  // Tüm adresleri bul - daha geniş pattern
  // Pattern 1: Numara + sokak + şehir + eyalet + zip (tam adres)
  const fullAddressPattern = /(\d+\s+[A-Za-z0-9\s\.]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court|Pl|Place|Cir|Circle|Pkwy|Parkway)[^,]*,\s*[A-Za-z\s]+,?\s*(?:VA|MD|DC|Virginia|Maryland)?\s*\d{5})/gi

  // Pattern 2: Daha basit - sayı ile başlayan, 5 haneli zip ile biten
  const simpleAddressPattern = /(\d+[^,\d]{5,50},\s*[^,]+,?\s*(?:VA|MD|DC)?\s*\d{5})/gi

  // Pattern 3: En basit - herhangi bir metin + 5 haneli zip
  const zipAddressPattern = /([A-Za-z0-9\s\.,]+\s+\d{5})/gi

  // Tüm adresleri topla
  const allAddresses: string[] = []

  // Full pattern
  const fullMatches = cleanText.match(fullAddressPattern) || []
  allAddresses.push(...fullMatches)

  // Simple pattern (eğer full bulamadıysak)
  if (allAddresses.length < allOrderNumbers.length * 2) {
    const simpleMatches = cleanText.match(simpleAddressPattern) || []
    for (const addr of simpleMatches) {
      if (!allAddresses.some(a => a.includes(addr) || addr.includes(a))) {
        allAddresses.push(addr)
      }
    }
  }

  console.log('All addresses found:', allAddresses)

  // Her sipariş için adresleri ve zamanları bul
  for (let i = 0; i < allOrderNumbers.length; i++) {
    const orderNumber = allOrderNumbers[i]

    // Bir sonraki order numarasına kadar olan metni al
    const nextOrderNumber = allOrderNumbers[i + 1]
    let orderSection = ''

    const startIdx = cleanText.indexOf(orderNumber)
    if (nextOrderNumber) {
      const endIdx = cleanText.indexOf(nextOrderNumber, startIdx + orderNumber.length)
      orderSection = cleanText.substring(startIdx, endIdx)
    } else {
      orderSection = cleanText.substring(startIdx)
    }

    console.log(`Order ${orderNumber} section:`, orderSection.substring(0, 300))

    // Pickup Time - saat formatı (10:15 AM, 01:00 PM gibi - saniyesiz)
    const pickupTimeMatch = orderSection.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i)
    const pickupTime = pickupTimeMatch ? pickupTimeMatch[1] : ''

    // Delivery Time - tarih + saat formatı (12/24/2025 11:00:00 AM - saniyeli)
    // İkinci tarih-saat değeri delivery time (ilki suggested pickup)
    const deliveryTimeMatches = orderSection.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/gi) || []
    const dropoffTime = deliveryTimeMatches[1] || deliveryTimeMatches[0] || ''

    // Bu sipariş bölümündeki adresleri bul
    let pickupAddress = ''
    let dropoffAddress = ''

    // Önce tam pattern ile dene
    const sectionFullAddresses = orderSection.match(fullAddressPattern) || []
    if (sectionFullAddresses.length >= 2) {
      pickupAddress = sectionFullAddresses[0] || ''
      dropoffAddress = sectionFullAddresses[1] || ''
    } else if (sectionFullAddresses.length === 1) {
      pickupAddress = sectionFullAddresses[0] || ''
    }

    // Tam pattern bulamadıysak, basit pattern dene
    if (!pickupAddress || !dropoffAddress) {
      const sectionSimpleAddresses = orderSection.match(simpleAddressPattern) || []
      if (!pickupAddress && sectionSimpleAddresses.length >= 1) {
        pickupAddress = sectionSimpleAddresses[0] || ''
      }
      if (!dropoffAddress && sectionSimpleAddresses.length >= 2) {
        dropoffAddress = sectionSimpleAddresses[1] || ''
      } else if (!dropoffAddress && sectionSimpleAddresses.length === 1 && pickupAddress !== sectionSimpleAddresses[0]) {
        dropoffAddress = sectionSimpleAddresses[0] || ''
      }
    }

    // Global listeden de kontrol et (sırasıyla)
    if (!pickupAddress && allAddresses.length > i * 2) {
      pickupAddress = allAddresses[i * 2] || ''
    }
    if (!dropoffAddress && allAddresses.length > i * 2 + 1) {
      dropoffAddress = allAddresses[i * 2 + 1] || ''
    }

    // Adresleri temizle
    pickupAddress = pickupAddress.replace(/\s+/g, ' ').trim()
    dropoffAddress = dropoffAddress.replace(/\s+/g, ' ').trim()

    console.log(`  Pickup: ${pickupAddress}`)
    console.log(`  Dropoff: ${dropoffAddress}`)
    console.log(`  Pickup Time: ${pickupTime}`)
    console.log(`  Delivery Time: ${dropoffTime}`)

    const order: ParsedOrderFromVision = {
      orderNumber,
      pickupAddress,
      dropoffAddress,
      pickupTime,
      dropoffTime,
    }

    orders.push(order)
  }

  return orders
}

// Satır bazlı parsing (tablo satırları için)
function parseOrdersLineByLine(text: string): ParsedOrderFromVision[] {
  const orders: ParsedOrderFromVision[] = []
  const lines = text.split('\n')

  const orderNoPattern = /\b(Ez[A-Z0-9]{5,})\b/i
  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM))/gi
  const addressPattern = /(\d+\s+[^,\n]+(?:,\s*[^,\n]+){1,3})/i

  for (const line of lines) {
    const orderMatch = line.match(orderNoPattern)
    if (!orderMatch) continue

    const times = line.match(timePattern) || []
    const addressMatch = line.match(addressPattern)

    const order: ParsedOrderFromVision = {
      orderNumber: orderMatch[1],
      pickupTime: times[0] || '',
      dropoffTime: times[1] || times[0] || '',
      pickupAddress: addressMatch ? addressMatch[1] : '',
      dropoffAddress: '',
    }

    // Sadece order number varsa bile ekle
    if (order.orderNumber) {
      orders.push(order)
    }
  }

  return orders
}

// Ana fonksiyon
export async function parseImageWithGoogleVision(
  imageBuffer: Buffer,
  apiKey: string
): Promise<ParsedOrderFromVision[]> {
  const text = await extractTextWithVision(imageBuffer, apiKey)
  return parseOrdersFromVisionText(text)
}
