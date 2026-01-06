import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Gerçek sürücü isimleri
const DRIVERS = [
  'Sertan Qwert',
  'Ersad Alp',
  'Victor Victor',
  'Enis Kiziltoprak',
  'Ahmet Nihat Uzunoglu',
  'Baran Dogan',
  'Kerem Colakkadioglu',
  'Onur Uzonur',
  'Adam Saidi',
  'Marcus Nunes',
  'Seyit Gumus',
  'Muhammed Serdar Yildiz',
  'Akram Khan',
  'Jose Beltrain',
  'Eren Eren',
  'Timothee Djouokep Tchouamou',
  'Serdar Bazarov',
  'Marko Dimitrijevic',
  'Fehim Subasi',
  'Ali Qutishat',
]

// Gerçekçi adresler - bölgelere göre
const ADDRESSES = {
  DC_NW: [
    { address: '1275 K St NW, Washington, DC 20005', zip: '20005' },
    { address: '800 17th St NW, Washington, DC 20006', zip: '20006' },
    { address: '1919 M St NW, Washington, DC 20036', zip: '20036' },
    { address: '2000 Pennsylvania Ave NW, Washington, DC 20006', zip: '20006' },
    { address: '1331 F St NW, Washington, DC 20004', zip: '20004' },
    { address: '1050 Connecticut Ave NW, Washington, DC 20036', zip: '20036' },
    { address: '1101 K St NW, Washington, DC 20005', zip: '20005' },
    { address: '1300 Connecticut Ave NW, Washington, DC 20036', zip: '20036' },
  ],
  DC_NE: [
    { address: '145 N St NE, Washington, DC 20002', zip: '20002' },
    { address: '1275 1st St NE, Washington, DC 20002', zip: '20002' },
    { address: '51 M St NE, Washington, DC 20002', zip: '20002' },
    { address: '700 K St NW 7th Floor, Washington, DC 20001', zip: '20001' },
  ],
  DC_SE: [
    { address: '526 8th St SE, Washington, DC 20003', zip: '20003' },
    { address: '1015 Half St SE, Washington, DC 20003', zip: '20003' },
    { address: '1201 Half St SE, Washington, DC 20003', zip: '20003' },
    { address: '15 Independence Ave SE, Washington, DC 20515', zip: '20515' },
  ],
  ARLINGTON: [
    { address: '4238 Wilson Blvd, Arlington, VA 22203', zip: '22203' },
    { address: '1735 N Lynn St, Arlington, VA 22209', zip: '22209' },
    { address: '950 N Glebe Rd Suite 200, Arlington, VA 22203', zip: '22203' },
    { address: '1301 S Joyce St, Arlington, VA 22202', zip: '22202' },
    { address: '2450 Crystal Dr, Arlington, VA 22202', zip: '22202' },
  ],
  TYSONS: [
    { address: '2001 International Dr, McLean, VA 22102', zip: '22102' },
    { address: '1600 Tysons Blvd 1100, McLean, VA 22102', zip: '22102' },
    { address: '8350 Broad St, Tysons, VA 22102', zip: '22102' },
    { address: '8607 Westwood Center Dr, Vienna, VA 22182', zip: '22182' },
  ],
  RESTON: [
    { address: '1833 Fountain Dr, Reston, VA 20190', zip: '20190' },
    { address: '11800 Sunrise Valley Dr, Reston, VA 20191', zip: '20191' },
    { address: '1827 Library St, Reston, VA 20190', zip: '20190' },
  ],
  BETHESDA: [
    { address: '4870 Bethesda Ave, Bethesda, MD 20814', zip: '20814' },
    { address: '7550 Wisconsin Ave, Bethesda, MD 20814', zip: '20814' },
    { address: '5404 Wisconsin Ave, Chevy Chase, MD 20815', zip: '20815' },
    { address: '6710 Rockledge Dr, Bethesda, MD 20817', zip: '20817' },
  ],
  ROCKVILLE: [
    { address: '9713 Key W Ave, Rockville, MD 20850', zip: '20850' },
    { address: '6100 Executive Blvd, Rockville, MD 20852', zip: '20852' },
    { address: '11810 Grand Park Ave, Rockville, MD 20852', zip: '20852' },
  ],
  FREDERICK: [
    { address: '5582 Spectrum Dr, Frederick, MD 21703', zip: '21703' },
    { address: '1305 W 7th St, Frederick, MD 21702', zip: '21702' },
  ],
  FREDERICKSBURG: [
    { address: '1779 Carl D Silver Pkwy, Fredericksburg, VA 22401', zip: '22401' },
    { address: '10159 Patriot Hwy, Fredericksburg, VA 22407', zip: '22407' },
  ],
}

