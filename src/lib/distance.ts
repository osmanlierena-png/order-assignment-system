/**
 * DC Metro Bölgesi ZIP Koordinatları ve Mesafe Hesaplama
 *
 * Bu modül ZIP kodları arasındaki mesafeyi hesaplar ve
 * birleştirme algoritmasında kullanılır.
 */

// ZIP koordinat tipi
interface ZipCoordinate {
  lat: number
  lng: number
  name: string
  region: 'DC' | 'MD-DC' | 'MD-BAL' | 'NoVA' | 'VA-S' | 'FAR'
}

// DC Metro bölgesi ZIP koordinatları (~100+ ZIP)
export const ZIP_COORDINATES: Record<string, ZipCoordinate> = {
  // ==========================================
  // WASHINGTON DC (200xx - 205xx)
  // ==========================================
  '20001': { lat: 38.9108, lng: -77.0167, name: 'DC - Shaw', region: 'DC' },
  '20002': { lat: 38.9052, lng: -76.9824, name: 'DC - Trinidad', region: 'DC' },
  '20003': { lat: 38.8848, lng: -76.9959, name: 'DC - Capitol Hill', region: 'DC' },
  '20004': { lat: 38.8951, lng: -77.0285, name: 'DC - Penn Quarter', region: 'DC' },
  '20005': { lat: 38.9028, lng: -77.0318, name: 'DC - Downtown', region: 'DC' },
  '20006': { lat: 38.8995, lng: -77.0430, name: 'DC - Foggy Bottom', region: 'DC' },
  '20007': { lat: 38.9126, lng: -77.0712, name: 'DC - Georgetown', region: 'DC' },
  '20008': { lat: 38.9360, lng: -77.0590, name: 'DC - Cleveland Park', region: 'DC' },
  '20009': { lat: 38.9195, lng: -77.0373, name: 'DC - Adams Morgan', region: 'DC' },
  '20010': { lat: 38.9327, lng: -77.0315, name: 'DC - Columbia Heights', region: 'DC' },
  '20011': { lat: 38.9519, lng: -77.0221, name: 'DC - Petworth', region: 'DC' },
  '20012': { lat: 38.9762, lng: -77.0302, name: 'DC - Takoma', region: 'DC' },
  '20015': { lat: 38.9660, lng: -77.0620, name: 'DC - Chevy Chase', region: 'DC' },
  '20016': { lat: 38.9375, lng: -77.0860, name: 'DC - Tenleytown', region: 'DC' },
  '20017': { lat: 38.9375, lng: -76.9960, name: 'DC - Brookland', region: 'DC' },
  '20018': { lat: 38.9290, lng: -76.9750, name: 'DC - Woodridge', region: 'DC' },
  '20019': { lat: 38.8910, lng: -76.9380, name: 'DC - Deanwood', region: 'DC' },
  '20020': { lat: 38.8610, lng: -76.9710, name: 'DC - Anacostia', region: 'DC' },
  '20024': { lat: 38.8780, lng: -77.0130, name: 'DC - SW Waterfront', region: 'DC' },
  '20032': { lat: 38.8340, lng: -76.9990, name: 'DC - Congress Heights', region: 'DC' },
  '20036': { lat: 38.9070, lng: -77.0400, name: 'DC - Dupont Circle', region: 'DC' },
  '20037': { lat: 38.9010, lng: -77.0510, name: 'DC - West End', region: 'DC' },
  '20052': { lat: 38.9000, lng: -77.0480, name: 'DC - GWU', region: 'DC' },
  '20057': { lat: 38.9080, lng: -77.0720, name: 'DC - Georgetown Univ', region: 'DC' },
  '20064': { lat: 38.9340, lng: -76.9930, name: 'DC - CUA', region: 'DC' },
  '20515': { lat: 38.8899, lng: -77.0091, name: 'DC - Capitol', region: 'DC' },

  // ==========================================
  // MARYLAND - DC YAKINI (206xx - 209xx)
  // ==========================================
  '20601': { lat: 38.6470, lng: -76.9060, name: 'MD - Waldorf', region: 'MD-DC' },
  '20602': { lat: 38.6310, lng: -76.9240, name: 'MD - Waldorf', region: 'MD-DC' },
  '20603': { lat: 38.5990, lng: -76.9490, name: 'MD - Waldorf', region: 'MD-DC' },
  '20705': { lat: 39.0240, lng: -76.9360, name: 'MD - Beltsville', region: 'MD-DC' },
  '20706': { lat: 38.9650, lng: -76.8810, name: 'MD - Lanham', region: 'MD-DC' },
  '20707': { lat: 39.0930, lng: -76.8730, name: 'MD - Laurel', region: 'MD-DC' },
  '20708': { lat: 39.0710, lng: -76.8450, name: 'MD - Laurel', region: 'MD-DC' },
  '20710': { lat: 38.9430, lng: -76.9280, name: 'MD - Bladensburg', region: 'MD-DC' },
  '20712': { lat: 38.9460, lng: -76.9640, name: 'MD - Mount Rainier', region: 'MD-DC' },
  '20715': { lat: 38.9910, lng: -76.7530, name: 'MD - Bowie', region: 'MD-DC' },
  '20716': { lat: 38.9520, lng: -76.7420, name: 'MD - Bowie', region: 'MD-DC' },
  '20720': { lat: 38.9780, lng: -76.8060, name: 'MD - Bowie', region: 'MD-DC' },
  '20721': { lat: 38.9210, lng: -76.7950, name: 'MD - Bowie', region: 'MD-DC' },
  '20722': { lat: 38.9390, lng: -76.9550, name: 'MD - Colmar Manor', region: 'MD-DC' },
  '20737': { lat: 38.9630, lng: -76.9130, name: 'MD - Riverdale', region: 'MD-DC' },
  '20740': { lat: 38.9940, lng: -76.9450, name: 'MD - College Park', region: 'MD-DC' },
  '20742': { lat: 38.9860, lng: -76.9430, name: 'MD - College Park UMD', region: 'MD-DC' },
  '20743': { lat: 38.8960, lng: -76.9010, name: 'MD - Capitol Heights', region: 'MD-DC' },
  '20744': { lat: 38.7650, lng: -76.9840, name: 'MD - Fort Washington', region: 'MD-DC' },
  '20745': { lat: 38.8180, lng: -76.9970, name: 'MD - Oxon Hill', region: 'MD-DC' },
  '20746': { lat: 38.8410, lng: -76.9200, name: 'MD - Suitland', region: 'MD-DC' },
  '20747': { lat: 38.8540, lng: -76.8870, name: 'MD - District Heights', region: 'MD-DC' },
  '20748': { lat: 38.8120, lng: -76.9370, name: 'MD - Temple Hills', region: 'MD-DC' },
  '20770': { lat: 38.9830, lng: -76.8800, name: 'MD - Greenbelt', region: 'MD-DC' },
  '20774': { lat: 38.8670, lng: -76.8200, name: 'MD - Upper Marlboro', region: 'MD-DC' },
  '20781': { lat: 38.9470, lng: -76.9410, name: 'MD - Hyattsville', region: 'MD-DC' },
  '20782': { lat: 38.9630, lng: -76.9700, name: 'MD - Hyattsville', region: 'MD-DC' },
  '20783': { lat: 38.9910, lng: -76.9800, name: 'MD - Adelphi', region: 'MD-DC' },
  '20784': { lat: 38.9550, lng: -76.8820, name: 'MD - Landover', region: 'MD-DC' },
  '20785': { lat: 38.9220, lng: -76.8760, name: 'MD - Cheverly', region: 'MD-DC' },

  // Montgomery County (208xx - 209xx)
  '20812': { lat: 38.9680, lng: -77.1440, name: 'MD - Glen Echo', region: 'MD-DC' },
  '20814': { lat: 38.9890, lng: -77.0970, name: 'MD - Bethesda', region: 'MD-DC' },
  '20815': { lat: 38.9830, lng: -77.0780, name: 'MD - Chevy Chase', region: 'MD-DC' },
  '20816': { lat: 38.9560, lng: -77.1110, name: 'MD - Bethesda', region: 'MD-DC' },
  '20817': { lat: 38.9740, lng: -77.1430, name: 'MD - Bethesda', region: 'MD-DC' },
  '20850': { lat: 39.0840, lng: -77.1528, name: 'MD - Rockville', region: 'MD-DC' },
  '20851': { lat: 39.0770, lng: -77.1230, name: 'MD - Rockville', region: 'MD-DC' },
  '20852': { lat: 39.0510, lng: -77.1190, name: 'MD - Rockville', region: 'MD-DC' },
  '20853': { lat: 39.1070, lng: -77.0850, name: 'MD - Rockville', region: 'MD-DC' },
  '20854': { lat: 39.0330, lng: -77.1970, name: 'MD - Potomac', region: 'MD-DC' },
  '20855': { lat: 39.1430, lng: -77.1350, name: 'MD - Derwood', region: 'MD-DC' },
  '20860': { lat: 39.1540, lng: -77.0130, name: 'MD - Sandy Spring', region: 'MD-DC' },
  '20866': { lat: 39.1070, lng: -76.9380, name: 'MD - Burtonsville', region: 'MD-DC' },
  '20871': { lat: 39.1880, lng: -77.1990, name: 'MD - Clarksburg', region: 'MD-DC' },
  '20874': { lat: 39.1380, lng: -77.1830, name: 'MD - Germantown', region: 'MD-DC' },
  '20876': { lat: 39.1770, lng: -77.1590, name: 'MD - Germantown', region: 'MD-DC' },
  '20877': { lat: 39.1470, lng: -77.2090, name: 'MD - Gaithersburg', region: 'MD-DC' },
  '20878': { lat: 39.1130, lng: -77.2160, name: 'MD - Gaithersburg', region: 'MD-DC' },
  '20879': { lat: 39.1600, lng: -77.1800, name: 'MD - Gaithersburg', region: 'MD-DC' },
  '20886': { lat: 39.1740, lng: -77.1340, name: 'MD - Montgomery Village', region: 'MD-DC' },
  '20895': { lat: 39.0270, lng: -77.0390, name: 'MD - Kensington', region: 'MD-DC' },
  '20901': { lat: 39.0110, lng: -77.0050, name: 'MD - Silver Spring', region: 'MD-DC' },
  '20902': { lat: 39.0370, lng: -77.0170, name: 'MD - Silver Spring', region: 'MD-DC' },
  '20903': { lat: 39.0170, lng: -76.9740, name: 'MD - Silver Spring', region: 'MD-DC' },
  '20904': { lat: 39.0660, lng: -76.9830, name: 'MD - Silver Spring', region: 'MD-DC' },
  '20905': { lat: 39.1090, lng: -76.9900, name: 'MD - Silver Spring', region: 'MD-DC' },
  '20906': { lat: 39.0830, lng: -77.0480, name: 'MD - Silver Spring', region: 'MD-DC' },
  '20910': { lat: 38.9960, lng: -77.0290, name: 'MD - Silver Spring', region: 'MD-DC' },
  '20912': { lat: 38.9810, lng: -77.0020, name: 'MD - Takoma Park', region: 'MD-DC' },

  // ==========================================
  // MARYLAND - BALTIMORE YAKINI (210xx - 219xx)
  // ==========================================
  '21001': { lat: 39.5090, lng: -76.1940, name: 'MD - Aberdeen', region: 'MD-BAL' },
  '21012': { lat: 39.0490, lng: -76.4940, name: 'MD - Arnold', region: 'MD-BAL' },
  '21030': { lat: 39.4970, lng: -76.6600, name: 'MD - Cockeysville', region: 'MD-BAL' },
  '21042': { lat: 39.2680, lng: -76.8630, name: 'MD - Ellicott City', region: 'MD-BAL' },
  '21043': { lat: 39.2460, lng: -76.8100, name: 'MD - Ellicott City', region: 'MD-BAL' },
  '21044': { lat: 39.2120, lng: -76.8830, name: 'MD - Columbia', region: 'MD-BAL' },
  '21045': { lat: 39.1780, lng: -76.8370, name: 'MD - Columbia', region: 'MD-BAL' },
  '21046': { lat: 39.1670, lng: -76.8600, name: 'MD - Columbia', region: 'MD-BAL' },
  '21093': { lat: 39.4340, lng: -76.6480, name: 'MD - Lutherville Timonium', region: 'MD-BAL' },
  '21117': { lat: 39.4130, lng: -76.7790, name: 'MD - Owings Mills', region: 'MD-BAL' },
  '21201': { lat: 39.2920, lng: -76.6210, name: 'MD - Baltimore Downtown', region: 'MD-BAL' },
  '21202': { lat: 39.2900, lng: -76.6050, name: 'MD - Baltimore Inner Harbor', region: 'MD-BAL' },
  '21204': { lat: 39.4030, lng: -76.6150, name: 'MD - Towson', region: 'MD-BAL' },
  '21205': { lat: 39.3030, lng: -76.5640, name: 'MD - Baltimore East', region: 'MD-BAL' },
  '21206': { lat: 39.3390, lng: -76.5480, name: 'MD - Baltimore NE', region: 'MD-BAL' },
  '21207': { lat: 39.3270, lng: -76.7190, name: 'MD - Gwynn Oak', region: 'MD-BAL' },
  '21208': { lat: 39.3810, lng: -76.7110, name: 'MD - Pikesville', region: 'MD-BAL' },
  '21209': { lat: 39.3640, lng: -76.6640, name: 'MD - Mt Washington', region: 'MD-BAL' },
  '21210': { lat: 39.3500, lng: -76.6340, name: 'MD - Roland Park', region: 'MD-BAL' },
  '21211': { lat: 39.3280, lng: -76.6350, name: 'MD - Hampden', region: 'MD-BAL' },
  '21212': { lat: 39.3730, lng: -76.6110, name: 'MD - Govans', region: 'MD-BAL' },
  '21213': { lat: 39.3130, lng: -76.5870, name: 'MD - Clifton Park', region: 'MD-BAL' },
  '21214': { lat: 39.3520, lng: -76.5670, name: 'MD - Hamilton', region: 'MD-BAL' },
  '21215': { lat: 39.3470, lng: -76.6800, name: 'MD - Park Heights', region: 'MD-BAL' },
  '21216': { lat: 39.3110, lng: -76.6710, name: 'MD - Mondawmin', region: 'MD-BAL' },
  '21217': { lat: 39.3070, lng: -76.6420, name: 'MD - Bolton Hill', region: 'MD-BAL' },
  '21218': { lat: 39.3280, lng: -76.6100, name: 'MD - Charles Village', region: 'MD-BAL' },
  '21220': { lat: 39.3420, lng: -76.4650, name: 'MD - Middle River', region: 'MD-BAL' },
  '21221': { lat: 39.2870, lng: -76.4640, name: 'MD - Essex', region: 'MD-BAL' },
  '21222': { lat: 39.2530, lng: -76.4900, name: 'MD - Dundalk', region: 'MD-BAL' },
  '21224': { lat: 39.2780, lng: -76.5370, name: 'MD - Highlandtown', region: 'MD-BAL' },
  '21225': { lat: 39.2280, lng: -76.6110, name: 'MD - Brooklyn', region: 'MD-BAL' },
  '21227': { lat: 39.2240, lng: -76.6920, name: 'MD - Halethorpe', region: 'MD-BAL' },
  '21228': { lat: 39.2770, lng: -76.7470, name: 'MD - Catonsville', region: 'MD-BAL' },
  '21229': { lat: 39.2840, lng: -76.6850, name: 'MD - Irvington', region: 'MD-BAL' },
  '21230': { lat: 39.2650, lng: -76.6280, name: 'MD - Federal Hill', region: 'MD-BAL' },
  '21231': { lat: 39.2820, lng: -76.5850, name: 'MD - Fells Point', region: 'MD-BAL' },
  '21234': { lat: 39.3970, lng: -76.5330, name: 'MD - Parkville', region: 'MD-BAL' },
  '21236': { lat: 39.3710, lng: -76.4700, name: 'MD - Nottingham', region: 'MD-BAL' },
  '21237': { lat: 39.3330, lng: -76.5070, name: 'MD - Rosedale', region: 'MD-BAL' },
  '21239': { lat: 39.3640, lng: -76.5870, name: 'MD - Northwood', region: 'MD-BAL' },
  '21244': { lat: 39.3260, lng: -76.7770, name: 'MD - Windsor Mill', region: 'MD-BAL' },

  // ==========================================
  // NORTHERN VIRGINIA (220xx - 223xx)
  // ==========================================
  '22003': { lat: 38.8310, lng: -77.2140, name: 'VA - Annandale', region: 'NoVA' },
  '22015': { lat: 38.7930, lng: -77.2760, name: 'VA - Burke', region: 'NoVA' },
  '22025': { lat: 38.5670, lng: -77.3280, name: 'VA - Dumfries', region: 'NoVA' },
  '22026': { lat: 38.5970, lng: -77.3470, name: 'VA - Dumfries', region: 'NoVA' },
  '22030': { lat: 38.8530, lng: -77.3070, name: 'VA - Fairfax', region: 'NoVA' },
  '22031': { lat: 38.8640, lng: -77.2560, name: 'VA - Fairfax', region: 'NoVA' },
  '22032': { lat: 38.8220, lng: -77.2880, name: 'VA - Fairfax', region: 'NoVA' },
  '22033': { lat: 38.8700, lng: -77.3870, name: 'VA - Fair Oaks', region: 'NoVA' },
  '22041': { lat: 38.8510, lng: -77.1490, name: 'VA - Falls Church', region: 'NoVA' },
  '22042': { lat: 38.8700, lng: -77.1900, name: 'VA - Falls Church', region: 'NoVA' },
  '22043': { lat: 38.9000, lng: -77.1870, name: 'VA - Falls Church', region: 'NoVA' },
  '22044': { lat: 38.8580, lng: -77.1550, name: 'VA - Falls Church', region: 'NoVA' },
  '22046': { lat: 38.8820, lng: -77.1710, name: 'VA - Falls Church', region: 'NoVA' },
  '22060': { lat: 38.7200, lng: -77.1530, name: 'VA - Fort Belvoir', region: 'NoVA' },
  '22066': { lat: 39.0270, lng: -77.2210, name: 'VA - Great Falls', region: 'NoVA' },
  '22079': { lat: 38.6910, lng: -77.2130, name: 'VA - Lorton', region: 'NoVA' },
  '22101': { lat: 38.9410, lng: -77.1860, name: 'VA - McLean', region: 'NoVA' },
  '22102': { lat: 38.9560, lng: -77.2280, name: 'VA - McLean', region: 'NoVA' },
  '22124': { lat: 38.8800, lng: -77.3310, name: 'VA - Oakton', region: 'NoVA' },
  '22150': { lat: 38.7710, lng: -77.1870, name: 'VA - Springfield', region: 'NoVA' },
  '22151': { lat: 38.8060, lng: -77.2070, name: 'VA - Springfield', region: 'NoVA' },
  '22152': { lat: 38.7740, lng: -77.2260, name: 'VA - Springfield', region: 'NoVA' },
  '22153': { lat: 38.7480, lng: -77.2260, name: 'VA - Springfield', region: 'NoVA' },
  '22180': { lat: 38.8970, lng: -77.2560, name: 'VA - Vienna', region: 'NoVA' },
  '22181': { lat: 38.8970, lng: -77.2870, name: 'VA - Vienna', region: 'NoVA' },
  '22182': { lat: 38.9280, lng: -77.2710, name: 'VA - Vienna', region: 'NoVA' },
  '22191': { lat: 38.6260, lng: -77.2670, name: 'VA - Woodbridge', region: 'NoVA' },
  '22192': { lat: 38.6740, lng: -77.3280, name: 'VA - Woodbridge', region: 'NoVA' },
  '22193': { lat: 38.6330, lng: -77.3630, name: 'VA - Woodbridge', region: 'NoVA' },
  '22201': { lat: 38.8816, lng: -77.0910, name: 'VA - Arlington', region: 'NoVA' },
  '22202': { lat: 38.8570, lng: -77.0540, name: 'VA - Arlington Crystal City', region: 'NoVA' },
  '22203': { lat: 38.8730, lng: -77.1160, name: 'VA - Arlington', region: 'NoVA' },
  '22204': { lat: 38.8560, lng: -77.1030, name: 'VA - Arlington', region: 'NoVA' },
  '22205': { lat: 38.8800, lng: -77.1400, name: 'VA - Arlington', region: 'NoVA' },
  '22206': { lat: 38.8430, lng: -77.0870, name: 'VA - Arlington', region: 'NoVA' },
  '22207': { lat: 38.9060, lng: -77.1240, name: 'VA - Arlington', region: 'NoVA' },
  '22209': { lat: 38.8930, lng: -77.0730, name: 'VA - Rosslyn', region: 'NoVA' },
  '22211': { lat: 38.8830, lng: -77.0860, name: 'VA - Fort Myer', region: 'NoVA' },
  '22213': { lat: 38.9000, lng: -77.1600, name: 'VA - Arlington', region: 'NoVA' },
  '22301': { lat: 38.8210, lng: -77.0590, name: 'VA - Alexandria', region: 'NoVA' },
  '22302': { lat: 38.8350, lng: -77.0810, name: 'VA - Alexandria', region: 'NoVA' },
  '22303': { lat: 38.7920, lng: -77.0810, name: 'VA - Alexandria', region: 'NoVA' },
  '22304': { lat: 38.8110, lng: -77.1100, name: 'VA - Alexandria', region: 'NoVA' },
  '22305': { lat: 38.8380, lng: -77.0620, name: 'VA - Alexandria', region: 'NoVA' },
  '22306': { lat: 38.7530, lng: -77.0860, name: 'VA - Alexandria', region: 'NoVA' },
  '22307': { lat: 38.7740, lng: -77.0630, name: 'VA - Alexandria', region: 'NoVA' },
  '22308': { lat: 38.7320, lng: -77.0570, name: 'VA - Alexandria Mt Vernon', region: 'NoVA' },
  '22309': { lat: 38.7190, lng: -77.1040, name: 'VA - Alexandria', region: 'NoVA' },
  '22310': { lat: 38.7850, lng: -77.1200, name: 'VA - Alexandria', region: 'NoVA' },
  '22311': { lat: 38.8300, lng: -77.1330, name: 'VA - Alexandria', region: 'NoVA' },
  '22312': { lat: 38.8200, lng: -77.1540, name: 'VA - Alexandria', region: 'NoVA' },
  '22314': { lat: 38.8050, lng: -77.0480, name: 'VA - Alexandria Old Town', region: 'NoVA' },
  '22315': { lat: 38.7660, lng: -77.1450, name: 'VA - Alexandria', region: 'NoVA' },

  // Loudoun County
  '20105': { lat: 38.9760, lng: -77.5190, name: 'VA - Aldie', region: 'NoVA' },
  '20120': { lat: 38.8570, lng: -77.4640, name: 'VA - Centreville', region: 'NoVA' },
  '20121': { lat: 38.8260, lng: -77.4340, name: 'VA - Centreville', region: 'NoVA' },
  '20124': { lat: 38.8030, lng: -77.3950, name: 'VA - Clifton', region: 'NoVA' },
  '20132': { lat: 39.1440, lng: -77.5670, name: 'VA - Purcellville', region: 'NoVA' },
  '20141': { lat: 39.0350, lng: -77.5570, name: 'VA - Round Hill', region: 'NoVA' },
  '20147': { lat: 39.0360, lng: -77.4760, name: 'VA - Ashburn', region: 'NoVA' },
  '20148': { lat: 39.0180, lng: -77.5130, name: 'VA - Ashburn', region: 'NoVA' },
  '20151': { lat: 38.9030, lng: -77.4410, name: 'VA - Chantilly', region: 'NoVA' },
  '20152': { lat: 38.9090, lng: -77.5040, name: 'VA - Chantilly', region: 'NoVA' },
  '20155': { lat: 38.7950, lng: -77.5300, name: 'VA - Gainesville', region: 'NoVA' },
  '20164': { lat: 39.0210, lng: -77.3990, name: 'VA - Sterling', region: 'NoVA' },
  '20165': { lat: 39.0580, lng: -77.4140, name: 'VA - Sterling', region: 'NoVA' },
  '20166': { lat: 38.9870, lng: -77.4310, name: 'VA - Sterling', region: 'NoVA' },
  '20170': { lat: 38.9620, lng: -77.3590, name: 'VA - Herndon', region: 'NoVA' },
  '20171': { lat: 38.9320, lng: -77.3880, name: 'VA - Herndon', region: 'NoVA' },
  '20175': { lat: 39.1100, lng: -77.5400, name: 'VA - Leesburg', region: 'NoVA' },
  '20176': { lat: 39.0810, lng: -77.5200, name: 'VA - Leesburg', region: 'NoVA' },
  '20190': { lat: 38.9580, lng: -77.3430, name: 'VA - Reston', region: 'NoVA' },
  '20191': { lat: 38.9280, lng: -77.3530, name: 'VA - Reston', region: 'NoVA' },
  '20194': { lat: 38.9810, lng: -77.3370, name: 'VA - Reston', region: 'NoVA' },

  // ==========================================
  // VIRGINIA - GÜNEY / UZAK (224xx - 229xx) - UYARI!
  // ==========================================
  '22401': { lat: 38.3032, lng: -77.4606, name: 'VA - Fredericksburg', region: 'FAR' },
  '22405': { lat: 38.3270, lng: -77.4180, name: 'VA - Fredericksburg', region: 'FAR' },
  '22406': { lat: 38.3890, lng: -77.5300, name: 'VA - Fredericksburg', region: 'FAR' },
  '22407': { lat: 38.3110, lng: -77.5450, name: 'VA - Fredericksburg', region: 'FAR' },
  '22408': { lat: 38.2410, lng: -77.4840, name: 'VA - Fredericksburg', region: 'FAR' },
  '22427': { lat: 38.0970, lng: -77.2950, name: 'VA - Bowling Green', region: 'FAR' },
  '22432': { lat: 37.8890, lng: -76.3700, name: 'VA - Burgess', region: 'FAR' },
  '22443': { lat: 38.2580, lng: -76.9920, name: 'VA - Colonial Beach', region: 'FAR' },
  '22448': { lat: 38.3190, lng: -77.0530, name: 'VA - Dahlgren', region: 'FAR' },
  '22454': { lat: 38.0120, lng: -76.9480, name: 'VA - Dunnsville', region: 'FAR' },
  '22460': { lat: 37.9430, lng: -76.4030, name: 'VA - Farnham', region: 'FAR' },
  '22469': { lat: 38.1170, lng: -76.6470, name: 'VA - Hague', region: 'FAR' },
  '22480': { lat: 37.6340, lng: -76.4130, name: 'VA - Irvington', region: 'FAR' },
  '22485': { lat: 38.3110, lng: -77.2110, name: 'VA - King George', region: 'FAR' },
  '22508': { lat: 38.3440, lng: -77.7280, name: 'VA - Locust Grove', region: 'FAR' },
  '22520': { lat: 38.1020, lng: -76.7880, name: 'VA - Montross', region: 'FAR' },
  '22534': { lat: 38.1620, lng: -77.6640, name: 'VA - Partlow', region: 'FAR' },
  '22544': { lat: 38.0680, lng: -77.0180, name: 'VA - Port Royal', region: 'FAR' },
  '22546': { lat: 37.9930, lng: -77.3690, name: 'VA - Ruther Glen', region: 'FAR' },
  '22553': { lat: 38.2690, lng: -77.6550, name: 'VA - Spotsylvania', region: 'FAR' },
  '22554': { lat: 38.4700, lng: -77.4010, name: 'VA - Stafford', region: 'FAR' },
  '22556': { lat: 38.4880, lng: -77.4810, name: 'VA - Stafford', region: 'FAR' },
  '22560': { lat: 37.9050, lng: -76.8280, name: 'VA - Tappahannock', region: 'FAR' },
  '22572': { lat: 37.8260, lng: -76.7070, name: 'VA - Warsaw', region: 'FAR' },
  '22580': { lat: 38.0420, lng: -77.4660, name: 'VA - Woodford', region: 'FAR' },
  '22601': { lat: 39.1710, lng: -78.1690, name: 'VA - Winchester', region: 'FAR' },
  '22602': { lat: 39.1310, lng: -78.2190, name: 'VA - Winchester', region: 'FAR' },
  '22603': { lat: 39.2420, lng: -78.1210, name: 'VA - Winchester', region: 'FAR' },
  '22610': { lat: 38.9150, lng: -78.0610, name: 'VA - Bentonville', region: 'FAR' },
  '22611': { lat: 39.1370, lng: -77.9800, name: 'VA - Berryville', region: 'FAR' },
  '22620': { lat: 39.0450, lng: -78.0530, name: 'VA - Boyce', region: 'FAR' },
  '22630': { lat: 38.9200, lng: -78.1880, name: 'VA - Front Royal', region: 'FAR' },
  '22701': { lat: 38.4730, lng: -78.0150, name: 'VA - Culpeper', region: 'FAR' },
  '22712': { lat: 38.5580, lng: -77.7230, name: 'VA - Bealeton', region: 'FAR' },
  '22715': { lat: 38.5030, lng: -78.2040, name: 'VA - Brightwood', region: 'FAR' },
  '22720': { lat: 38.5330, lng: -77.6470, name: 'VA - Catlett', region: 'FAR' },
  '22722': { lat: 38.5670, lng: -78.2650, name: 'VA - Castleton', region: 'FAR' },
  '22726': { lat: 38.4160, lng: -77.8350, name: 'VA - Elkwood', region: 'FAR' },
  '22727': { lat: 38.4320, lng: -78.4300, name: 'VA - Madison', region: 'FAR' },
  '22728': { lat: 38.6430, lng: -77.6200, name: 'VA - Midland', region: 'FAR' },
  '22729': { lat: 38.3550, lng: -78.0690, name: 'VA - Mitchells', region: 'FAR' },
  '22730': { lat: 38.4720, lng: -78.2530, name: 'VA - Oakpark', region: 'FAR' },
  '22731': { lat: 38.3340, lng: -78.3150, name: 'VA - Pratts', region: 'FAR' },
  '22732': { lat: 38.4280, lng: -78.2120, name: 'VA - Rapidan', region: 'FAR' },
  '22733': { lat: 38.4260, lng: -78.0930, name: 'VA - Reva', region: 'FAR' },
  '22734': { lat: 38.5310, lng: -77.7810, name: 'VA - Remington', region: 'FAR' },
  '22735': { lat: 38.4700, lng: -78.2880, name: 'VA - Rixeyville', region: 'FAR' },
  '22736': { lat: 38.3760, lng: -77.8980, name: 'VA - Richardsville', region: 'FAR' },
  '22737': { lat: 38.5390, lng: -78.0050, name: 'VA - Amissville', region: 'FAR' },
  '22738': { lat: 38.3470, lng: -78.2560, name: 'VA - Rochelle', region: 'FAR' },
  '22740': { lat: 38.6340, lng: -78.2770, name: 'VA - Sperryville', region: 'FAR' },
  '22741': { lat: 38.4840, lng: -77.9480, name: 'VA - Stevensburg', region: 'FAR' },
  '22742': { lat: 38.4700, lng: -77.7500, name: 'VA - Sumerduck', region: 'FAR' },
  '22743': { lat: 38.5130, lng: -78.3760, name: 'VA - Syria', region: 'FAR' },
  '22746': { lat: 38.6180, lng: -78.0040, name: 'VA - Viewtown', region: 'FAR' },
  '22747': { lat: 38.7100, lng: -78.1600, name: 'VA - Washington', region: 'FAR' },
  '22749': { lat: 38.6160, lng: -78.1840, name: 'VA - Woodville', region: 'FAR' },

  // Prince William County
  '20109': { lat: 38.7620, lng: -77.4980, name: 'VA - Manassas', region: 'NoVA' },
  '20110': { lat: 38.7480, lng: -77.4750, name: 'VA - Manassas', region: 'NoVA' },
  '20111': { lat: 38.7760, lng: -77.4490, name: 'VA - Manassas', region: 'NoVA' },
  '20112': { lat: 38.7120, lng: -77.4560, name: 'VA - Manassas Park', region: 'NoVA' },
  '20136': { lat: 38.7410, lng: -77.5580, name: 'VA - Bristow', region: 'NoVA' },
  '20143': { lat: 38.8250, lng: -77.5680, name: 'VA - Catharpin', region: 'NoVA' },
  '20169': { lat: 38.8410, lng: -77.6190, name: 'VA - Haymarket', region: 'NoVA' },
  '20181': { lat: 38.6740, lng: -77.5410, name: 'VA - Nokesville', region: 'NoVA' },

  // Fauquier County (Border)
  '20115': { lat: 38.8970, lng: -77.7960, name: 'VA - Marshall', region: 'FAR' },
  '20116': { lat: 38.9150, lng: -77.8610, name: 'VA - Middleburg', region: 'FAR' },
  '20117': { lat: 38.9690, lng: -77.7320, name: 'VA - Middleburg', region: 'FAR' },
  '20119': { lat: 38.6800, lng: -77.6950, name: 'VA - Catlett', region: 'FAR' },
  '20130': { lat: 39.0240, lng: -77.8680, name: 'VA - Paris', region: 'FAR' },
  '20137': { lat: 38.8150, lng: -77.7070, name: 'VA - Broad Run', region: 'FAR' },
  '20138': { lat: 38.7390, lng: -77.7200, name: 'VA - Calverton', region: 'FAR' },
  '20139': { lat: 38.6940, lng: -77.8130, name: 'VA - Casanova', region: 'FAR' },
  '20140': { lat: 38.9280, lng: -77.9310, name: 'VA - Rectortown', region: 'FAR' },
  '20144': { lat: 38.8930, lng: -77.9830, name: 'VA - Delaplane', region: 'FAR' },
  '20184': { lat: 38.9100, lng: -77.8960, name: 'VA - Upperville', region: 'FAR' },
  '20186': { lat: 38.7180, lng: -77.7960, name: 'VA - Warrenton', region: 'FAR' },
  '20187': { lat: 38.7250, lng: -77.8410, name: 'VA - Warrenton', region: 'FAR' },
  '20188': { lat: 38.7710, lng: -77.8000, name: 'VA - Warrenton', region: 'FAR' },

  // ==========================================
  // MARYLAND - UZAK (217xx Frederick) - UYARI!
  // DC'den 70+ km kuzeyde - birleştirme çok riskli!
  // ==========================================
  '21701': { lat: 39.4143, lng: -77.4105, name: 'MD - Frederick', region: 'FAR' },
  '21702': { lat: 39.4615, lng: -77.4257, name: 'MD - Frederick', region: 'FAR' },
  '21703': { lat: 39.3880, lng: -77.4590, name: 'MD - Frederick', region: 'FAR' },
  '21704': { lat: 39.3570, lng: -77.3930, name: 'MD - Frederick', region: 'FAR' },
  '21705': { lat: 39.4120, lng: -77.4110, name: 'MD - Frederick PO', region: 'FAR' },
  '21710': { lat: 39.3340, lng: -77.5090, name: 'MD - Adamstown', region: 'FAR' },
  '21714': { lat: 39.4420, lng: -77.5690, name: 'MD - Braddock Heights', region: 'FAR' },
  '21716': { lat: 39.3140, lng: -77.6220, name: 'MD - Brunswick', region: 'FAR' },
  '21717': { lat: 39.3510, lng: -77.4490, name: 'MD - Buckeystown', region: 'FAR' },
  '21718': { lat: 39.4070, lng: -77.6370, name: 'MD - Burkittsville', region: 'FAR' },
  '21719': { lat: 39.6970, lng: -77.4880, name: 'MD - Cascade', region: 'FAR' },
  '21727': { lat: 39.6460, lng: -77.3710, name: 'MD - Emmitsburg', region: 'FAR' },
  '21754': { lat: 39.3430, lng: -77.2860, name: 'MD - Ijamsville', region: 'FAR' },
  '21755': { lat: 39.3530, lng: -77.5590, name: 'MD - Jefferson', region: 'FAR' },
  '21757': { lat: 39.5450, lng: -77.2680, name: 'MD - Keymar', region: 'FAR' },
  '21758': { lat: 39.3580, lng: -77.6560, name: 'MD - Knoxville', region: 'FAR' },
  '21769': { lat: 39.4520, lng: -77.5550, name: 'MD - Middletown', region: 'FAR' },
  '21770': { lat: 39.3580, lng: -77.2270, name: 'MD - Monrovia', region: 'FAR' },
  '21771': { lat: 39.4040, lng: -77.1540, name: 'MD - Mount Airy', region: 'FAR' },
  '21773': { lat: 39.4580, lng: -77.5940, name: 'MD - Myersville', region: 'FAR' },
  '21774': { lat: 39.3940, lng: -77.2730, name: 'MD - New Market', region: 'FAR' },
  '21776': { lat: 39.5040, lng: -77.0980, name: 'MD - New Windsor', region: 'FAR' },
  '21777': { lat: 39.2920, lng: -77.5340, name: 'MD - Point of Rocks', region: 'FAR' },
  '21778': { lat: 39.5320, lng: -77.3530, name: 'MD - Rocky Ridge', region: 'FAR' },
  '21780': { lat: 39.6490, lng: -77.5540, name: 'MD - Sabillasville', region: 'FAR' },
  '21787': { lat: 39.5870, lng: -77.1930, name: 'MD - Taneytown', region: 'FAR' },
  '21788': { lat: 39.5710, lng: -77.4110, name: 'MD - Thurmont', region: 'FAR' },
  '21790': { lat: 39.2730, lng: -77.4990, name: 'MD - Tuscarora', region: 'FAR' },
  '21791': { lat: 39.5320, lng: -77.1130, name: 'MD - Union Bridge', region: 'FAR' },
  '21793': { lat: 39.4760, lng: -77.3320, name: 'MD - Walkersville', region: 'FAR' },
  '21797': { lat: 39.3380, lng: -77.0760, name: 'MD - Woodbine', region: 'FAR' },
  '21798': { lat: 39.4990, lng: -77.2600, name: 'MD - Woodsboro', region: 'FAR' },
}

