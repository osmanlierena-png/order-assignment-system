import { CSVOrderData } from '@/types/order'
import { CSV_HEADER_MAP } from './constants'
import { getTimeSlot } from './utils'

// CSV satırını parse et
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

// CSV içeriğini parse et
export function parseCSV(content: string): CSVOrderData[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  // Header satırı
  const headers = parseCSVLine(lines[0])

  // Header'ları İngilizce'ye çevir
  const mappedHeaders = headers.map(h => {
    const trimmed = h.trim().replace(/"/g, '')
    return CSV_HEADER_MAP[trimmed] || trimmed.toLowerCase()
  })

  // Veri satırları
  const orders: CSVOrderData[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length < headers.length) continue

    const order: Record<string, string> = {}
    mappedHeaders.forEach((header, index) => {
      order[header] = values[index]?.replace(/"/g, '').trim() || ''
    })

    // Gerekli alanlar kontrolü
    if (order.orderNumber && order.pickupAddress && order.dropoffAddress) {
      orders.push({
        driver: order.driver || '',
        orderNumber: order.orderNumber,
        pickupTime: order.pickupTime || '',
        pickupAddress: order.pickupAddress,
        dropoffTime: order.dropoffTime || '',
        dropoffAddress: order.dropoffAddress,
      })
    }
  }

  return orders
}

// CSV verisini veritabanı formatına çevir
export function transformCSVToOrders(csvOrders: CSVOrderData[]) {
  return csvOrders.map(order => ({
    orderNumber: order.orderNumber,
    driver: order.driver || null,
    pickupTime: order.pickupTime,
    pickupAddress: order.pickupAddress,
    dropoffTime: order.dropoffTime,
    dropoffAddress: order.dropoffAddress,
    timeSlot: getTimeSlot(order.pickupTime),
    status: order.driver ? 'ASSIGNED' : 'PENDING',
  }))
}