// Order numarası üreteci
let orderCounter = 0
function generateOrderNumber(): string {
  orderCounter++
  const timestamp = Date.now()
  return `SS${timestamp}_${orderCounter}_${Math.floor(Math.random() * 10)}`
}

// Rastgele adres seç
function getRandomAddress(region: keyof typeof ADDRESSES) {
  const addresses = ADDRESSES[region]
  return addresses[Math.floor(Math.random() * addresses.length)]
}

// Test orderları - KESİN BİRLEŞMELİ ÖRNEKLER
const TEST_ORDERS = [
  // ========== SABAH (06:00-09:00) - 15 order ==========

  // DC NW Grubu - 3 order (KESİN BİRLEŞMELİ)
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '07:00 AM',
    pickupAddress: '1275 K St NW, Washington, DC 20005',
    dropoffTime: '07:30 AM',
    dropoffAddress: '800 17th St NW, Washington, DC 20006',
    timeSlot: 'MORNING',
    group: 'DC_NW_MORNING',
  },
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '07:45 AM',
    pickupAddress: '1919 M St NW, Washington, DC 20036',
    dropoffTime: '08:15 AM',
    dropoffAddress: '1101 K St NW, Washington, DC 20005',
    timeSlot: 'MORNING',
    group: 'DC_NW_MORNING',
  },
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '08:30 AM',
    pickupAddress: '1050 Connecticut Ave NW, Washington, DC 20036',
    dropoffTime: '09:00 AM',
    dropoffAddress: '1300 Connecticut Ave NW, Washington, DC 20036',
    timeSlot: 'MORNING',
    group: 'DC_NW_MORNING',
  },

  // Arlington Grubu - 2 order (KESİN BİRLEŞMELİ)
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '07:15 AM',
    pickupAddress: '4238 Wilson Blvd, Arlington, VA 22203',
    dropoffTime: '07:45 AM',
    dropoffAddress: '950 N Glebe Rd Suite 200, Arlington, VA 22203',
    timeSlot: 'MORNING',
    group: 'ARLINGTON_MORNING',
  },
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '08:00 AM',
    pickupAddress: '1735 N Lynn St, Arlington, VA 22209',
    dropoffTime: '08:30 AM',
    dropoffAddress: '1301 S Joyce St, Arlington, VA 22202',
    timeSlot: 'MORNING',
    group: 'ARLINGTON_MORNING',
  },

  // Tekil Sabah Orderları (10 adet)
  { orderNumber: generateOrderNumber(), pickupTime: '06:30 AM', pickupAddress: '1833 Fountain Dr, Reston, VA 20190', dropoffTime: '07:00 AM', dropoffAddress: '11800 Sunrise Valley Dr, Reston, VA 20191', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '06:45 AM', pickupAddress: '5582 Spectrum Dr, Frederick, MD 21703', dropoffTime: '07:15 AM', dropoffAddress: '1305 W 7th St, Frederick, MD 21702', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '07:00 AM', pickupAddress: '4870 Bethesda Ave, Bethesda, MD 20814', dropoffTime: '07:30 AM', dropoffAddress: '7550 Wisconsin Ave, Bethesda, MD 20814', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '07:30 AM', pickupAddress: '145 N St NE, Washington, DC 20002', dropoffTime: '08:00 AM', dropoffAddress: '1275 1st St NE, Washington, DC 20002', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '08:00 AM', pickupAddress: '526 8th St SE, Washington, DC 20003', dropoffTime: '08:30 AM', dropoffAddress: '1015 Half St SE, Washington, DC 20003', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '08:15 AM', pickupAddress: '2001 International Dr, McLean, VA 22102', dropoffTime: '08:45 AM', dropoffAddress: '1600 Tysons Blvd 1100, McLean, VA 22102', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '08:30 AM', pickupAddress: '9713 Key W Ave, Rockville, MD 20850', dropoffTime: '09:00 AM', dropoffAddress: '6100 Executive Blvd, Rockville, MD 20852', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '06:15 AM', pickupAddress: '1779 Carl D Silver Pkwy, Fredericksburg, VA 22401', dropoffTime: '07:00 AM', dropoffAddress: '10159 Patriot Hwy, Fredericksburg, VA 22407', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '07:45 AM', pickupAddress: '2450 Crystal Dr, Arlington, VA 22202', dropoffTime: '08:15 AM', dropoffAddress: '15 Independence Ave SE, Washington, DC 20515', timeSlot: 'MORNING' },
  { orderNumber: generateOrderNumber(), pickupTime: '08:45 AM', pickupAddress: '1827 Library St, Reston, VA 20190', dropoffTime: '09:15 AM', dropoffAddress: '8607 Westwood Center Dr, Vienna, VA 22182', timeSlot: 'MORNING' },

  // ========== ÖĞLE (10:00-13:00) - 30 order ==========

  // DC Grubu 1 - 2 order (KESİN BİRLEŞMELİ)
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '10:45 AM',
    pickupAddress: '700 K St NW 7th Floor, Washington, DC 20001',
    dropoffTime: '11:15 AM',
    dropoffAddress: '1275 K St NW, Washington, DC 20005',
    timeSlot: 'AFTERNOON',
    group: 'DC_NOON_1',
  },
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '11:30 AM',
    pickupAddress: '145 N St NE, Washington, DC 20002',
    dropoffTime: '12:00 PM',
    dropoffAddress: '51 M St NE, Washington, DC 20002',
    timeSlot: 'AFTERNOON',
    group: 'DC_NOON_1',
  },

  // Bethesda Grubu - 2 order (KESİN BİRLEŞMELİ)
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '11:00 AM',
    pickupAddress: '4870 Bethesda Ave, Bethesda, MD 20814',
    dropoffTime: '11:30 AM',
    dropoffAddress: '7550 Wisconsin Ave, Bethesda, MD 20814',
    timeSlot: 'AFTERNOON',
    group: 'BETHESDA_NOON',
  },
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '11:45 AM',
    pickupAddress: '5404 Wisconsin Ave, Chevy Chase, MD 20815',
    dropoffTime: '12:15 PM',
    dropoffAddress: '6710 Rockledge Dr, Bethesda, MD 20817',
    timeSlot: 'AFTERNOON',
    group: 'BETHESDA_NOON',
  },

  // Tysons Grubu - 2 order (KESİN BİRLEŞMELİ)
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '11:00 AM',
    pickupAddress: '2001 International Dr, McLean, VA 22102',
    dropoffTime: '11:30 AM',
    dropoffAddress: '8350 Broad St, Tysons, VA 22102',
    timeSlot: 'AFTERNOON',
    group: 'TYSONS_NOON',
  },
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '11:45 AM',
    pickupAddress: '1600 Tysons Blvd 1100, McLean, VA 22102',
    dropoffTime: '12:15 PM',
    dropoffAddress: '8607 Westwood Center Dr, Vienna, VA 22182',
    timeSlot: 'AFTERNOON',
    group: 'TYSONS_NOON',
  },

  // Tekil Öğle Orderları (24 adet)
  { orderNumber: generateOrderNumber(), pickupTime: '10:30 AM', pickupAddress: '1331 F St NW, Washington, DC 20004', dropoffTime: '11:00 AM', dropoffAddress: '2000 Pennsylvania Ave NW, Washington, DC 20006', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '10:45 AM', pickupAddress: '1919 M St NW, Washington, DC 20036', dropoffTime: '11:15 AM', dropoffAddress: '1050 Connecticut Ave NW, Washington, DC 20036', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:00 AM', pickupAddress: '526 8th St SE, Washington, DC 20003', dropoffTime: '11:30 AM', dropoffAddress: '1201 Half St SE, Washington, DC 20003', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:00 AM', pickupAddress: '4238 Wilson Blvd, Arlington, VA 22203', dropoffTime: '11:30 AM', dropoffAddress: '950 N Glebe Rd Suite 200, Arlington, VA 22203', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:15 AM', pickupAddress: '1833 Fountain Dr, Reston, VA 20190', dropoffTime: '11:45 AM', dropoffAddress: '11800 Sunrise Valley Dr, Reston, VA 20191', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:15 AM', pickupAddress: '9713 Key W Ave, Rockville, MD 20850', dropoffTime: '11:45 AM', dropoffAddress: '11810 Grand Park Ave, Rockville, MD 20852', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:30 AM', pickupAddress: '1735 N Lynn St, Arlington, VA 22209', dropoffTime: '12:00 PM', dropoffAddress: '2450 Crystal Dr, Arlington, VA 22202', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:30 AM', pickupAddress: '1827 Library St, Reston, VA 20190', dropoffTime: '12:00 PM', dropoffAddress: '1833 Fountain Dr, Reston, VA 20190', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:45 AM', pickupAddress: '1275 1st St NE, Washington, DC 20002', dropoffTime: '12:15 PM', dropoffAddress: '700 K St NW 7th Floor, Washington, DC 20001', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:45 AM', pickupAddress: '6100 Executive Blvd, Rockville, MD 20852', dropoffTime: '12:15 PM', dropoffAddress: '9713 Key W Ave, Rockville, MD 20850', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:00 PM', pickupAddress: '800 17th St NW, Washington, DC 20006', dropoffTime: '12:30 PM', dropoffAddress: '1101 K St NW, Washington, DC 20005', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:00 PM', pickupAddress: '1301 S Joyce St, Arlington, VA 22202', dropoffTime: '12:30 PM', dropoffAddress: '4238 Wilson Blvd, Arlington, VA 22203', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:15 PM', pickupAddress: '1015 Half St SE, Washington, DC 20003', dropoffTime: '12:45 PM', dropoffAddress: '526 8th St SE, Washington, DC 20003', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:15 PM', pickupAddress: '11800 Sunrise Valley Dr, Reston, VA 20191', dropoffTime: '12:45 PM', dropoffAddress: '1827 Library St, Reston, VA 20190', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:30 PM', pickupAddress: '1300 Connecticut Ave NW, Washington, DC 20036', dropoffTime: '01:00 PM', dropoffAddress: '1919 M St NW, Washington, DC 20036', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:30 PM', pickupAddress: '7550 Wisconsin Ave, Bethesda, MD 20814', dropoffTime: '01:00 PM', dropoffAddress: '4870 Bethesda Ave, Bethesda, MD 20814', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:45 PM', pickupAddress: '8350 Broad St, Tysons, VA 22102', dropoffTime: '01:15 PM', dropoffAddress: '2001 International Dr, McLean, VA 22102', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '10:30 AM', pickupAddress: '5582 Spectrum Dr, Frederick, MD 21703', dropoffTime: '11:00 AM', dropoffAddress: '1305 W 7th St, Frederick, MD 21702', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:00 AM', pickupAddress: '1779 Carl D Silver Pkwy, Fredericksburg, VA 22401', dropoffTime: '11:30 AM', dropoffAddress: '10159 Patriot Hwy, Fredericksburg, VA 22407', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '10:45 AM', pickupAddress: '51 M St NE, Washington, DC 20002', dropoffTime: '11:15 AM', dropoffAddress: '145 N St NE, Washington, DC 20002', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:00 AM', pickupAddress: '15 Independence Ave SE, Washington, DC 20515', dropoffTime: '11:30 AM', dropoffAddress: '1201 Half St SE, Washington, DC 20003', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:15 AM', pickupAddress: '8607 Westwood Center Dr, Vienna, VA 22182', dropoffTime: '11:45 AM', dropoffAddress: '8350 Broad St, Tysons, VA 22102', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '11:30 AM', pickupAddress: '6710 Rockledge Dr, Bethesda, MD 20817', dropoffTime: '12:00 PM', dropoffAddress: '5404 Wisconsin Ave, Chevy Chase, MD 20815', timeSlot: 'AFTERNOON' },
  { orderNumber: generateOrderNumber(), pickupTime: '12:00 PM', pickupAddress: '11810 Grand Park Ave, Rockville, MD 20852', dropoffTime: '12:30 PM', dropoffAddress: '6100 Executive Blvd, Rockville, MD 20852', timeSlot: 'AFTERNOON' },

  // ========== AKŞAM (15:00-18:00) - 10 order ==========

  // DC Grubu - 2 order (KESİN BİRLEŞMELİ)
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '03:30 PM',
    pickupAddress: '526 8th St SE, Washington, DC 20003',
    dropoffTime: '04:00 PM',
    dropoffAddress: '1015 Half St SE, Washington, DC 20003',
    timeSlot: 'EVENING',
    group: 'DC_EVENING',
  },
  {
    orderNumber: generateOrderNumber(),
    pickupTime: '04:15 PM',
    pickupAddress: '1201 Half St SE, Washington, DC 20003',
    dropoffTime: '04:45 PM',
    dropoffAddress: '15 Independence Ave SE, Washington, DC 20515',
    timeSlot: 'EVENING',
    group: 'DC_EVENING',
  },

  // Tekil Akşam Orderları (8 adet)
  { orderNumber: generateOrderNumber(), pickupTime: '03:00 PM', pickupAddress: '1275 K St NW, Washington, DC 20005', dropoffTime: '03:30 PM', dropoffAddress: '800 17th St NW, Washington, DC 20006', timeSlot: 'EVENING' },
  { orderNumber: generateOrderNumber(), pickupTime: '03:15 PM', pickupAddress: '4238 Wilson Blvd, Arlington, VA 22203', dropoffTime: '03:45 PM', dropoffAddress: '1735 N Lynn St, Arlington, VA 22209', timeSlot: 'EVENING' },
  { orderNumber: generateOrderNumber(), pickupTime: '03:45 PM', pickupAddress: '2001 International Dr, McLean, VA 22102', dropoffTime: '04:15 PM', dropoffAddress: '1600 Tysons Blvd 1100, McLean, VA 22102', timeSlot: 'EVENING' },
  { orderNumber: generateOrderNumber(), pickupTime: '04:00 PM', pickupAddress: '4870 Bethesda Ave, Bethesda, MD 20814', dropoffTime: '04:30 PM', dropoffAddress: '7550 Wisconsin Ave, Bethesda, MD 20814', timeSlot: 'EVENING' },
  { orderNumber: generateOrderNumber(), pickupTime: '04:30 PM', pickupAddress: '1833 Fountain Dr, Reston, VA 20190', dropoffTime: '05:00 PM', dropoffAddress: '11800 Sunrise Valley Dr, Reston, VA 20191', timeSlot: 'EVENING' },
  { orderNumber: generateOrderNumber(), pickupTime: '05:00 PM', pickupAddress: '1919 M St NW, Washington, DC 20036', dropoffTime: '05:30 PM', dropoffAddress: '1050 Connecticut Ave NW, Washington, DC 20036', timeSlot: 'EVENING' },
  { orderNumber: generateOrderNumber(), pickupTime: '05:15 PM', pickupAddress: '9713 Key W Ave, Rockville, MD 20850', dropoffTime: '05:45 PM', dropoffAddress: '6100 Executive Blvd, Rockville, MD 20852', timeSlot: 'EVENING' },
  { orderNumber: generateOrderNumber(), pickupTime: '05:30 PM', pickupAddress: '1301 S Joyce St, Arlington, VA 22202', dropoffTime: '06:00 PM', dropoffAddress: '2450 Crystal Dr, Arlington, VA 22202', timeSlot: 'EVENING' },
]