/**
 * Haversine formülü ile iki koordinat arası mesafe hesapla (km)
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Dünya yarıçapı (km)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * İki ZIP kodu arası mesafe ve tahmini sürüş süresi
 */
export interface ZipDistanceResult {
  distanceKm: number
  drivingMinutes: number
  fromName: string
  toName: string
  fromRegion: string
  toRegion: string
}

export function getZipDistance(zip1: string, zip2: string): ZipDistanceResult | null {
  const coord1 = ZIP_COORDINATES[zip1]
  const coord2 = ZIP_COORDINATES[zip2]

  if (!coord1 || !coord2) return null

  const distanceKm = haversineDistance(coord1.lat, coord1.lng, coord2.lat, coord2.lng)

  // Tahmini sürüş süresi:
  // - 0-5 km: 3 dk/km (şehir içi yoğun trafik)
  // - 5-15 km: 2 dk/km (orta mesafe)
  // - 15+ km: 1.5 dk/km (otoyol)
  let drivingMinutes: number
  if (distanceKm <= 5) {
    drivingMinutes = Math.ceil(distanceKm * 3)
  } else if (distanceKm <= 15) {
    drivingMinutes = Math.ceil(5 * 3 + (distanceKm - 5) * 2)
  } else {
    drivingMinutes = Math.ceil(5 * 3 + 10 * 2 + (distanceKm - 15) * 1.5)
  }

  // Minimum 5 dakika (park etme, yürüme vs.)
  drivingMinutes = Math.max(5, drivingMinutes)

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    drivingMinutes,
    fromName: coord1.name,
    toName: coord2.name,
    fromRegion: coord1.region,
    toRegion: coord2.region,
  }
}

