import { NextRequest, NextResponse } from 'next/server'
import { getCustomDrivers, addCustomDriver } from '@/lib/import-store'

// Hardcoded sürücü listesi (Base44'ten alındı - Ocak 2025)
const DRIVERS = [
  { id: '1', name: 'Abdu Abdu', phone: null },
  { id: '2', name: 'Abdurakhim Nabitov', phone: null },
  { id: '3', name: 'Adam Saidi', phone: null },
  { id: '4', name: 'Adnan Keceli', phone: null },
  { id: '5', name: 'Ahmet Nihat Uzunoglu', phone: null },
  { id: '6', name: 'Akram Khan', phone: null },
  { id: '7', name: 'Aleks Berk Ergene', phone: null },
  { id: '8', name: 'Ali Qutishat', phone: null },
  { id: '9', name: 'Alisher Seitzhaparov', phone: null },
  { id: '10', name: 'Alonso Peru', phone: null },
  { id: '11', name: 'Alperen Bakir', phone: null },
  { id: '12', name: 'Archimede Samoth', phone: null },
  { id: '13', name: 'Armi Armi', phone: null },
  { id: '14', name: 'Ashley Duran', phone: null },
  { id: '15', name: 'Atakan Avukat', phone: null },
  { id: '16', name: 'Azra Sipahi', phone: null },
  { id: '17', name: 'Badi Badi', phone: null },
  { id: '18', name: 'Baran Dogan', phone: null },
  { id: '19', name: 'Baran Hanci', phone: null },
  { id: '20', name: 'Berhan Karaceper', phone: null },
  { id: '21', name: 'Berkay Eyikocak', phone: null },
  { id: '22', name: 'Berkay Kocak', phone: null },
  { id: '23', name: 'Berke Kizilcan', phone: null },
  { id: '24', name: 'Berke Yilmaz', phone: null },
  { id: '25', name: 'Biruk Tesfaye Urga', phone: null },
  { id: '26', name: 'Boran Engul', phone: null },
  { id: '27', name: 'Bugra Kepuc', phone: null },
  { id: '28', name: 'Caleb Ghavami', phone: null },
  { id: '29', name: 'Can Tantekin', phone: null },
  { id: '30', name: 'Can Timur', phone: null },
  { id: '31', name: 'Caner Kaya', phone: null },
  { id: '32', name: 'Charles Ajoku', phone: null },
  { id: '33', name: 'Christiana Amadi', phone: null },
  { id: '34', name: 'Damon Thompson', phone: null },
  { id: '35', name: 'Dequan Spencer', phone: null },
  { id: '36', name: 'Ecem Yel', phone: null },
  { id: '37', name: 'Efran Ergelen', phone: null },
  { id: '38', name: 'Ekrem Emirhan Alptekin', phone: null },
  { id: '39', name: 'Elif Demirbas', phone: null },
  { id: '40', name: 'Elijah Afolabi', phone: null },
  { id: '41', name: 'Elochukwu Oforbuike', phone: null },
  { id: '42', name: 'Emil Mammadov', phone: null },
  { id: '43', name: 'Emirhan Donat', phone: null },
  { id: '44', name: 'Emrah Durmaz', phone: null },
  { id: '45', name: 'Emre Ari', phone: null },
  { id: '46', name: 'Enis Kiziltoprak', phone: null },
  { id: '47', name: 'Eren Kiziltoprak', phone: null },
  { id: '48', name: 'Eren Osmanli', phone: null },
  { id: '49', name: 'Ersad Alp', phone: null },
  { id: '50', name: 'Ersin Kayhan', phone: null },
  { id: '51', name: 'Esteban Mun', phone: null },
  { id: '52', name: 'Fagan Ismailov', phone: null },
  { id: '53', name: 'Fatih Yalcin', phone: null },
  { id: '54', name: 'Fatih Yilmaz', phone: null },
  { id: '55', name: 'Fatime Kassap', phone: null },
  { id: '56', name: 'Fehim Subasi', phone: null },
  { id: '57', name: 'Fengai Lebbie', phone: null },
  { id: '58', name: 'Ferdi Erocak', phone: null },
  { id: '59', name: 'Ferid Mammadov', phone: null },
  { id: '60', name: 'Furkan Dogan', phone: null },
  { id: '61', name: 'Gary Lyton', phone: null },
  { id: '62', name: 'Ghiyasiddin Mansory', phone: null },
  { id: '63', name: 'Giyaseddin Dayi', phone: null },
  { id: '64', name: 'Gurur Akosman', phone: null },
  { id: '65', name: 'Hamza Sahin', phone: null },
  { id: '66', name: 'Hasan Recebov', phone: null },
  { id: '67', name: 'Huseyin Eryilmaz', phone: null },
  { id: '68', name: 'Huseyin Orkmez', phone: null },
  { id: '69', name: 'Huseyin Yilmaz Kartal', phone: null },
  { id: '70', name: 'Idris Cin', phone: null },
  { id: '71', name: 'Ihtiyar Gurbanov', phone: null },
  { id: '72', name: 'Ilyas Valiyev', phone: null },
  { id: '73', name: 'Jaden Thompson', phone: null },
  { id: '74', name: 'Jose Alves de Andrade Neto', phone: null },
  { id: '75', name: 'Jose Beltrain', phone: null },
  { id: '76', name: 'Joy M Washington', phone: null },
  { id: '77', name: 'Joao Victor Signori Cervi', phone: null },
  { id: '78', name: 'Jr Sergio Sorto', phone: null },
  { id: '79', name: 'Kamran Ejaz', phone: null },
  { id: '80', name: 'Kamuran Kamuran', phone: null },
  { id: '81', name: 'Kerem Bakirkolu', phone: null },
  { id: '82', name: 'Kerem Colakkadioglu', phone: null },
  { id: '83', name: 'Koray', phone: null },
  { id: '84', name: 'Lucio Paiva', phone: null },
  { id: '85', name: 'Majdi Abdallah', phone: null },
  { id: '86', name: 'Marcus Nunes', phone: null },
  { id: '87', name: 'Marko Dimitrijevic', phone: null },
  { id: '88', name: 'Maya Maya', phone: null },
  { id: '89', name: 'Mehmet Kardemir', phone: null },
  { id: '90', name: 'Mehmet Sahin Yildirim', phone: null },
  { id: '91', name: 'Mehmet Cakir', phone: null },
  { id: '92', name: 'Mert Inan', phone: null },
  { id: '93', name: 'Muhammed Ilyas Malay', phone: null },
  { id: '94', name: 'Muhammed Serdar Yildiz', phone: null },
  { id: '95', name: 'Murad Najafov', phone: null },
  { id: '96', name: 'Murat Ata', phone: null },
  { id: '97', name: 'Naghi Aghayev', phone: null },
  { id: '98', name: 'Necip Donat', phone: null },
  { id: '99', name: 'Nevena Stevanovic', phone: null },
  { id: '100', name: 'Ngozi Elue', phone: null },
  { id: '101', name: 'Oguzhan Sahin Sahin', phone: null },
  { id: '102', name: 'Omer Ozcan', phone: null },
  { id: '103', name: 'Onur Eren Kaya', phone: null },
  { id: '104', name: 'Onur Uzonur', phone: null },
  { id: '105', name: 'Orkhan Musayev', phone: null },
  { id: '106', name: 'Ozgur Ozdemir', phone: null },
  { id: '107', name: 'Rauf Nebizade', phone: null },
  { id: '108', name: 'Rojhat Tolog', phone: null },
  { id: '109', name: 'Sabera', phone: null },
  { id: '110', name: 'Safak Ozturk', phone: null },
  { id: '111', name: 'Saltanat', phone: null },
  { id: '112', name: 'Sam Thompson', phone: null },
  { id: '113', name: 'Sayed Haamid Tore', phone: null },
  { id: '114', name: 'Serdar Bazarov', phone: null },
  { id: '115', name: 'Serkan Beder', phone: null },
  { id: '116', name: 'Sertan Qwert', phone: null },
  { id: '117', name: 'Seyda Basoglu', phone: null },
  { id: '118', name: 'Seyit Gumus', phone: null },
  { id: '119', name: 'Shannil Muhammed', phone: null },
  { id: '120', name: 'Simay Ercan', phone: null },
  { id: '121', name: 'Steve Lionel Essema Bekolo', phone: null },
  { id: '122', name: 'Timothee Djouokep Tchouamou', phone: null },
  { id: '123', name: 'Tofiq Nazarov', phone: null },
  { id: '124', name: 'Tuncay Karabak', phone: null },
  { id: '125', name: 'Ulas Can Serin', phone: null },
  { id: '126', name: 'Utku Aydogan', phone: null },
  { id: '127', name: 'Valberto Maia', phone: null },
  { id: '128', name: 'Vedat Dasdemir', phone: null },
  { id: '129', name: 'Vedat Ozdemir', phone: null },
  { id: '130', name: 'Victor Victor', phone: null },
  { id: '131', name: 'Yaprak Smith', phone: null },
  { id: '132', name: 'Yusuf Akguc', phone: null },
  { id: '133', name: 'Zita Amadi', phone: null },
]

