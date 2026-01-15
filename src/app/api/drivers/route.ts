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
  { id: '15', name: 'Atakan Bayrak', phone: null },
  { id: '16', name: 'Austin Kuhn', phone: null },
  { id: '17', name: 'Barlas Ersagun', phone: null },
  { id: '18', name: 'Berkant Senturk', phone: null },
  { id: '19', name: 'Bilal Hazer', phone: null },
  { id: '20', name: 'Bilgehan Ates', phone: null },
  { id: '21', name: 'Billy M', phone: null },
  { id: '22', name: 'Bob Katz', phone: null },
  { id: '23', name: 'Burak Cevik', phone: null },
  { id: '24', name: 'Burak Demirer', phone: null },
  { id: '25', name: 'Burhan Saral', phone: null },
  { id: '26', name: 'Cagdas Akin', phone: null },
  { id: '27', name: 'Cem Kahraman', phone: null },
  { id: '28', name: 'Cem Yucedogru', phone: null },
  { id: '29', name: 'Chad Henderson', phone: null },
  { id: '30', name: 'Chris Kramer', phone: null },
  { id: '31', name: 'Clint Redd', phone: null },
  { id: '32', name: 'Daniel Fajardo', phone: null },
  { id: '33', name: 'Dante Weston', phone: null },
  { id: '34', name: 'Dimitry Yagudin', phone: null },
  { id: '35', name: 'Dogan Toprak', phone: null },
  { id: '36', name: 'Ediz Dogru', phone: null },
  { id: '37', name: 'Efe Alparslan', phone: null },
  { id: '38', name: 'Elias Ajeeb', phone: null },
  { id: '39', name: 'Emrah Karaca', phone: null },
  { id: '40', name: 'Emre Altun', phone: null },
  { id: '41', name: 'Emre Seker', phone: null },
  { id: '42', name: 'Emrullah Ozer', phone: null },
  { id: '43', name: 'Engin Ceylan', phone: null },
  { id: '44', name: 'Eray Bagdatli', phone: null },
  { id: '45', name: 'Erdal Kaya', phone: null },
  { id: '46', name: 'Eren Osmanli', phone: null },
  { id: '47', name: 'Erhan Sevim', phone: null },
  { id: '48', name: 'Erkan Kacar', phone: null },
  { id: '49', name: 'Ertugrul Doganci', phone: null },
  { id: '50', name: 'Farooq Ahmed', phone: null },
  { id: '51', name: 'Faruk Emre', phone: null },
  { id: '52', name: 'Fikri Kemal', phone: null },
  { id: '53', name: 'Gazi Ozgur', phone: null },
  { id: '54', name: 'Gokhan Aygun', phone: null },
  { id: '55', name: 'Goknur Sahin', phone: null },
  { id: '56', name: 'Haluk Demircan', phone: null },
  { id: '57', name: 'Hamza Ahmed', phone: null },
  { id: '58', name: 'Hamza Sert', phone: null },
  { id: '59', name: 'Hasan Ali', phone: null },
  { id: '60', name: 'Hasan Gur', phone: null },
  { id: '61', name: 'Hasan Keles', phone: null },
  { id: '62', name: 'Hikmet Ozdogan', phone: null },
  { id: '63', name: 'Huseyin Bilgili', phone: null },
  { id: '64', name: 'Ibrahim Aktas', phone: null },
  { id: '65', name: 'Ilker Aydin', phone: null },
  { id: '66', name: 'Ismail Demir', phone: null },
  { id: '67', name: 'Ismail Ozturk', phone: null },
  { id: '68', name: 'Jefrey Gomez', phone: null },
  { id: '69', name: 'Jorge Colmenero', phone: null },
  { id: '70', name: 'Justin Behnke', phone: null },
  { id: '71', name: 'Kadir Polat', phone: null },
  { id: '72', name: 'Kamil Yilmaz', phone: null },
  { id: '73', name: 'Kemal Aslan', phone: null },
  { id: '74', name: 'Kerem Ozcan', phone: null },
  { id: '75', name: 'Kevin Martinez', phone: null },
  { id: '76', name: 'Kutay Kartal', phone: null },
  { id: '77', name: 'Luis Torres', phone: null },
  { id: '78', name: 'Mark Wagner', phone: null },
  { id: '79', name: 'Mehmet Ali', phone: null },
  { id: '80', name: 'Mehmet Kaya', phone: null },
  { id: '81', name: 'Mehmet Onur', phone: null },
  { id: '82', name: 'Mert Aydin', phone: null },
  { id: '83', name: 'Mesut Koc', phone: null },
  { id: '84', name: 'Michael Williams', phone: null },
  { id: '85', name: 'Muhammad Atif', phone: null },
  { id: '86', name: 'Muharrem Yavuz', phone: null },
  { id: '87', name: 'Murat Celik', phone: null },
  { id: '88', name: 'Murat Yildirim', phone: null },
  { id: '89', name: 'Mustafa Arslan', phone: null },
  { id: '90', name: 'Mustafa Can', phone: null },
  { id: '91', name: 'Nasser Farooq', phone: null },
  { id: '92', name: 'Neslihan Demir', phone: null },
  { id: '93', name: 'Ogulcan Aygun', phone: null },
  { id: '94', name: 'Okan Yilmaz', phone: null },
  { id: '95', name: 'Omar Hassan', phone: null },
  { id: '96', name: 'Omer Aslan', phone: null },
  { id: '97', name: 'Omer Yildiz', phone: null },
  { id: '98', name: 'Onur Bektas', phone: null },
  { id: '99', name: 'Oscar Lopez', phone: null },
  { id: '100', name: 'Osman Celik', phone: null },
  { id: '101', name: 'Ozan Arslan', phone: null },
  { id: '102', name: 'Ozcan Dogan', phone: null },
  { id: '103', name: 'Ozgur Akbas', phone: null },
  { id: '104', name: 'Pablo Garcia', phone: null },
  { id: '105', name: 'Patrick Brown', phone: null },
  { id: '106', name: 'Raul Hernandez', phone: null },
  { id: '107', name: 'Recep Demir', phone: null },
  { id: '108', name: 'Rehan Malik', phone: null },
  { id: '109', name: 'Ricardo Silva', phone: null },
  { id: '110', name: 'Robert Davis', phone: null },
  { id: '111', name: 'Ryan Thompson', phone: null },
  { id: '112', name: 'Sahin Yilmaz', phone: null },
  { id: '113', name: 'Salih Kaya', phone: null },
  { id: '114', name: 'Samuel Johnson', phone: null },
  { id: '115', name: 'Sarp Turan', phone: null },
  { id: '116', name: 'Seckin Ozdemir', phone: null },
  { id: '117', name: 'Selim Yildirim', phone: null },
  { id: '118', name: 'Semir Yavuz', phone: null },
  { id: '119', name: 'Serdar Kilic', phone: null },
  { id: '120', name: 'Serdar Ozturk', phone: null },
  { id: '121', name: 'Serkan Aydin', phone: null },
  { id: '122', name: 'Sertan Qwert', phone: null },
  { id: '123', name: 'Seyit Ahmet', phone: null },
  { id: '124', name: 'Sinan Koc', phone: null },
  { id: '125', name: 'Talha Erdogan', phone: null },
  { id: '126', name: 'Tarik Celik', phone: null },
  { id: '127', name: 'Tayyip Ozkaya', phone: null },
  { id: '128', name: 'Tolgahan Yilmaz', phone: null },
  { id: '129', name: 'Tuncay Arslan', phone: null },
  { id: '130', name: 'Turan Demir', phone: null },
  { id: '131', name: 'Ugur Sahin', phone: null },
  { id: '132', name: 'Umut Cetin', phone: null },
  { id: '133', name: 'Umut Kaplan', phone: null },
  { id: '134', name: 'Veli Arslan', phone: null },
  { id: '135', name: 'Victor Morales', phone: null },
  { id: '136', name: 'Vincent Taylor', phone: null },
  { id: '137', name: 'Yakup Demir', phone: null },
  { id: '138', name: 'Yavuz Kaya', phone: null },
  { id: '139', name: 'Yigit Ozturk', phone: null },
  { id: '140', name: 'Yunus Emre', phone: null },
  { id: '141', name: 'Yusuf Kaya', phone: null },
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