async function main() {
  console.log('Seeding database...')

  // Önce mevcut verileri temizle
  await prisma.order.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.orderGroup.deleteMany()

  // Sürücüleri ekle
  console.log('Adding drivers...')
  for (const name of DRIVERS) {
    await prisma.driver.create({
      data: {
        name,
        isActive: true,
      },
    })
  }
  console.log(`Added ${DRIVERS.length} drivers`)

  // Orderları ekle
  console.log('Adding orders...')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const order of TEST_ORDERS) {
    await prisma.order.create({
      data: {
        orderNumber: order.orderNumber,
        pickupTime: order.pickupTime,
        pickupAddress: order.pickupAddress,
        dropoffTime: order.dropoffTime,
        dropoffAddress: order.dropoffAddress,
        timeSlot: order.timeSlot,
        status: 'PENDING',
        orderDate: today,
      },
    })
  }
  console.log(`Added ${TEST_ORDERS.length} orders`)

  // Özet
  const morningOrders = TEST_ORDERS.filter(o => o.timeSlot === 'MORNING').length
  const afternoonOrders = TEST_ORDERS.filter(o => o.timeSlot === 'AFTERNOON').length
  const eveningOrders = TEST_ORDERS.filter(o => o.timeSlot === 'EVENING').length

  console.log('\n=== SEED COMPLETE ===')
  console.log(`Drivers: ${DRIVERS.length}`)
  console.log(`Total Orders: ${TEST_ORDERS.length}`)
  console.log(`  Morning: ${morningOrders}`)
  console.log(`  Afternoon: ${afternoonOrders}`)
  console.log(`  Evening: ${eveningOrders}`)
  console.log('\nMergeable groups:')
  console.log('  - DC NW Morning (3 orders)')
  console.log('  - Arlington Morning (2 orders)')
  console.log('  - DC Noon (2 orders)')
  console.log('  - Bethesda Noon (2 orders)')
  console.log('  - Tysons Noon (2 orders)')
  console.log('  - DC Evening (2 orders)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
