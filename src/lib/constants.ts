// Zaman dilimleri
export const TIME_SLOTS = {
  MORNING: { label: 'Sabah', start: 6, end: 12, color: '#fef3c7' },
  AFTERNOON: { label: 'Öğlen', start: 12, end: 17, color: '#dbeafe' },
  EVENING: { label: 'Akşam', start: 17, end: 22, color: '#ede9fe' },
} as const

// Durum etiketleri
export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Beklemede',
  ASSIGNED: 'Atandı',
  CONFIRMED: 'Onaylandı',
  IN_TRANSIT: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal',
}

// Durum renkleri
export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  IN_TRANSIT: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

// Sürücü yanıt etiketleri
export const RESPONSE_LABELS: Record<string, string> = {
  ACCEPTED: 'Onayladı',
  REJECTED: 'Reddetti',
}

// Sürücü yanıt renkleri
export const RESPONSE_COLORS: Record<string, string> = {
  ACCEPTED: 'bg-green-500 text-white',
  REJECTED: 'bg-red-500 text-white',
}

// Sürücü yanıt ikonları
export const RESPONSE_ICONS: Record<string, string> = {
  ACCEPTED: '✅',
  REJECTED: '❌',
}

// CSV başlık eşleştirmeleri (Türkçe -> İngilizce)
export const CSV_HEADER_MAP: Record<string, string> = {
  'Sürücü': 'driver',
  'Sipariş No': 'orderNumber',
  'Müşteri': 'customer', // kullanılmayacak
  'Pickup Saati': 'pickupTime',
  'Pickup Adresi': 'pickupAddress',
  'Dropoff Saati': 'dropoffTime',
  'Dropoff Adresi': 'dropoffAddress',
}

// Node renkleri
export const NODE_COLORS = {
  order: {
    pending: '#fef3c7',
    assigned: '#dbeafe',
  },
  orderGroup: {
    MORNING: '#fef3c7',
    AFTERNOON: '#dbeafe',
    EVENING: '#ede9fe',
  },
  driver: '#dcfce7',
}
