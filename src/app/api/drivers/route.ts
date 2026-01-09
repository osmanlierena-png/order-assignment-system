import { NextRequest, NextResponse } from 'next/server'

// Hardcoded sürücü listesi (Base44'ten alındı)
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
  { id: '15', name: 'Azra Sipahi', phone: null },
  { id: '16', name: 'Badi Badi', phone: null },
  { id: '17', name: 'Baran Dogan', phone: null },
  { id: '18', name: 'Baran Hanci', phone: null },
  { id: '19', name: 'Berhan Karaceper', phone: null },
  { id: '20', name: 'Berkay Eyikocak', phone: null },
  { id: '21', name: 'Berke Kizilcan', phone: null },
  { id: '22', name: 'Berke Yilmaz', phone: null },
  { id: '23', name: 'Biruk Tesfaye Urga', phone: null },
  { id: '24', name: 'Boran Engul', phone: null },
  { id: '25', name: 'Bugra Kepuc', phone: null },
  { id: '26', name: 'Caleb Ghavami', phone: null },
  { id: '27', name: 'Can Tantekin', phone: null },
  { id: '28', name: 'Can Timur', phone: null },
  { id: '29', name: 'Caner Kaya', phone: null },
  { id: '30', name: 'Charles Ajoku', phone: null },
  { id: '31', name: 'Christiana Amadi', phone: null },
  { id: '32', name: 'Damon Thompson', phone: null },
  { id: '33', name: 'Dequan Spencer', phone: null },
  { id: '34', name: 'Ecem Yel', phone: null },
  { id: '35', name: 'Efran Ergelen', phone: null },
  { id: '36', name: 'Ekrem Emirhan Alptekin', phone: null },
  { id: '37', name: 'Elif Demirbas', phone: null },
  { id: '38', name: 'Elijah Afolabi', phone: null },
  { id: '39', name: 'Elochukwu Oforbuike', phone: null },
  { id: '40', name: 'Emil Mammadov', phone: null },
  { id: '41', name: 'Emirhan Donat', phone: null },
  { id: '42', name: 'Emrah Durmaz', phone: null },
  { id: '43', name: 'Emre Ari', phone: null },
  { id: '44', name: 'Enis Kiziltoprak', phone: null },
  { id: '45', name: 'Eren Eren', phone: null },
  { id: '46', name: 'Eren Kiziltoprak', phone: null },
  { id: '47', name: 'Ersad Alp', phone: null },
  { id: '48', name: 'Ersin Kayhan', phone: null },
  { id: '49', name: 'Esteban Mun', phone: null },
  { id: '50', name: 'Fagan Ismailov', phone: null },
  { id: '51', name: 'Fatih Yalcin', phone: null },
  { id: '52', name: 'Fatih Yilmaz', phone: null },
  { id: '53', name: 'Fatime Kassap', phone: null },
  { id: '54', name: 'Fehim Subasi', phone: null },
  { id: '55', name: 'Fengai Lebbie', phone: null },
  { id: '56', name: 'Ferdi Erocak', phone: null },
  { id: '57', name: 'Ferid Mammadov', phone: null },
  { id: '58', name: 'Gary Lyton', phone: null },
  { id: '59', name: 'Ghiyasiddin Mansory', phone: null },
  { id: '60', name: 'Giyaseddin Dayi', phone: null },
  { id: '61', name: 'Gurur Akosman', phone: null },
  { id: '62', name: 'Hasan Recebov', phone: null },
  { id: '63', name: 'Huseyin Eryilmaz', phone: null },
  { id: '64', name: 'Huseyin Orkmez', phone: null },
  { id: '65', name: 'Huseyin Yilmaz Kartal', phone: null },
  { id: '66', name: 'Idris Cin', phone: null },
  { id: '67', name: 'Ihtiyar Gurbanov', phone: null },
  { id: '68', name: 'Ilyas Valiyev', phone: null },
  { id: '69', name: 'Jaden Thompson', phone: null },
  { id: '70', name: 'Jose Beltrain', phone: null },
  { id: '71', name: 'Joy M Washington', phone: null },
  { id: '72', name: 'João Victor Signori Cervi', phone: null },
  { id: '73', name: 'Jr Sergio Sorto', phone: null },
  { id: '74', name: 'Kamran Ejaz', phone: null },
  { id: '75', name: 'Kamuran Kamuran', phone: null },
  { id: '76', name: 'Kerem Bakirkolu', phone: null },
  { id: '77', name: 'Kerem Colakkadioglu', phone: null },
  { id: '78', name: 'Lucio Paiva', phone: null },
  { id: '79', name: 'Majdi Abdallah', phone: null },
  { id: '80', name: 'Marcus Nunes', phone: null },
  { id: '81', name: 'Marko Dimitrijevic', phone: null },
  { id: '82', name: 'Maya Maya', phone: null },
  { id: '83', name: 'Mehmet Kardemir', phone: null },
  { id: '84', name: 'Mehmet Sahin Yildirim', phone: null },
  { id: '85', name: 'Mehmet Cakir', phone: null },
  { id: '86', name: 'Mert Inan', phone: null },
  { id: '87', name: 'Muhammed Serdar Yildiz', phone: null },
  { id: '88', name: 'Murad Najafov', phone: null },
  { id: '89', name: 'Naghi Aghayev', phone: null },
  { id: '90', name: 'Necip Donat', phone: null },
  { id: '91', name: 'Ngozi Elue', phone: null },
  { id: '92', name: 'Oguzhan Sahin Sahin', phone: null },
  { id: '93', name: 'Omer Ozcan', phone: null },
  { id: '94', name: 'Onur Eren Kaya', phone: null },
  { id: '95', name: 'Onur Uzonur', phone: null },
  { id: '96', name: 'Orkhan Musayev', phone: null },
  { id: '97', name: 'Ozgur Ozdemir', phone: null },
  { id: '98', name: 'Rauf Nebizade', phone: null },
  { id: '99', name: 'Rojhat Tolog', phone: null },
  { id: '100', name: 'Safak Dilmen', phone: null },
  { id: '101', name: 'Saltanat', phone: null },
  { id: '102', name: 'Sam Thompson', phone: null },
  { id: '103', name: 'Sayed Haamid Tore', phone: null },
  { id: '104', name: 'Serdar Bazarov', phone: null },
  { id: '105', name: 'Serkan Beder', phone: null },
  { id: '106', name: 'Sertan Qwert', phone: null },
  { id: '107', name: 'Seyda Basoglu', phone: null },
  { id: '108', name: 'Seyit Gumus', phone: null },
  { id: '109', name: 'Shannil Muhammed', phone: null },
  { id: '110', name: 'Simay Ercan', phone: null },
  { id: '111', name: 'Steve Lionel Essema Bekolo', phone: null },
  { id: '112', name: 'Timothee Djouokep Tchouamou', phone: null },
  { id: '113', name: 'Tofiq Nazarov', phone: null },
  { id: '114', name: 'Tuncay Karabak', phone: null },
  { id: '115', name: 'Ulas Can Serin', phone: null },
  { id: '116', name: 'Utku Aydogan', phone: null },
  { id: '117', name: 'Valberto Maia', phone: null },
  { id: '118', name: 'Vedat Dasdemir', phone: null },
  { id: '119', name: 'Vedat Ozdemir', phone: null },
  { id: '120', name: 'Victor Victor', phone: null },
  { id: '121', name: 'Yaprak Smith', phone: null },
  { id: '122', name: 'Yusuf Akguc', phone: null },
  { id: '123', name: 'Zita Amadi', phone: null },
  { id: '124', name: 'Berkay Kocak', phone: null },
  { id: '125', name: 'Hamza Sahin', phone: null },
  { id: '126', name: 'Koray', phone: null },
  { id: '127', name: 'Murat Ata', phone: null },
  { id: '128', name: 'Sabera', phone: null },
  { id: '129', name: 'Muhammet Ilyas Malay', phone: null },
]

// GET - Tüm sürücüleri listele
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')?.toLowerCase()

    // Hardcoded sürücü listesini kullan
    let drivers = [...DRIVERS]

    // Arama filtresi
    if (search) {
      drivers = drivers.filter(d =>
        d.name.toLowerCase().includes(search)
      )
    }

    // Canvas için format
    const formattedDrivers = drivers.map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone || null,
      isActive: true
    }))

    return NextResponse.json(formattedDrivers)
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json(
      { error: 'Surucular yuklenirken hata olustu' },
      { status: 500 }
    )
  }
}

// POST - Yeni sürücü ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const driver = {
      id: Date.now().toString(),
      name: body.name,
      phone: body.phone || null,
      isActive: true,
    }

    return NextResponse.json(driver, { status: 201 })
  } catch (error) {
    console.error('Error creating driver:', error)
    return NextResponse.json(
      { error: 'Surucu eklenirken hata olustu' },
      { status: 500 }
    )
  }
}