// GET - Tüm sürücüleri listele (hardcoded + custom drivers from Redis)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')?.toLowerCase()

    // Hardcoded sürücü listesi
    const hardcodedDrivers = DRIVERS.map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone || null,
      isActive: true,
      isCustom: false
    }))

    // Redis'ten custom sürücüleri al
    const customDrivers = await getCustomDrivers()
    const formattedCustomDrivers = customDrivers.map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone || null,
      isActive: true,
      isCustom: true
    }))

    // Birleştir ve alfabetik sırala
    let allDrivers = [...hardcodedDrivers, ...formattedCustomDrivers]
    allDrivers.sort((a, b) => a.name.localeCompare(b.name, 'tr'))

    // Arama filtresi
    if (search) {
      allDrivers = allDrivers.filter(d =>
        d.name.toLowerCase().includes(search)
      )
    }

    return NextResponse.json(allDrivers)
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json(
      { error: 'Surucular yuklenirken hata olustu' },
      { status: 500 }
    )
  }
}

// POST - Yeni sürücü ekle (Redis'e kalıcı kaydet)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Sürücü adı gerekli' },
        { status: 400 }
      )
    }

    // Hardcoded listede var mı kontrol et
    const existsInHardcoded = DRIVERS.some(
      d => d.name.toLowerCase() === body.name.toLowerCase().trim()
    )
    if (existsInHardcoded) {
      return NextResponse.json(
        { error: 'Bu sürücü zaten listede mevcut' },
        { status: 409 }
      )
    }

    // Redis'e ekle
    const newDriver = await addCustomDriver(body.name.trim(), body.phone)

    if (!newDriver) {
      return NextResponse.json(
        { error: 'Sürücü zaten mevcut veya eklenemedi' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      id: newDriver.id,
      name: newDriver.name,
      phone: newDriver.phone,
      isActive: true,
      isCustom: true
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating driver:', error)
    return NextResponse.json(
      { error: 'Surucu eklenirken hata olustu' },
      { status: 500 }
    )
  }
}