// Gruplama limitleri
const MIN_BUFFER_MINUTES = 5  // Minimum buffer süresi (dakika)
const MAX_DRIVING_MINUTES = 25  // Maximum sürüş süresi (dakika)

/**
 * Verilen buffer süresi içinde bir noktadan diğerine ulaşılabilir mi?
 */
export function isReachableInTime(
  fromZip: string,
  toZip: string,
  bufferMinutes: number
): { reachable: boolean; reason: string; distance?: ZipDistanceResult } {
  // Aynı ZIP bile olsa minimum buffer gerekli
  if (fromZip === toZip) {
    if (bufferMinutes < MIN_BUFFER_MINUTES) {
      return {
        reachable: false,
        reason: `Aynı ZIP ama buffer çok kısa: ${bufferMinutes}dk < ${MIN_BUFFER_MINUTES}dk minimum`
      }
    }
    return { reachable: true, reason: 'Aynı ZIP kodu' }
  }

  const distance = getZipDistance(fromZip, toZip)

  if (!distance) {
    // ZIP koordinatı bulunamadı - güvenli tarafta ol, reddet
    return {
      reachable: false,
      reason: `ZIP koordinatı bulunamadı (${fromZip} veya ${toZip})`,
    }
  }

  // Maximum sürüş süresi kontrolü - 25dk'dan fazla sürüş kabul edilmez
  if (distance.drivingMinutes > MAX_DRIVING_MINUTES) {
    return {
      reachable: false,
      reason: `Sürüş süresi çok uzun: ${distance.drivingMinutes}dk > ${MAX_DRIVING_MINUTES}dk maksimum`,
      distance,
    }
  }

  // FAR bölgelerden/bölgelere geçiş çok riskli
  if (distance.fromRegion === 'FAR' || distance.toRegion === 'FAR') {
    if (bufferMinutes < 60) {
      return {
        reachable: false,
        reason: `Uzak bölge geçişi (${distance.fromName} → ${distance.toName}), minimum 60dk gerekli`,
        distance,
      }
    }
  }

  // Sürüş süresi buffer'dan fazlaysa ulaşılamaz
  if (distance.drivingMinutes > bufferMinutes) {
    return {
      reachable: false,
      reason: `Mesafe çok uzak: ${distance.distanceKm}km, ${distance.drivingMinutes}dk sürüş > ${bufferMinutes}dk buffer`,
      distance,
    }
  }

  // Güvenlik marjı: sürüş süresi buffer'ın %80'inden fazlaysa riskli
  if (distance.drivingMinutes > bufferMinutes * 0.8) {
    return {
      reachable: true,
      reason: `Riskli: ${distance.drivingMinutes}dk sürüş, ${bufferMinutes}dk buffer (az marj)`,
      distance,
    }
  }

  return {
    reachable: true,
    reason: `OK: ${distance.distanceKm}km, ${distance.drivingMinutes}dk sürüş < ${bufferMinutes}dk buffer`,
    distance,
  }
}

/**
 * ZIP kodunun bölgesini döndür
 */
export function getZipRegion(zip: string): string {
  const coord = ZIP_COORDINATES[zip]
  return coord?.region || 'UNKNOWN'
}

/**
 * ZIP koordinat tablosunda var mı?
 */
export function isKnownZip(zip: string): boolean {
  return zip in ZIP_COORDINATES
}
