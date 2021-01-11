const stations = [
  {
    label: "Abbey Wood",
    value: "ABW",
  },
  {
    label: "Abbey Wood (Crossrail)",
    value: "ABX",
  },
  {
    label: "Aber",
    value: "ABE",
  },
  {
    label: "Abercynon",
    value: "ACY",
  },
  {
    label: "Aberdare",
    value: "ABA",
  },
  {
    label: "Aberdeen",
    value: "ABD",
  },
  {
    label: "Aberdour",
    value: "AUR",
  },
  {
    label: "Aberdovey",
    value: "AVY",
  },
  {
    label: "Abererch",
    value: "ABH",
  },
  {
    label: "Abergavenny",
    value: "AGV",
  },
  {
    label: "Abergele & Pensarn",
    value: "AGL",
  },
  {
    label: "Aberystwyth",
    value: "AYW",
  },
  {
    label: "Abingdon (Bus)",
    value: "XAE",
  },
  {
    label: "Accrington",
    value: "ACR",
  },
  {
    label: "Achanalt",
    value: "AAT",
  },
  {
    label: "Achnasheen",
    value: "ACN",
  },
  {
    label: "Achnashellach",
    value: "ACH",
  },
  {
    label: "Acklington",
    value: "ACK",
  },
  {
    label: "Acle",
    value: "ACL",
  },
  {
    label: "Acocks Green",
    value: "ACG",
  },
  {
    label: "Acton Bridge",
    value: "ACB",
  },
  {
    label: "Acton Central",
    value: "ACC",
  },
  {
    label: "Acton Main Line",
    value: "AML",
  },
  {
    label: "Adderley Park",
    value: "ADD",
  },
  {
    label: "Addiewell",
    value: "ADW",
  },
  {
    label: "Addlestone",
    value: "ASN",
  },
  {
    label: "Adisham",
    value: "ADM",
  },
  {
    label: "Adlington (Cheshire)",
    value: "ADC",
  },
  {
    label: "Adlington (Lancashire)",
    value: "ADL",
  },
  {
    label: "Adwick",
    value: "AWK",
  },
  {
    label: "Aigburth",
    value: "AIG",
  },
  {
    label: "Ainsdale",
    value: "ANS",
  },
  {
    label: "Aintree",
    value: "AIN",
  },
  {
    label: "Airbles",
    value: "AIR",
  },
  {
    label: "Airdrie",
    value: "ADR",
  },
  {
    label: "Albany Park",
    value: "AYP",
  },
  {
    label: "Albrighton",
    value: "ALB",
  },
  {
    label: "Alderley Edge",
    value: "ALD",
  },
  {
    label: "Aldermaston",
    value: "AMT",
  },
  {
    label: "Aldershot",
    value: "AHT",
  },
  {
    label: "Aldrington",
    value: "AGT",
  },
  {
    label: "Alexandra Palace",
    value: "AAP",
  },
  {
    label: "Alexandra Parade",
    value: "AXP",
  },
  {
    label: "Alexandria",
    value: "ALX",
  },
  {
    label: "Alfreton",
    value: "ALF",
  },
  {
    label: "Allens West",
    value: "ALW",
  },
  {
    label: "Alloa",
    value: "ALO",
  },
  {
    label: "Alness",
    value: "ASS",
  },
  {
    label: "Alnmouth",
    value: "ALM",
  },
  {
    label: "Alresford",
    value: "ALR",
  },
  {
    label: "Alsager",
    value: "ASG",
  },
  {
    label: "Althorne",
    value: "ALN",
  },
  {
    label: "Althorpe",
    value: "ALP",
  },
  {
    label: "Altnabreac",
    value: "ABC",
  },
  {
    label: "Alton",
    value: "AON",
  },
  {
    label: "Alton Towers (Bus)",
    value: "ATW",
  },
  {
    label: "Altrincham",
    value: "ALT",
  },
  {
    label: "Alvechurch",
    value: "ALV",
  },
  {
    label: "Ambergate",
    value: "AMB",
  },
  {
    label: "Amberley",
    value: "AMY",
  },
  {
    label: "Amersham",
    value: "AMR",
  },
  {
    label: "Ammanford",
    value: "AMF",
  },
  {
    label: "Ampfield School (Bus)",
    value: "AMD",
  },
  {
    label: "Amsterdam CS",
    value: "AMS",
  },
  {
    label: "Ancaster",
    value: "ANC",
  },
  {
    label: "Anderston",
    value: "AND",
  },
  {
    label: "Andover",
    value: "ADV",
  },
  {
    label: "Anerley",
    value: "ANZ",
  },
  {
    label: "Angel Road",
    value: "AGR",
  },
  {
    label: "Angmering",
    value: "ANG",
  },
  {
    label: "Annan",
    value: "ANN",
  },
  {
    label: "Anniesland",
    value: "ANL",
  },
  {
    label: "Ansdell & Fairhaven",
    value: "AFV",
  },
  {
    label: "Apperley Bridge",
    value: "APY",
  },
  {
    label: "Appleby",
    value: "APP",
  },
  {
    label: "Appledore (Kent)",
    value: "APD",
  },
  {
    label: "Appleford",
    value: "APF",
  },
  {
    label: "Appley Bridge",
    value: "APB",
  },
  {
    label: "Apsley",
    value: "APS",
  },
  {
    label: "Arbroath",
    value: "ARB",
  },
  {
    label: "Ardgay",
    value: "ARD",
  },
  {
    label: "Ardlui",
    value: "AUI",
  },
  {
    label: "Ardrossan Harbour",
    value: "ADS",
  },
  {
    label: "Ardrossan South Beach",
    value: "ASB",
  },
  {
    label: "Ardrossan Town",
    value: "ADN",
  },
  {
    label: "Ardwick",
    value: "ADK",
  },
  {
    label: "Argyle Street",
    value: "AGS",
  },
  {
    label: "Arisaig",
    value: "ARG",
  },
  {
    label: "Arlesey",
    value: "ARL",
  },
  {
    label: "Armadale",
    value: "ARM",
  },
  {
    label: "Armadale (Bus)",
    value: "ARA",
  },
  {
    label: "Armathwaite",
    value: "AWT",
  },
  {
    label: "Arnside",
    value: "ARN",
  },
  {
    label: "Arram",
    value: "ARR",
  },
  {
    label: "Arrochar & Tarbet",
    value: "ART",
  },
  {
    label: "Arundel",
    value: "ARU",
  },
  {
    label: "Ascot",
    value: "ACT",
  },
  {
    label: "Ascott-under-Wychwood",
    value: "AUW",
  },
  {
    label: "Ash",
    value: "ASH",
  },
  {
    label: "Ash Vale",
    value: "AHV",
  },
  {
    label: "Ashburys",
    value: "ABY",
  },
  {
    label: "Ashchurch for Tewkesbury",
    value: "ASC",
  },
  {
    label: "Ashfield",
    value: "ASF",
  },
  {
    label: "Ashford (Surrey)",
    value: "AFS",
  },
  {
    label: "Ashford International",
    value: "AFK",
  },
  {
    label: "Ashley",
    value: "ASY",
  },
  {
    label: "Ashtead",
    value: "AHD",
  },
  {
    label: "Ashton-under-Lyne",
    value: "AHN",
  },
  {
    label: "Ashurst",
    value: "AHS",
  },
  {
    label: "Ashurst New Forest",
    value: "ANF",
  },
  {
    label: "Ashwell & Morden",
    value: "AWM",
  },
  {
    label: "Askam",
    value: "ASK",
  },
  {
    label: "Aslockton",
    value: "ALK",
  },
  {
    label: "Aspatria",
    value: "ASP",
  },
  {
    label: "Aspley Guise",
    value: "APG",
  },
  {
    label: "Aston",
    value: "AST",
  },
  {
    label: "Atherstone",
    value: "ATH",
  },
  {
    label: "Atherton",
    value: "ATN",
  },
  {
    label: "Attadale",
    value: "ATT",
  },
  {
    label: "Attenborough",
    value: "ATB",
  },
  {
    label: "Attercliffe (Tram)",
    value: "ATE",
  },
  {
    label: "Attleborough",
    value: "ATL",
  },
  {
    label: "Auchinleck",
    value: "AUK",
  },
  {
    label: "Audley End",
    value: "AUD",
  },
  {
    label: "Aughton Park",
    value: "AUG",
  },
  {
    label: "Avebury (Bus)",
    value: "XAF",
  },
  {
    label: "Aviemore",
    value: "AVM",
  },
  {
    label: "Avignon",
    value: "AVI",
  },
  {
    label: "Avoncliff",
    value: "AVF",
  },
  {
    label: "Avonmouth",
    value: "AVN",
  },
  {
    label: "Axminster",
    value: "AXM",
  },
  {
    label: "Aylesbury",
    value: "AYS",
  },
  {
    label: "Aylesbury Vale Parkway",
    value: "AVP",
  },
  {
    label: "Aylesford",
    value: "AYL",
  },
  {
    label: "Aylesham",
    value: "AYH",
  },
  {
    label: "Ayr",
    value: "AYR",
  },
  {
    label: "Bache",
    value: "BAC",
  },
  {
    label: "Baglan",
    value: "BAJ",
  },
  {
    label: "Bagshot",
    value: "BAG",
  },
  {
    label: "Baildon",
    value: "BLD",
  },
  {
    label: "Baillieston",
    value: "BIO",
  },
  {
    label: "Baker Street Underground",
    value: "ZBS",
  },
  {
    label: "Bakewell (Bus)",
    value: "BKZ",
  },
  {
    label: "Balcombe",
    value: "BAB",
  },
  {
    label: "Baldock",
    value: "BDK",
  },
  {
    label: "Balham",
    value: "BAL",
  },
  {
    label: "Balloch",
    value: "BHC",
  },
  {
    label: "Balmossie",
    value: "BSI",
  },
  {
    label: "Bamber Bridge",
    value: "BMB",
  },
  {
    label: "Bamford",
    value: "BAM",
  },
  {
    label: "Banavie",
    value: "BNV",
  },
  {
    label: "Banbury",
    value: "BAN",
  },
  {
    label: "Bangor (Gwynedd)",
    value: "BNG",
  },
  {
    label: "Bank Hall",
    value: "BAH",
  },
  {
    label: "Banstead",
    value: "BAD",
  },
  {
    label: "Barassie",
    value: "BSS",
  },
  {
    label: "Barbican Underground",
    value: "ZBB",
  },
  {
    label: "Bardon Mill",
    value: "BLL",
  },
  {
    label: "Bare Lane",
    value: "BAR",
  },
  {
    label: "Bargeddie",
    value: "BGI",
  },
  {
    label: "Bargoed",
    value: "BGD",
  },
  {
    label: "Barking",
    value: "BKG",
  },
  {
    label: "Barking Underground",
    value: "ZBK",
  },
  {
    label: "Barlaston",
    value: "BRT",
  },
  {
    label: "Barlaston Orchard Place (Bus)",
    value: "BPL",
  },
  {
    label: "Barming",
    value: "BMG",
  },
  {
    label: "Barmouth",
    value: "BRM",
  },
  {
    label: "Barnehurst",
    value: "BNH",
  },
  {
    label: "Barnes",
    value: "BNS",
  },
  {
    label: "Barnes Bridge",
    value: "BNI",
  },
  {
    label: "Barnetby",
    value: "BTB",
  },
  {
    label: "Barnham",
    value: "BAA",
  },
  {
    label: "Barnhill",
    value: "BNL",
  },
  {
    label: "Barnsley",
    value: "BNY",
  },
  {
    label: "Barnsley (Bus)",
    value: "BNX",
  },
  {
    label: "Barnstaple",
    value: "BNP",
  },
  {
    label: "Barnt Green",
    value: "BTG",
  },
  {
    label: "Barons Court Underground",
    value: "ZBC",
  },
  {
    label: "Barrhead",
    value: "BRR",
  },
  {
    label: "Barrhill",
    value: "BRL",
  },
  {
    label: "Barrow Haven",
    value: "BAV",
  },
  {
    label: "Barrow-in-Furness",
    value: "BIF",
  },
  {
    label: "Barrow-upon-Soar",
    value: "BWS",
  },
  {
    label: "Barry",
    value: "BRY",
  },
  {
    label: "Barry Docks",
    value: "BYD",
  },
  {
    label: "Barry Island",
    value: "BYI",
  },
  {
    label: "Barry Links",
    value: "BYL",
  },
  {
    label: "Barton-on-Humber",
    value: "BAU",
  },
  {
    label: "Basildon",
    value: "BSO",
  },
  {
    label: "Basingstoke",
    value: "BSK",
  },
  {
    label: "Bat & Ball",
    value: "BBL",
  },
  {
    label: "Bath Bus Station",
    value: "XDO",
  },
  {
    label: "Bath Spa",
    value: "BTH",
  },
  {
    label: "Bathgate",
    value: "BHG",
  },
  {
    label: "Batley",
    value: "BTL",
  },
  {
    label: "Battersby",
    value: "BTT",
  },
  {
    label: "Battersea Park",
    value: "BAK",
  },
  {
    label: "Battle",
    value: "BAT",
  },
  {
    label: "Battlesbridge",
    value: "BLB",
  },
  {
    label: "Bayford",
    value: "BAY",
  },
  {
    label: "Beaconsfield",
    value: "BCF",
  },
  {
    label: "Bearley",
    value: "BER",
  },
  {
    label: "Bearsden",
    value: "BRN",
  },
  {
    label: "Bearsted",
    value: "BSD",
  },
  {
    label: "Beasdale",
    value: "BSL",
  },
  {
    label: "Beaulieu Road",
    value: "BEU",
  },
  {
    label: "Beauly",
    value: "BEL",
  },
  {
    label: "Bebington",
    value: "BEB",
  },
  {
    label: "Beccles",
    value: "BCC",
  },
  {
    label: "Beckenham Hill",
    value: "BEC",
  },
  {
    label: "Beckenham Junction",
    value: "BKJ",
  },
  {
    label: "Bedford",
    value: "BDM",
  },
  {
    label: "Bedford (Bus)",
    value: "XDW",
  },
  {
    label: "Bedford St Johns",
    value: "BSJ",
  },
  {
    label: "Bedhampton",
    value: "BDH",
  },
  {
    label: "Bedminster",
    value: "BMT",
  },
  {
    label: "Bedworth",
    value: "BEH",
  },
  {
    label: "Bedwyn",
    value: "BDW",
  },
  {
    label: "Beeston",
    value: "BEE",
  },
  {
    label: "Bekesbourne",
    value: "BKS",
  },
  {
    label: "Belfast Donegall Quay (Bus)",
    value: "BFQ",
  },
  {
    label: "Belfast Port",
    value: "BFA",
  },
  {
    label: "Belle Vue",
    value: "BLV",
  },
  {
    label: "Bellgrove",
    value: "BLG",
  },
  {
    label: "Bellingham",
    value: "BGM",
  },
  {
    label: "Bellshill",
    value: "BLH",
  },
  {
    label: "Belmont",
    value: "BLM",
  },
  {
    label: "Belper",
    value: "BLP",
  },
  {
    label: "Beltring",
    value: "BEG",
  },
  {
    label: "Belvedere",
    value: "BVD",
  },
  {
    label: "Bempton",
    value: "BEM",
  },
  {
    label: "Ben Rhydding",
    value: "BEY",
  },
  {
    label: "Benfleet",
    value: "BEF",
  },
  {
    label: "Bentham",
    value: "BEN",
  },
  {
    label: "Bentley (Hampshire)",
    value: "BTY",
  },
  {
    label: "Bentley (South Yorkshire)",
    value: "BYK",
  },
  {
    label: "Benton (T & W Metro)",
    value: "BNO",
  },
  {
    label: "Bere Alston",
    value: "BAS",
  },
  {
    label: "Bere Ferrers",
    value: "BFE",
  },
  {
    label: "Berkhamsted",
    value: "BKM",
  },
  {
    label: "Berkswell",
    value: "BKW",
  },
  {
    label: "Bermuda Park (Nuneaton)",
    value: "BEP",
  },
  {
    label: "Berney Arms",
    value: "BYA",
  },
  {
    label: "Berry Brow",
    value: "BBW",
  },
  {
    label: "Berrylands",
    value: "BRS",
  },
  {
    label: "Berwick (Sussex)",
    value: "BRK",
  },
  {
    label: "Berwick-upon-Tweed",
    value: "BWK",
  },
  {
    label: "Bescar Lane",
    value: "BES",
  },
  {
    label: "Bescot Stadium",
    value: "BSC",
  },
  {
    label: "Betchworth",
    value: "BTO",
  },
  {
    label: "Bethnal Green",
    value: "BET",
  },
  {
    label: "Betws-y-Coed",
    value: "BYC",
  },
  {
    label: "Beverley",
    value: "BEV",
  },
  {
    label: "Bexhill",
    value: "BEX",
  },
  {
    label: "Bexley",
    value: "BXY",
  },
  {
    label: "Bexleyheath",
    value: "BXH",
  },
  {
    label: "Bicester (Bus)",
    value: "XEZ",
  },
  {
    label: "Bicester North",
    value: "BCS",
  },
  {
    label: "Bicester Village",
    value: "BIT",
  },
  {
    label: "Bickley",
    value: "BKL",
  },
  {
    label: "Bidston",
    value: "BID",
  },
  {
    label: "Biggleswade",
    value: "BIW",
  },
  {
    label: "Bilbrook",
    value: "BBK",
  },
  {
    label: "Billericay",
    value: "BIC",
  },
  {
    label: "Billingham",
    value: "BIL",
  },
  {
    label: "Billingshurst",
    value: "BIG",
  },
  {
    label: "Bingham",
    value: "BIN",
  },
  {
    label: "Bingley",
    value: "BIY",
  },
  {
    label: "Birchgrove",
    value: "BCG",
  },
  {
    label: "Birchington-on-Sea",
    value: "BCH",
  },
  {
    label: "Birchwood",
    value: "BWD",
  },
  {
    label: "Birkbeck",
    value: "BIK",
  },
  {
    label: "Birkdale",
    value: "BDL",
  },
  {
    label: "Birkenhead Central",
    value: "BKC",
  },
  {
    label: "Birkenhead North",
    value: "BKN",
  },
  {
    label: "Birkenhead Park",
    value: "BKP",
  },
  {
    label: "Birmingham Airport (Bus)",
    value: "XFG",
  },
  {
    label: "Birmingham International",
    value: "BHI",
  },
  {
    label: "Birmingham Moor Street",
    value: "BMO",
  },
  {
    label: "Birmingham NEC (Bus)",
    value: "XNE",
  },
  {
    label: "Birmingham New Street",
    value: "BHM",
  },
  {
    label: "Birmingham Snow Hill",
    value: "BSW",
  },
  {
    label: "Bishop Auckland",
    value: "BIA",
  },
  {
    label: "Bishopbriggs",
    value: "BBG",
  },
  {
    label: "Bishops Lydeard",
    value: "BIB",
  },
  {
    label: "Bishops Lydeard (Bus)",
    value: "XLU",
  },
  {
    label: "Bishops Stortford",
    value: "BIS",
  },
  {
    label: "Bishopstone",
    value: "BIP",
  },
  {
    label: "Bishopton",
    value: "BPT",
  },
  {
    label: "Bitterne",
    value: "BTE",
  },
  {
    label: "Blackburn",
    value: "BBN",
  },
  {
    label: "Blackheath",
    value: "BKH",
  },
  {
    label: "Blackhorse Road",
    value: "BHO",
  },
  {
    label: "Blackpool North",
    value: "BPN",
  },
  {
    label: "Blackpool Pleasure Beach",
    value: "BPB",
  },
  {
    label: "Blackpool South",
    value: "BPS",
  },
  {
    label: "Blackridge",
    value: "BKR",
  },
  {
    label: "Blackrod",
    value: "BLK",
  },
  {
    label: "Blackwater",
    value: "BAW",
  },
  {
    label: "Blackwood (Bus)",
    value: "XKW",
  },
  {
    label: "Blaenau Ffestiniog",
    value: "BFF",
  },
  {
    label: "Blair Atholl",
    value: "BLA",
  },
  {
    label: "Blairhill",
    value: "BAI",
  },
  {
    label: "Blake Street",
    value: "BKT",
  },
  {
    label: "Blakedown",
    value: "BKD",
  },
  {
    label: "Blantyre",
    value: "BLT",
  },
  {
    label: "Blaydon",
    value: "BLO",
  },
  {
    label: "Bleasby",
    value: "BSB",
  },
  {
    label: "Bletchley",
    value: "BLY",
  },
  {
    label: "Bloxwich",
    value: "BLX",
  },
  {
    label: "Bloxwich North",
    value: "BWN",
  },
  {
    label: "Blundellsands & Crosby",
    value: "BLN",
  },
  {
    label: "Blythe Bridge",
    value: "BYB",
  },
  {
    label: "Boat of Garten Post Off (Bus)",
    value: "BGR",
  },
  {
    label: "Bodmin Parkway",
    value: "BOD",
  },
  {
    label: "Bodmin TSB Bank (Bus)",
    value: "BDF",
  },
  {
    label: "Bodorgan",
    value: "BOR",
  },
  {
    label: "Bognor Regis",
    value: "BOG",
  },
  {
    label: "Bogston",
    value: "BGS",
  },
  {
    label: "Bolton",
    value: "BON",
  },
  {
    label: "Bolton-on-Dearne",
    value: "BTD",
  },
  {
    label: "Bond Street",
    value: "BSZ",
  },
  {
    label: "Bookham",
    value: "BKA",
  },
  {
    label: "Bootle",
    value: "BOC",
  },
  {
    label: "Bootle New Strand",
    value: "BNW",
  },
  {
    label: "Bootle Oriel Road",
    value: "BOT",
  },
  {
    label: "Bordesley",
    value: "BBS",
  },
  {
    label: "Bordon Camp (Bus)",
    value: "BDZ",
  },
  {
    label: "Borough Green & Wrotham",
    value: "BRG",
  },
  {
    label: "Borth",
    value: "BRH",
  },
  {
    label: "Bosham",
    value: "BOH",
  },
  {
    label: "Boston",
    value: "BSN",
  },
  {
    label: "Botley",
    value: "BOE",
  },
  {
    label: "Bottesford",
    value: "BTF",
  },
  {
    label: "Bourg St Maurice",
    value: "XIB",
  },
  {
    label: "Bourne End",
    value: "BNE",
  },
  {
    label: "Bournemouth",
    value: "BMH",
  },
  {
    label: "Bournemouth Hurn Airport (Bus)",
    value: "BHA",
  },
  {
    label: "Bournville",
    value: "BRV",
  },
  {
    label: "Bow Brickhill",
    value: "BWB",
  },
  {
    label: "Bowes Park",
    value: "BOP",
  },
  {
    label: "Bowling",
    value: "BWG",
  },
  {
    label: "Boxhill & Westhumble",
    value: "BXW",
  },
  {
    label: "Bracknell",
    value: "BCE",
  },
  {
    label: "Bradford Forster Square",
    value: "BDQ",
  },
  {
    label: "Bradford Interchange",
    value: "BDI",
  },
  {
    label: "Bradford-on-Avon",
    value: "BOA",
  },
  {
    label: "Brading",
    value: "BDN",
  },
  {
    label: "Braintree",
    value: "BTR",
  },
  {
    label: "Braintree Freeport",
    value: "BTP",
  },
  {
    label: "Bramhall",
    value: "BML",
  },
  {
    label: "Bramley (Hampshire)",
    value: "BMY",
  },
  {
    label: "Bramley (West Yorkshire)",
    value: "BLE",
  },
  {
    label: "Brampton (Cumbria)",
    value: "BMP",
  },
  {
    label: "Brampton (Suffolk)",
    value: "BRP",
  },
  {
    label: "Branchton",
    value: "BCN",
  },
  {
    label: "Brandon",
    value: "BND",
  },
  {
    label: "Branksome",
    value: "BSM",
  },
  {
    label: "Braystones",
    value: "BYS",
  },
  {
    label: "Brecon Square (Bus)",
    value: "BEO",
  },
  {
    label: "Bredbury",
    value: "BDY",
  },
  {
    label: "Breich",
    value: "BRC",
  },
  {
    label: "Brentford",
    value: "BFD",
  },
  {
    label: "Brentwood",
    value: "BRE",
  },
  {
    label: "Bricket Wood",
    value: "BWO",
  },
  {
    label: "Bridge of Allan",
    value: "BEA",
  },
  {
    label: "Bridge of Orchy",
    value: "BRO",
  },
  {
    label: "Bridgend",
    value: "BGN",
  },
  {
    label: "Bridgeton",
    value: "BDG",
  },
  {
    label: "Bridgwater",
    value: "BWT",
  },
  {
    label: "Bridlington",
    value: "BDT",
  },
  {
    label: "Brierfield",
    value: "BRF",
  },
  {
    label: "Brigg",
    value: "BGG",
  },
  {
    label: "Brighouse",
    value: "BGH",
  },
  {
    label: "Brighton",
    value: "BTN",
  },
  {
    label: "Brimsdown",
    value: "BMD",
  },
  {
    label: "Brinnington",
    value: "BNT",
  },
  {
    label: "Bristol Intl Airport (Bus)",
    value: "XPB",
  },
  {
    label: "Bristol Parkway",
    value: "BPW",
  },
  {
    label: "Bristol Temple Gate (Bus)",
    value: "XDU",
  },
  {
    label: "Bristol Temple Meads",
    value: "BRI",
  },
  {
    label: "Brithdir",
    value: "BHD",
  },
  {
    label: "British Steel Redcar",
    value: "RBS",
  },
  {
    label: "Briton Ferry",
    value: "BNF",
  },
  {
    label: "Brixton",
    value: "BRX",
  },
  {
    label: "Broad Green",
    value: "BGE",
  },
  {
    label: "Broadbottom",
    value: "BDB",
  },
  {
    label: "Broadstairs",
    value: "BSR",
  },
  {
    label: "Brockenhurst",
    value: "BCU",
  },
  {
    label: "Brockholes",
    value: "BHS",
  },
  {
    label: "Brockley",
    value: "BCY",
  },
  {
    label: "Brockley Whins (T & W Metro)",
    value: "BNR",
  },
  {
    label: "Brodick (Bus)",
    value: "BDC",
  },
  {
    label: "Bromborough",
    value: "BOM",
  },
  {
    label: "Bromborough Rake",
    value: "BMR",
  },
  {
    label: "Bromley Cross",
    value: "BMC",
  },
  {
    label: "Bromley North",
    value: "BMN",
  },
  {
    label: "Bromley South",
    value: "BMS",
  },
  {
    label: "Bromsgrove",
    value: "BMV",
  },
  {
    label: "Brondesbury",
    value: "BSY",
  },
  {
    label: "Brondesbury Park",
    value: "BSP",
  },
  {
    label: "Brookmans Park",
    value: "BPK",
  },
  {
    label: "Brookwood",
    value: "BKO",
  },
  {
    label: "Broome",
    value: "BME",
  },
  {
    label: "Broomfleet",
    value: "BMF",
  },
  {
    label: "Brora",
    value: "BRA",
  },
  {
    label: "Brough",
    value: "BUH",
  },
  {
    label: "Broughty Ferry",
    value: "BYF",
  },
  {
    label: "Broxbourne",
    value: "BXB",
  },
  {
    label: "Bruce Grove",
    value: "BCV",
  },
  {
    label: "Brundall",
    value: "BDA",
  },
  {
    label: "Brundall Gardens",
    value: "BGA",
  },
  {
    label: "Brunstane",
    value: "BSU",
  },
  {
    label: "Brunswick",
    value: "BRW",
  },
  {
    label: "Brussels Midi",
    value: "BXS",
  },
  {
    label: "Bruton",
    value: "BRU",
  },
  {
    label: "Bryn",
    value: "BYN",
  },
  {
    label: "Buckenham",
    value: "BUC",
  },
  {
    label: "Buckingham (Bus)",
    value: "XEY",
  },
  {
    label: "Buckley",
    value: "BCK",
  },
  {
    label: "Bucknell",
    value: "BUK",
  },
  {
    label: "Buckshaw Parkway",
    value: "BSV",
  },
  {
    label: "Bude Strand (Bus)",
    value: "BUA",
  },
  {
    label: "Bugle",
    value: "BGL",
  },
  {
    label: "Builth Road",
    value: "BHR",
  },
  {
    label: "Bulwell",
    value: "BLW",
  },
  {
    label: "Bures",
    value: "BUE",
  },
  {
    label: "Burgess Hill",
    value: "BUG",
  },
  {
    label: "Burley Park",
    value: "BUY",
  },
  {
    label: "Burley-in-Wharfedale",
    value: "BUW",
  },
  {
    label: "Burnage",
    value: "BNA",
  },
  {
    label: "Burneside",
    value: "BUD",
  },
  {
    label: "Burnham",
    value: "BNM",
  },
  {
    label: "Burnham Market (Bus)",
    value: "BMK",
  },
  {
    label: "Burnham-on-Crouch",
    value: "BUU",
  },
  {
    label: "Burnley Barracks",
    value: "BUB",
  },
  {
    label: "Burnley Central",
    value: "BNC",
  },
  {
    label: "Burnley Manchester Road",
    value: "BYM",
  },
  {
    label: "Burnside",
    value: "BUI",
  },
  {
    label: "Burntisland",
    value: "BTS",
  },
  {
    label: "Burscough Bridge",
    value: "BCB",
  },
  {
    label: "Burscough Junction",
    value: "BCJ",
  },
  {
    label: "Bursledon",
    value: "BUO",
  },
  {
    label: "Burton Joyce",
    value: "BUJ",
  },
  {
    label: "Burton-on-Trent",
    value: "BUT",
  },
  {
    label: "Bury Metrolink (Bus)",
    value: "BUR",
  },
  {
    label: "Bury St Edmunds",
    value: "BSE",
  },
  {
    label: "Busby",
    value: "BUS",
  },
  {
    label: "Bush Hill Park",
    value: "BHK",
  },
  {
    label: "Bushey",
    value: "BSH",
  },
  {
    label: "Butlers Lane",
    value: "BUL",
  },
  {
    label: "Buxted",
    value: "BXD",
  },
  {
    label: "Buxton",
    value: "BUX",
  },
  {
    label: "Buxton (Bus)",
    value: "BUZ",
  },
  {
    label: "Byfleet & New Haw",
    value: "BFN",
  },
  {
    label: "Bynea",
    value: "BYE",
  },
  {
    label: "Cadoxton",
    value: "CAD",
  },
  {
    label: "Caerau Park (Bus)",
    value: "XKC",
  },
  {
    label: "Caerau Square (Bus)",
    value: "CSQ",
  },
  {
    label: "Caergwrle",
    value: "CGW",
  },
  {
    label: "Caerphilly",
    value: "CPH",
  },
  {
    label: "Caersws",
    value: "CWS",
  },
  {
    label: "Cairnyan Port",
    value: "CRP",
  },
  {
    label: "Calais Frethun",
    value: "FRH",
  },
  {
    label: "Caldercruix",
    value: "CAC",
  },
  {
    label: "Caldicot",
    value: "CDT",
  },
  {
    label: "Caledonian Rd & Barnsbury",
    value: "CIR",
  },
  {
    label: "Callington (Bus)",
    value: "XAH",
  },
  {
    label: "Calne (Bus)",
    value: "XAI",
  },
  {
    label: "Calstock",
    value: "CSK",
  },
  {
    label: "Cam & Dursley",
    value: "CDU",
  },
  {
    label: "Camberley",
    value: "CAM",
  },
  {
    label: "Camborne",
    value: "CBN",
  },
  {
    label: "Cambridge",
    value: "CBG",
  },
  {
    label: "Cambridge (Bus)",
    value: "XEC",
  },
  {
    label: "Cambridge Heath",
    value: "CBH",
  },
  {
    label: "Cambridge North",
    value: "CMB",
  },
  {
    label: "Cambuslang",
    value: "CBL",
  },
  {
    label: "Camden Road",
    value: "CMD",
  },
  {
    label: "Camelon",
    value: "CMO",
  },
  {
    label: "Canada Water",
    value: "ZCW",
  },
  {
    label: "Canary Wharf",
    value: "CWF",
  },
  {
    label: "Canley",
    value: "CNL",
  },
  {
    label: "Canna (Bus)",
    value: "CNA",
  },
  {
    label: "Cannock",
    value: "CAO",
  },
  {
    label: "Canonbury",
    value: "CNN",
  },
  {
    label: "Canterbury East",
    value: "CBE",
  },
  {
    label: "Canterbury West",
    value: "CBW",
  },
  {
    label: "Cantley",
    value: "CNY",
  },
  {
    label: "Capenhurst",
    value: "CPU",
  },
  {
    label: "Carbis Bay",
    value: "CBB",
  },
  {
    label: "Carbrook (Tram)",
    value: "CAE",
  },
  {
    label: "Cardenden",
    value: "CDD",
  },
  {
    label: "Cardiff Bay",
    value: "CDB",
  },
  {
    label: "Cardiff Central",
    value: "CDF",
  },
  {
    label: "Cardiff Central Bus Stn",
    value: "CCB",
  },
  {
    label: "Cardiff Intl Airport (Bus)",
    value: "XCF",
  },
  {
    label: "Cardiff Queen Street",
    value: "CDQ",
  },
  {
    label: "Cardonald",
    value: "CDO",
  },
  {
    label: "Cardross",
    value: "CDR",
  },
  {
    label: "Carfin",
    value: "CRF",
  },
  {
    label: "Cark",
    value: "CAK",
  },
  {
    label: "Carlisle",
    value: "CAR",
  },
  {
    label: "Carlton",
    value: "CTO",
  },
  {
    label: "Carluke",
    value: "CLU",
  },
  {
    label: "Carmarthen",
    value: "CMN",
  },
  {
    label: "Carmyle",
    value: "CML",
  },
  {
    label: "Carnforth",
    value: "CNF",
  },
  {
    label: "Carnoustie",
    value: "CAN",
  },
  {
    label: "Carntyne",
    value: "CAY",
  },
  {
    label: "Carpenders Park",
    value: "CPK",
  },
  {
    label: "Carrbridge",
    value: "CAG",
  },
  {
    label: "Carshalton",
    value: "CSH",
  },
  {
    label: "Carshalton Beeches",
    value: "CSB",
  },
  {
    label: "Carstairs",
    value: "CRS",
  },
  {
    label: "Cartsdyke",
    value: "CDY",
  },
  {
    label: "Castle Bar Park",
    value: "CBP",
  },
  {
    label: "Castle Cary",
    value: "CLC",
  },
  {
    label: "Castle Howard (Bus)",
    value: "CAQ",
  },
  {
    label: "Castle Square (Tram)",
    value: "CAX",
  },
  {
    label: "Castlebay, Barra (Bus)",
    value: "CTB",
  },
  {
    label: "Castleford",
    value: "CFD",
  },
  {
    label: "Castleton",
    value: "CAS",
  },
  {
    label: "Castleton Moor",
    value: "CSM",
  },
  {
    label: "Caterham",
    value: "CAT",
  },
  {
    label: "Catford",
    value: "CTF",
  },
  {
    label: "Catford Bridge",
    value: "CFB",
  },
  {
    label: "Cathays",
    value: "CYS",
  },
  {
    label: "Cathcart",
    value: "CCT",
  },
  {
    label: "Cattal",
    value: "CTL",
  },
  {
    label: "Catterick Camp Centre (Bus)",
    value: "XGO",
  },
  {
    label: "Catterick Garrison (Bus)",
    value: "CAZ",
  },
  {
    label: "Catterick Garrison Tesco (Bus)",
    value: "CGT",
  },
  {
    label: "Causeland",
    value: "CAU",
  },
  {
    label: "Cefn-y-Bedd",
    value: "CYB",
  },
  {
    label: "Chadwell Heath",
    value: "CTH",
  },
  {
    label: "Chafford Hundred",
    value: "CFH",
  },
  {
    label: "Chalfont & Latimer",
    value: "CFO",
  },
  {
    label: "Chalkwell",
    value: "CHW",
  },
  {
    label: "Chandlers Ford",
    value: "CFR",
  },
  {
    label: "Chapel-en-le-Frith",
    value: "CEF",
  },
  {
    label: "Chapeltown",
    value: "CLN",
  },
  {
    label: "Chapleton",
    value: "CPN",
  },
  {
    label: "Chappel & Wakes Colne",
    value: "CWC",
  },
  {
    label: "Charing",
    value: "CHG",
  },
  {
    label: "Charing Cross (Glasgow)",
    value: "CHC",
  },
  {
    label: "Charlbury",
    value: "CBY",
  },
  {
    label: "Charlton",
    value: "CTN",
  },
  {
    label: "Chartham",
    value: "CRT",
  },
  {
    label: "Chassen Road",
    value: "CSR",
  },
  {
    label: "Chatelherault",
    value: "CTE",
  },
  {
    label: "Chatham",
    value: "CTM",
  },
  {
    label: "Chathill",
    value: "CHT",
  },
  {
    label: "Chatsworth House (Bus)",
    value: "CHZ",
  },
  {
    label: "Cheadle Hulme",
    value: "CHU",
  },
  {
    label: "Cheam",
    value: "CHE",
  },
  {
    label: "Cheddington",
    value: "CED",
  },
  {
    label: "Chelford",
    value: "CEL",
  },
  {
    label: "Chelmsford",
    value: "CHM",
  },
  {
    label: "Chelsfield",
    value: "CLD",
  },
  {
    label: "Cheltenham Spa",
    value: "CNM",
  },
  {
    label: "Chepstow",
    value: "CPW",
  },
  {
    label: "Cherry Tree",
    value: "CYT",
  },
  {
    label: "Chertsey",
    value: "CHY",
  },
  {
    label: "Cheshunt",
    value: "CHN",
  },
  {
    label: "Chessington North",
    value: "CSN",
  },
  {
    label: "Chessington South",
    value: "CSS",
  },
  {
    label: "Chester",
    value: "CTR",
  },
  {
    label: "Chester Road",
    value: "CRD",
  },
  {
    label: "Chester-le-Street",
    value: "CLS",
  },
  {
    label: "Chesterfield",
    value: "CHD",
  },
  {
    label: "Chestfield & Swalecliffe",
    value: "CSW",
  },
  {
    label: "Chetnole",
    value: "CNO",
  },
  {
    label: "Chichester",
    value: "CCH",
  },
  {
    label: "Chilham",
    value: "CIL",
  },
  {
    label: "Chilworth",
    value: "CHL",
  },
  {
    label: "Chingford",
    value: "CHI",
  },
  {
    label: "Chinley",
    value: "CLY",
  },
  {
    label: "Chinnor (Bus)",
    value: "XCQ",
  },
  {
    label: "Chippenham",
    value: "CPM",
  },
  {
    label: "Chippenham Bath Road (Bus)",
    value: "XDM",
  },
  {
    label: "Chippenham New Road (Bus)",
    value: "XDN",
  },
  {
    label: "Chipping Norton West St (Bus)",
    value: "CPG",
  },
  {
    label: "Chipstead",
    value: "CHP",
  },
  {
    label: "Chirk",
    value: "CRK",
  },
  {
    label: "Chislehurst",
    value: "CIT",
  },
  {
    label: "Chiswick",
    value: "CHK",
  },
  {
    label: "Cholsey",
    value: "CHO",
  },
  {
    label: "Chorley",
    value: "CRL",
  },
  {
    label: "Chorleywood",
    value: "CLW",
  },
  {
    label: "Christchurch",
    value: "CHR",
  },
  {
    label: "Christs Hospital",
    value: "CHH",
  },
  {
    label: "Church & Oswaldtwistle",
    value: "CTW",
  },
  {
    label: "Church Fenton",
    value: "CHF",
  },
  {
    label: "Church Stretton",
    value: "CTT",
  },
  {
    label: "Cilmeri",
    value: "CIM",
  },
  {
    label: "City Thameslink",
    value: "CTK",
  },
  {
    label: "Clacton-on-Sea",
    value: "CLT",
  },
  {
    label: "Clandon",
    value: "CLA",
  },
  {
    label: "Clapham (North Yorkshire)",
    value: "CPY",
  },
  {
    label: "Clapham High Street",
    value: "CLP",
  },
  {
    label: "Clapham Junction",
    value: "CLJ",
  },
  {
    label: "Clapton",
    value: "CPT",
  },
  {
    label: "Clarbeston Road",
    value: "CLR",
  },
  {
    label: "Clarkston",
    value: "CKS",
  },
  {
    label: "Claverdon",
    value: "CLV",
  },
  {
    label: "Claygate",
    value: "CLG",
  },
  {
    label: "Cleethorpes",
    value: "CLE",
  },
  {
    label: "Cleland",
    value: "CEA",
  },
  {
    label: "Clifton",
    value: "CLI",
  },
  {
    label: "Clifton Down",
    value: "CFN",
  },
  {
    label: "Clitheroe",
    value: "CLH",
  },
  {
    label: "Clock House",
    value: "CLK",
  },
  {
    label: "Clunderwen",
    value: "CUW",
  },
  {
    label: "Clydebank",
    value: "CYK",
  },
  {
    label: "Coatbridge Central",
    value: "CBC",
  },
  {
    label: "Coatbridge Sunnyside",
    value: "CBS",
  },
  {
    label: "Coatdyke",
    value: "COA",
  },
  {
    label: "Cobham & Stoke d'Abernon",
    value: "CSD",
  },
  {
    label: "Cockermouth (Bus)",
    value: "COX",
  },
  {
    label: "Cockfosters Underground",
    value: "ZCK",
  },
  {
    label: "Codsall",
    value: "CSL",
  },
  {
    label: "Cogan",
    value: "CGN",
  },
  {
    label: "Colchester",
    value: "COL",
  },
  {
    label: "Colchester Town",
    value: "CET",
  },
  {
    label: "Coleshill Parkway",
    value: "CEH",
  },
  {
    label: "Coll (Bus)",
    value: "CLO",
  },
  {
    label: "Collingham",
    value: "CLM",
  },
  {
    label: "Collington",
    value: "CLL",
  },
  {
    label: "Colne",
    value: "CNE",
  },
  {
    label: "Colonsay (Bus)",
    value: "CYA",
  },
  {
    label: "Colwall",
    value: "CWL",
  },
  {
    label: "Colwyn Bay",
    value: "CWB",
  },
  {
    label: "Combe",
    value: "CME",
  },
  {
    label: "Commondale",
    value: "COM",
  },
  {
    label: "Congleton",
    value: "CNG",
  },
  {
    label: "Conisbrough",
    value: "CNS",
  },
  {
    label: "Connel Ferry",
    value: "CON",
  },
  {
    label: "Conon Bridge",
    value: "CBD",
  },
  {
    label: "Cononley",
    value: "CEY",
  },
  {
    label: "Conway Park",
    value: "CNP",
  },
  {
    label: "Conwy",
    value: "CNW",
  },
  {
    label: "Cooden Beach",
    value: "COB",
  },
  {
    label: "Cookham",
    value: "COO",
  },
  {
    label: "Cooksbridge",
    value: "CBR",
  },
  {
    label: "Coombe Junction Halt",
    value: "COE",
  },
  {
    label: "Copplestone",
    value: "COP",
  },
  {
    label: "Corbridge",
    value: "CRB",
  },
  {
    label: "Corby",
    value: "COR",
  },
  {
    label: "Corby George Street (Bus)",
    value: "CBZ",
  },
  {
    label: "Corfe Castle",
    value: "CFC",
  },
  {
    label: "Corkerhill",
    value: "CKH",
  },
  {
    label: "Corkickle",
    value: "CKL",
  },
  {
    label: "Corpach",
    value: "CPA",
  },
  {
    label: "Corrour",
    value: "CRR",
  },
  {
    label: "Corsham (Bus)",
    value: "XAO",
  },
  {
    label: "Coryton",
    value: "COY",
  },
  {
    label: "Coseley",
    value: "CSY",
  },
  {
    label: "Cosford",
    value: "COS",
  },
  {
    label: "Cosham",
    value: "CSA",
  },
  {
    label: "Cottingham",
    value: "CGM",
  },
  {
    label: "Cottingley",
    value: "COT",
  },
  {
    label: "Coulsdon South",
    value: "CDS",
  },
  {
    label: "Coulsdon Town",
    value: "CDN",
  },
  {
    label: "Coventry",
    value: "COV",
  },
  {
    label: "Coventry Arena",
    value: "CAA",
  },
  {
    label: "Cowden",
    value: "CWN",
  },
  {
    label: "Cowdenbeath",
    value: "COW",
  },
  {
    label: "Cradley Heath",
    value: "CRA",
  },
  {
    label: "Craigendoran",
    value: "CGD",
  },
  {
    label: "Craignure, Mull (Bus)",
    value: "CRU",
  },
  {
    label: "Cramlington",
    value: "CRM",
  },
  {
    label: "Cranbrook (Devon)",
    value: "CBK",
  },
  {
    label: "Craven Arms",
    value: "CRV",
  },
  {
    label: "Crawley",
    value: "CRW",
  },
  {
    label: "Crayford",
    value: "CRY",
  },
  {
    label: "Crediton",
    value: "CDI",
  },
  {
    label: "Cressing",
    value: "CES",
  },
  {
    label: "Cressington",
    value: "CSG",
  },
  {
    label: "Creswell",
    value: "CWD",
  },
  {
    label: "Crewe",
    value: "CRE",
  },
  {
    label: "Crewkerne",
    value: "CKN",
  },
  {
    label: "Crews Hill",
    value: "CWH",
  },
  {
    label: "Crianlarich",
    value: "CNR",
  },
  {
    label: "Criccieth",
    value: "CCC",
  },
  {
    label: "Cricket Inn Road (Tram)",
    value: "CIN",
  },
  {
    label: "Cricklewood",
    value: "CRI",
  },
  {
    label: "Croftfoot",
    value: "CFF",
  },
  {
    label: "Crofton Park",
    value: "CFT",
  },
  {
    label: "Cromer",
    value: "CMR",
  },
  {
    label: "Cromford",
    value: "CMF",
  },
  {
    label: "Crookston",
    value: "CKT",
  },
  {
    label: "Cross Gates",
    value: "CRG",
  },
  {
    label: "Crossflatts",
    value: "CFL",
  },
  {
    label: "Crosshill",
    value: "COI",
  },
  {
    label: "Crosskeys",
    value: "CKY",
  },
  {
    label: "Crossmyloof",
    value: "CMY",
  },
  {
    label: "Croston",
    value: "CSO",
  },
  {
    label: "Crouch Hill",
    value: "CRH",
  },
  {
    label: "Crowborough",
    value: "COH",
  },
  {
    label: "Crowhurst",
    value: "CWU",
  },
  {
    label: "Crowle",
    value: "CWE",
  },
  {
    label: "Crowthorne",
    value: "CRN",
  },
  {
    label: "Croxley Underground",
    value: "ZCO",
  },
  {
    label: "Croy",
    value: "CRO",
  },
  {
    label: "Crystal Palace",
    value: "CYP",
  },
  {
    label: "Cuddington",
    value: "CUD",
  },
  {
    label: "Cuffley",
    value: "CUF",
  },
  {
    label: "Culdrose RNAS (Bus)",
    value: "XAM",
  },
  {
    label: "Culham",
    value: "CUM",
  },
  {
    label: "Cullompton (Bus)",
    value: "XDX",
  },
  {
    label: "Culrain",
    value: "CUA",
  },
  {
    label: "Cumbernauld",
    value: "CUB",
  },
  {
    label: "Cumbrae Slip (Bus)",
    value: "CUL",
  },
  {
    label: "Cupar",
    value: "CUP",
  },
  {
    label: "Curriehill",
    value: "CUH",
  },
  {
    label: "Custom House",
    value: "CUS",
  },
  {
    label: "Cuxton",
    value: "CUX",
  },
  {
    label: "Cwmbach",
    value: "CMH",
  },
  {
    label: "Cwmbran",
    value: "CWM",
  },
  {
    label: "Cynghordy",
    value: "CYN",
  },
  {
    label: "Dagenham Dock",
    value: "DDK",
  },
  {
    label: "Dagenham East Underground",
    value: "ZDE",
  },
  {
    label: "Daisy Hill",
    value: "DSY",
  },
  {
    label: "Dalgety Bay",
    value: "DAG",
  },
  {
    label: "Dalmally",
    value: "DAL",
  },
  {
    label: "Dalmarnock",
    value: "DAK",
  },
  {
    label: "Dalmeny",
    value: "DAM",
  },
  {
    label: "Dalmuir",
    value: "DMR",
  },
  {
    label: "Dalreoch",
    value: "DLR",
  },
  {
    label: "Dalry",
    value: "DLY",
  },
  {
    label: "Dalston",
    value: "DLS",
  },
  {
    label: "Dalston Junction",
    value: "DLJ",
  },
  {
    label: "Dalston Kingsland",
    value: "DLK",
  },
  {
    label: "Dalton",
    value: "DLT",
  },
  {
    label: "Dalwhinnie",
    value: "DLW",
  },
  {
    label: "Danby",
    value: "DNY",
  },
  {
    label: "Danescourt",
    value: "DCT",
  },
  {
    label: "Danzey",
    value: "DZY",
  },
  {
    label: "Darfield (Bus)",
    value: "DFZ",
  },
  {
    label: "Darlington",
    value: "DAR",
  },
  {
    label: "Darnall",
    value: "DAN",
  },
  {
    label: "Darsham",
    value: "DSM",
  },
  {
    label: "Dartford",
    value: "DFD",
  },
  {
    label: "Dartmouth (Bus)",
    value: "XAP",
  },
  {
    label: "Darton",
    value: "DRT",
  },
  {
    label: "Darwen",
    value: "DWN",
  },
  {
    label: "Datchet",
    value: "DAT",
  },
  {
    label: "Davenport",
    value: "DVN",
  },
  {
    label: "Dawlish",
    value: "DWL",
  },
  {
    label: "Dawlish Warren",
    value: "DWW",
  },
  {
    label: "Deal",
    value: "DEA",
  },
  {
    label: "Dean",
    value: "DEN",
  },
  {
    label: "Dean Lane",
    value: "DNN",
  },
  {
    label: "Deansgate",
    value: "DGT",
  },
  {
    label: "Deganwy",
    value: "DGY",
  },
  {
    label: "Deighton",
    value: "DHN",
  },
  {
    label: "Delamere",
    value: "DLM",
  },
  {
    label: "Denby Dale",
    value: "DBD",
  },
  {
    label: "Denham",
    value: "DNM",
  },
  {
    label: "Denham Golf Club",
    value: "DGC",
  },
  {
    label: "Denmark Hill",
    value: "DMK",
  },
  {
    label: "Dent",
    value: "DNT",
  },
  {
    label: "Denton",
    value: "DTN",
  },
  {
    label: "Deptford",
    value: "DEP",
  },
  {
    label: "Derby",
    value: "DBY",
  },
  {
    label: "Derby Road",
    value: "DBR",
  },
  {
    label: "Dereham Market Place (Bus)",
    value: "DEB",
  },
  {
    label: "Derker",
    value: "DKR",
  },
  {
    label: "Devizes (Bus)",
    value: "XAQ",
  },
  {
    label: "Devonport",
    value: "DPT",
  },
  {
    label: "Dewsbury",
    value: "DEW",
  },
  {
    label: "Didcot Parkway",
    value: "DID",
  },
  {
    label: "Digby & Sowton",
    value: "DIG",
  },
  {
    label: "Dilton Marsh",
    value: "DMH",
  },
  {
    label: "Dinas Powys",
    value: "DNS",
  },
  {
    label: "Dinas Rhondda",
    value: "DMG",
  },
  {
    label: "Dingle Road",
    value: "DGL",
  },
  {
    label: "Dingwall",
    value: "DIN",
  },
  {
    label: "Dinsdale",
    value: "DND",
  },
  {
    label: "Dinting",
    value: "DTG",
  },
  {
    label: "Disley",
    value: "DSL",
  },
  {
    label: "Diss",
    value: "DIS",
  },
  {
    label: "Dockyard",
    value: "DOC",
  },
  {
    label: "Dodworth",
    value: "DOD",
  },
  {
    label: "Dolau",
    value: "DOL",
  },
  {
    label: "Doleham",
    value: "DLH",
  },
  {
    label: "Dolgarrog",
    value: "DLG",
  },
  {
    label: "Dolwyddelan",
    value: "DWD",
  },
  {
    label: "Doncaster",
    value: "DON",
  },
  {
    label: "Doncaster North Bus Stn",
    value: "DOZ",
  },
  {
    label: "Dorchester South",
    value: "DCH",
  },
  {
    label: "Dorchester West",
    value: "DCW",
  },
  {
    label: "Dore",
    value: "DOR",
  },
  {
    label: "Dorking",
    value: "DKG",
  },
  {
    label: "Dorking Deepdene",
    value: "DPD",
  },
  {
    label: "Dorking West",
    value: "DKT",
  },
  {
    label: "Dormans",
    value: "DMS",
  },
  {
    label: "Dorridge",
    value: "DDG",
  },
  {
    label: "Douglas (Isle of Man)",
    value: "DGS",
  },
  {
    label: "Dove Holes",
    value: "DVH",
  },
  {
    label: "Dover Priory",
    value: "DVP",
  },
  {
    label: "Dovercourt",
    value: "DVC",
  },
  {
    label: "Dovey Junction",
    value: "DVY",
  },
  {
    label: "Downham Market",
    value: "DOW",
  },
  {
    label: "Drayton Green",
    value: "DRG",
  },
  {
    label: "Drayton Park",
    value: "DYP",
  },
  {
    label: "Drem",
    value: "DRM",
  },
  {
    label: "Driffield",
    value: "DRF",
  },
  {
    label: "Drigg",
    value: "DRI",
  },
  {
    label: "Droitwich Spa",
    value: "DTW",
  },
  {
    label: "Dronfield",
    value: "DRO",
  },
  {
    label: "Drumchapel",
    value: "DMC",
  },
  {
    label: "Drumfrochar",
    value: "DFR",
  },
  {
    label: "Drumgelloch",
    value: "DRU",
  },
  {
    label: "Drumry",
    value: "DMY",
  },
  {
    label: "Dublin Ferryport",
    value: "DFP",
  },
  {
    label: "Dublin Port (Stena)",
    value: "DPS",
  },
  {
    label: "Duddeston",
    value: "DUD",
  },
  {
    label: "Dudley Port",
    value: "DDP",
  },
  {
    label: "Duffield",
    value: "DFI",
  },
  {
    label: "Duirinish",
    value: "DRN",
  },
  {
    label: "Duke Street",
    value: "DST",
  },
  {
    label: "Dullingham",
    value: "DUL",
  },
  {
    label: "Dumbarton Central",
    value: "DBC",
  },
  {
    label: "Dumbarton East",
    value: "DBE",
  },
  {
    label: "Dumbreck",
    value: "DUM",
  },
  {
    label: "Dumfries",
    value: "DMF",
  },
  {
    label: "Dumpton Park",
    value: "DMP",
  },
  {
    label: "Dun Laoghaire",
    value: "DLO",
  },
  {
    label: "Dunbar",
    value: "DUN",
  },
  {
    label: "Dunblane",
    value: "DBL",
  },
  {
    label: "Duncraig",
    value: "DCG",
  },
  {
    label: "Dundee",
    value: "DEE",
  },
  {
    label: "Dunfermline Queen Margaret",
    value: "DFL",
  },
  {
    label: "Dunfermline Town",
    value: "DFE",
  },
  {
    label: "Dunkeld & Birnam",
    value: "DKD",
  },
  {
    label: "Dunlop",
    value: "DNL",
  },
  {
    label: "Dunoon (Bus)",
    value: "DUO",
  },
  {
    label: "Dunrobin Castle",
    value: "DNO",
  },
  {
    label: "Duns (Bus)",
    value: "DUU",
  },
  {
    label: "Dunstable (Bus)",
    value: "XAD",
  },
  {
    label: "Dunster (Bus)",
    value: "XDY",
  },
  {
    label: "Dunston",
    value: "DOT",
  },
  {
    label: "Dunton Green",
    value: "DNG",
  },
  {
    label: "Durham",
    value: "DHM",
  },
  {
    label: "Durrington-on-Sea",
    value: "DUR",
  },
  {
    label: "Dyce",
    value: "DYC",
  },
  {
    label: "Dyffryn Ardudwy",
    value: "DYF",
  },
  {
    label: "Eaglescliffe",
    value: "EAG",
  },
  {
    label: "Ealing Broadway",
    value: "EAL",
  },
  {
    label: "Earl's Court Underground",
    value: "ZET",
  },
  {
    label: "Earlestown",
    value: "ERL",
  },
  {
    label: "Earley",
    value: "EAR",
  },
  {
    label: "Earlsfield",
    value: "EAD",
  },
  {
    label: "Earlston, Borders (Bus)",
    value: "EAS",
  },
  {
    label: "Earlswood (Surrey)",
    value: "ELD",
  },
  {
    label: "Earlswood (West Midlands)",
    value: "EWD",
  },
  {
    label: "East Boldon (T & W Metro)",
    value: "EBL",
  },
  {
    label: "East Croydon",
    value: "ECR",
  },
  {
    label: "East Didsbury",
    value: "EDY",
  },
  {
    label: "East Dulwich",
    value: "EDW",
  },
  {
    label: "East Farleigh",
    value: "EFL",
  },
  {
    label: "East Garforth",
    value: "EGF",
  },
  {
    label: "East Grinstead",
    value: "EGR",
  },
  {
    label: "East Kilbride",
    value: "EKL",
  },
  {
    label: "East Malling",
    value: "EML",
  },
  {
    label: "East Midlands Airport (Bus)",
    value: "EMA",
  },
  {
    label: "East Midlands Parkway",
    value: "EMD",
  },
  {
    label: "East Tilbury",
    value: "ETL",
  },
  {
    label: "East Worthing",
    value: "EWR",
  },
  {
    label: "Eastbourne",
    value: "EBN",
  },
  {
    label: "Eastbrook",
    value: "EBK",
  },
  {
    label: "Easterhouse",
    value: "EST",
  },
  {
    label: "Eastham Rake",
    value: "ERA",
  },
  {
    label: "Eastleigh",
    value: "ESL",
  },
  {
    label: "Eastrington",
    value: "EGN",
  },
  {
    label: "Ebbsfleet International",
    value: "EBD",
  },
  {
    label: "Ebbw Vale Parkway",
    value: "EBV",
  },
  {
    label: "Ebbw Vale Town",
    value: "EBB",
  },
  {
    label: "Eccles",
    value: "ECC",
  },
  {
    label: "Eccles Road",
    value: "ECS",
  },
  {
    label: "Eccleston Park",
    value: "ECL",
  },
  {
    label: "Edale",
    value: "EDL",
  },
  {
    label: "Eden Camp (Bus)",
    value: "EDZ",
  },
  {
    label: "Eden Park",
    value: "EDN",
  },
  {
    label: "Eden Project (Bus)",
    value: "XFJ",
  },
  {
    label: "Edenbridge",
    value: "EBR",
  },
  {
    label: "Edenbridge Town",
    value: "EBT",
  },
  {
    label: "Edge Hill",
    value: "EDG",
  },
  {
    label: "Edinburgh",
    value: "EDB",
  },
  {
    label: "Edinburgh Airport (Bus or Tram",
    value: "EDA",
  },
  {
    label: "Edinburgh Bus Station",
    value: "EBS",
  },
  {
    label: "Edinburgh Gateway",
    value: "EGY",
  },
  {
    label: "Edinburgh Park",
    value: "EDP",
  },
  {
    label: "Edmonton Green",
    value: "EDR",
  },
  {
    label: "Effingham Junction",
    value: "EFF",
  },
  {
    label: "Eggesford",
    value: "EGG",
  },
  {
    label: "Egham",
    value: "EGH",
  },
  {
    label: "Egton",
    value: "EGT",
  },
  {
    label: "Eigg (Bus)",
    value: "EIG",
  },
  {
    label: "Elephant & Castle",
    value: "EPH",
  },
  {
    label: "Elephant & Castle Underground",
    value: "ZEL",
  },
  {
    label: "Elgin",
    value: "ELG",
  },
  {
    label: "Ellesmere Port",
    value: "ELP",
  },
  {
    label: "Elmers End",
    value: "ELE",
  },
  {
    label: "Elmstead Woods",
    value: "ESD",
  },
  {
    label: "Elmswell",
    value: "ESW",
  },
  {
    label: "Elsecar",
    value: "ELR",
  },
  {
    label: "Elsenham",
    value: "ESM",
  },
  {
    label: "Elstree & Borehamwood",
    value: "ELS",
  },
  {
    label: "Eltham",
    value: "ELW",
  },
  {
    label: "Elton & Orston",
    value: "ELO",
  },
  {
    label: "Ely",
    value: "ELY",
  },
  {
    label: "Emerson Park",
    value: "EMP",
  },
  {
    label: "Emsworth",
    value: "EMS",
  },
  {
    label: "Energlyn & Churchill Park",
    value: "ECP",
  },
  {
    label: "Enfield Chase",
    value: "ENC",
  },
  {
    label: "Enfield Lock",
    value: "ENL",
  },
  {
    label: "Enfield Town",
    value: "ENF",
  },
  {
    label: "Entwistle",
    value: "ENT",
  },
  {
    label: "Epsom",
    value: "EPS",
  },
  {
    label: "Epsom Downs",
    value: "EPD",
  },
  {
    label: "Erdington",
    value: "ERD",
  },
  {
    label: "Eridge",
    value: "ERI",
  },
  {
    label: "Erith",
    value: "ERH",
  },
  {
    label: "Esher",
    value: "ESH",
  },
  {
    label: "Eskbank",
    value: "EKB",
  },
  {
    label: "Essex Road",
    value: "EXR",
  },
  {
    label: "Etchingham",
    value: "ETC",
  },
  {
    label: "Euxton Balshaw Lane",
    value: "EBA",
  },
  {
    label: "Evesham",
    value: "EVE",
  },
  {
    label: "Ewell East",
    value: "EWE",
  },
  {
    label: "Ewell West",
    value: "EWW",
  },
  {
    label: "Exeter Airport (Bus)",
    value: "XXT",
  },
  {
    label: "Exeter Central",
    value: "EXC",
  },
  {
    label: "Exeter St Davids",
    value: "EXD",
  },
  {
    label: "Exeter St Thomas",
    value: "EXT",
  },
  {
    label: "Exhibition Centre",
    value: "EXG",
  },
  {
    label: "Exmouth",
    value: "EXM",
  },
  {
    label: "Exton",
    value: "EXN",
  },
  {
    label: "Eynsford",
    value: "EYN",
  },
  {
    label: "Eynsham Church (Bus)",
    value: "EYM",
  },
  {
    label: "Failsworth",
    value: "FLS",
  },
  {
    label: "Fairbourne",
    value: "FRB",
  },
  {
    label: "Fairfield",
    value: "FRF",
  },
  {
    label: "Fairlie",
    value: "FRL",
  },
  {
    label: "Fairwater",
    value: "FRW",
  },
  {
    label: "Falconwood",
    value: "FCN",
  },
  {
    label: "Falkirk Grahamston",
    value: "FKG",
  },
  {
    label: "Falkirk High",
    value: "FKK",
  },
  {
    label: "Falls of Cruachan",
    value: "FOC",
  },
  {
    label: "Falmer",
    value: "FMR",
  },
  {
    label: "Falmouth Docks",
    value: "FAL",
  },
  {
    label: "Falmouth Town",
    value: "FMT",
  },
  {
    label: "Fareham",
    value: "FRM",
  },
  {
    label: "Farnborough (Main)",
    value: "FNB",
  },
  {
    label: "Farnborough North",
    value: "FNN",
  },
  {
    label: "Farncombe",
    value: "FNC",
  },
  {
    label: "Farnham",
    value: "FNH",
  },
  {
    label: "Farningham Road",
    value: "FNR",
  },
  {
    label: "Farnworth",
    value: "FNW",
  },
  {
    label: "Farringdon",
    value: "ZFD",
  },
  {
    label: "Farringdon (Crossrail)",
    value: "FAC",
  },
  {
    label: "Fauldhouse",
    value: "FLD",
  },
  {
    label: "Faversham",
    value: "FAV",
  },
  {
    label: "Faygate",
    value: "FGT",
  },
  {
    label: "Fazakerley",
    value: "FAZ",
  },
  {
    label: "Fearn",
    value: "FRN",
  },
  {
    label: "Featherstone",
    value: "FEA",
  },
  {
    label: "Felixstowe",
    value: "FLX",
  },
  {
    label: "Fellgate (T & W Metro)",
    value: "FEG",
  },
  {
    label: "Feltham",
    value: "FEL",
  },
  {
    label: "Feniton",
    value: "FNT",
  },
  {
    label: "Fenny Stratford",
    value: "FEN",
  },
  {
    label: "Fernhill",
    value: "FER",
  },
  {
    label: "Ferriby",
    value: "FRY",
  },
  {
    label: "Ferryside",
    value: "FYS",
  },
  {
    label: "Ffairfach",
    value: "FFA",
  },
  {
    label: "Filey",
    value: "FIL",
  },
  {
    label: "Filton Abbey Wood",
    value: "FIT",
  },
  {
    label: "Finchley Road & Frognal",
    value: "FNY",
  },
  {
    label: "Finsbury Park",
    value: "FPK",
  },
  {
    label: "Finstock",
    value: "FIN",
  },
  {
    label: "Fishbourne (West Sussex)",
    value: "FSB",
  },
  {
    label: "Fishersgate",
    value: "FSG",
  },
  {
    label: "Fishguard & Goodwick",
    value: "FGW",
  },
  {
    label: "Fishguard Harbour",
    value: "FGH",
  },
  {
    label: "Fiskerton",
    value: "FSK",
  },
  {
    label: "Fitzalan Square (Tram)",
    value: "FIZ",
  },
  {
    label: "Fitzwilliam",
    value: "FZW",
  },
  {
    label: "Five Ways",
    value: "FWY",
  },
  {
    label: "Flamingo Land (Bus)",
    value: "FLZ",
  },
  {
    label: "Fleet",
    value: "FLE",
  },
  {
    label: "Flimby",
    value: "FLM",
  },
  {
    label: "Flint",
    value: "FLN",
  },
  {
    label: "Flitwick",
    value: "FLT",
  },
  {
    label: "Flixton",
    value: "FLI",
  },
  {
    label: "Flowery Field",
    value: "FLF",
  },
  {
    label: "Folkestone Central",
    value: "FKC",
  },
  {
    label: "Folkestone Harbour (Bus)",
    value: "FKH",
  },
  {
    label: "Folkestone West",
    value: "FKW",
  },
  {
    label: "Ford",
    value: "FOD",
  },
  {
    label: "Forest Gate",
    value: "FOG",
  },
  {
    label: "Forest Hill",
    value: "FOH",
  },
  {
    label: "Formby",
    value: "FBY",
  },
  {
    label: "Forres",
    value: "FOR",
  },
  {
    label: "Forsinard",
    value: "FRS",
  },
  {
    label: "Fort Matilda",
    value: "FTM",
  },
  {
    label: "Fort William",
    value: "FTW",
  },
  {
    label: "Four Oaks",
    value: "FOK",
  },
  {
    label: "Fowey (Bus)",
    value: "XAS",
  },
  {
    label: "Foxfield",
    value: "FOX",
  },
  {
    label: "Foxton",
    value: "FXN",
  },
  {
    label: "Frant",
    value: "FRT",
  },
  {
    label: "Fratton",
    value: "FTN",
  },
  {
    label: "Freshfield",
    value: "FRE",
  },
  {
    label: "Freshford",
    value: "FFD",
  },
  {
    label: "Frimley",
    value: "FML",
  },
  {
    label: "Frinton-on-Sea",
    value: "FRI",
  },
  {
    label: "Frizinghall",
    value: "FZH",
  },
  {
    label: "Frodsham",
    value: "FRD",
  },
  {
    label: "Frome",
    value: "FRO",
  },
  {
    label: "Frome Town (Bus)",
    value: "XAU",
  },
  {
    label: "Fulwell",
    value: "FLW",
  },
  {
    label: "Furness Vale",
    value: "FNV",
  },
  {
    label: "Furze Platt",
    value: "FZP",
  },
  {
    label: "Gainsborough Central",
    value: "GNB",
  },
  {
    label: "Gainsborough Lea Road",
    value: "GBL",
  },
  {
    label: "Galashiels",
    value: "GAL",
  },
  {
    label: "Galashiels (Bus)",
    value: "XAA",
  },
  {
    label: "Garelochhead",
    value: "GCH",
  },
  {
    label: "Garforth",
    value: "GRF",
  },
  {
    label: "Gargrave",
    value: "GGV",
  },
  {
    label: "Garrowhill",
    value: "GAR",
  },
  {
    label: "Garscadden",
    value: "GRS",
  },
  {
    label: "Garsdale",
    value: "GSD",
  },
  {
    label: "Garston (Hertfordshire)",
    value: "GSN",
  },
  {
    label: "Garswood",
    value: "GSW",
  },
  {
    label: "Gartcosh",
    value: "GRH",
  },
  {
    label: "Garth (Mid Glamorgan)",
    value: "GMG",
  },
  {
    label: "Garth (Powys)",
    value: "GTH",
  },
  {
    label: "Garve",
    value: "GVE",
  },
  {
    label: "Gathurst",
    value: "GST",
  },
  {
    label: "Gatley",
    value: "GTY",
  },
  {
    label: "Gatwick Airport",
    value: "GTW",
  },
  {
    label: "Georgemas Junction",
    value: "GGJ",
  },
  {
    label: "Gerrards Cross",
    value: "GER",
  },
  {
    label: "Gidea Park",
    value: "GDP",
  },
  {
    label: "Giffnock",
    value: "GFN",
  },
  {
    label: "Giggleswick",
    value: "GIG",
  },
  {
    label: "Gilberdyke",
    value: "GBD",
  },
  {
    label: "Gilfach Fargoed",
    value: "GFF",
  },
  {
    label: "Gillingham (Dorset)",
    value: "GIL",
  },
  {
    label: "Gillingham (Kent)",
    value: "GLM",
  },
  {
    label: "Gilshochill",
    value: "GSC",
  },
  {
    label: "Gipsy Hill",
    value: "GIP",
  },
  {
    label: "Girvan",
    value: "GIR",
  },
  {
    label: "Glaisdale",
    value: "GLS",
  },
  {
    label: "Glan Conwy",
    value: "GCW",
  },
  {
    label: "Glasgow Airport (Bus)",
    value: "GGT",
  },
  {
    label: "Glasgow Central",
    value: "GLC",
  },
  {
    label: "Glasgow Queen Street",
    value: "GLQ",
  },
  {
    label: "Glasshoughton",
    value: "GLH",
  },
  {
    label: "Glastonbury (Bus)",
    value: "XEA",
  },
  {
    label: "Glazebrook",
    value: "GLZ",
  },
  {
    label: "Gleneagles",
    value: "GLE",
  },
  {
    label: "Glenfinnan",
    value: "GLF",
  },
  {
    label: "Glengarnock",
    value: "GLG",
  },
  {
    label: "Glenrothes with Thornton",
    value: "GLT",
  },
  {
    label: "Glossop",
    value: "GLO",
  },
  {
    label: "Gloucester",
    value: "GCR",
  },
  {
    label: "Glynde",
    value: "GLY",
  },
  {
    label: "Goathland",
    value: "XGZ",
  },
  {
    label: "Gobowen",
    value: "GOB",
  },
  {
    label: "Godalming",
    value: "GOD",
  },
  {
    label: "Godley",
    value: "GDL",
  },
  {
    label: "Godstone",
    value: "GDN",
  },
  {
    label: "Goldthorpe",
    value: "GOE",
  },
  {
    label: "Goldthorpe (Bus)",
    value: "GOZ",
  },
  {
    label: "Golf Street",
    value: "GOF",
  },
  {
    label: "Golspie",
    value: "GOL",
  },
  {
    label: "Gomshall",
    value: "GOM",
  },
  {
    label: "Goodmayes",
    value: "GMY",
  },
  {
    label: "Goole",
    value: "GOO",
  },
  {
    label: "Goostrey",
    value: "GTR",
  },
  {
    label: "Gordon Hill",
    value: "GDH",
  },
  {
    label: "Gorebridge",
    value: "GBG",
  },
  {
    label: "Goring & Streatley",
    value: "GOR",
  },
  {
    label: "Goring-by-Sea",
    value: "GBS",
  },
  {
    label: "Gorton",
    value: "GTO",
  },
  {
    label: "Gospel Oak",
    value: "GPO",
  },
  {
    label: "Gourock",
    value: "GRK",
  },
  {
    label: "Gourock Pier (Bus)",
    value: "GXX",
  },
  {
    label: "Gowerton",
    value: "GWN",
  },
  {
    label: "Goxhill",
    value: "GOX",
  },
  {
    label: "Grange Park",
    value: "GPK",
  },
  {
    label: "Grange-over-Sands",
    value: "GOS",
  },
  {
    label: "Grangemouth (Bus)",
    value: "GGM",
  },
  {
    label: "Grangetown",
    value: "GTN",
  },
  {
    label: "Grantham",
    value: "GRA",
  },
  {
    label: "Grateley",
    value: "GRT",
  },
  {
    label: "Gravelly Hill",
    value: "GVH",
  },
  {
    label: "Gravesend",
    value: "GRV",
  },
  {
    label: "Grays",
    value: "GRY",
  },
  {
    label: "Great Ayton",
    value: "GTA",
  },
  {
    label: "Great Bentley",
    value: "GRB",
  },
  {
    label: "Great Chesterford",
    value: "GRC",
  },
  {
    label: "Great Coates",
    value: "GCT",
  },
  {
    label: "Great Malvern",
    value: "GMV",
  },
  {
    label: "Great Missenden",
    value: "GMN",
  },
  {
    label: "Great Yarmouth",
    value: "GYM",
  },
  {
    label: "Green Lane",
    value: "GNL",
  },
  {
    label: "Green Road",
    value: "GNR",
  },
  {
    label: "Greenbank",
    value: "GBK",
  },
  {
    label: "Greenfaulds",
    value: "GRL",
  },
  {
    label: "Greenfield",
    value: "GNF",
  },
  {
    label: "Greenford",
    value: "GFD",
  },
  {
    label: "Greenhithe for Bluewater",
    value: "GNH",
  },
  {
    label: "Greenock Central",
    value: "GKC",
  },
  {
    label: "Greenock West",
    value: "GKW",
  },
  {
    label: "Greenwich",
    value: "GNW",
  },
  {
    label: "Gretna Green",
    value: "GEA",
  },
  {
    label: "Grimsby Docks",
    value: "GMD",
  },
  {
    label: "Grimsby Town",
    value: "GMB",
  },
  {
    label: "Grindleford",
    value: "GRN",
  },
  {
    label: "Groombridge (Bus)",
    value: "GRO",
  },
  {
    label: "Grosmont",
    value: "GMT",
  },
  {
    label: "Grove Park",
    value: "GRP",
  },
  {
    label: "Guide Bridge",
    value: "GUI",
  },
  {
    label: "Guildford",
    value: "GLD",
  },
  {
    label: "Guiseley",
    value: "GSY",
  },
  {
    label: "Gunnersbury",
    value: "GUN",
  },
  {
    label: "Gunnislake",
    value: "GSL",
  },
  {
    label: "Gunton",
    value: "GNT",
  },
  {
    label: "Gwersyllt",
    value: "GWE",
  },
  {
    label: "Gypsy Lane",
    value: "GYP",
  },
  {
    label: "Habrough",
    value: "HAB",
  },
  {
    label: "Hackbridge",
    value: "HCB",
  },
  {
    label: "Hackney Central",
    value: "HKC",
  },
  {
    label: "Hackney Downs",
    value: "HAC",
  },
  {
    label: "Hackney Wick",
    value: "HKW",
  },
  {
    label: "Haddenham & Thame Parkway",
    value: "HDM",
  },
  {
    label: "Haddiscoe",
    value: "HAD",
  },
  {
    label: "Hadfield",
    value: "HDF",
  },
  {
    label: "Hadley Wood",
    value: "HDW",
  },
  {
    label: "Hag Fold",
    value: "HGF",
  },
  {
    label: "Haggerston",
    value: "HGG",
  },
  {
    label: "Hagley",
    value: "HAG",
  },
  {
    label: "Hairmyres",
    value: "HMY",
  },
  {
    label: "Hale",
    value: "HAL",
  },
  {
    label: "Halesworth",
    value: "HAS",
  },
  {
    label: "Halewood",
    value: "HED",
  },
  {
    label: "Halifax",
    value: "HFX",
  },
  {
    label: "Hall Green",
    value: "HLG",
  },
  {
    label: "Hall I' Th' Wood",
    value: "HID",
  },
  {
    label: "Hall Road",
    value: "HLR",
  },
  {
    label: "Halling",
    value: "HAI",
  },
  {
    label: "Haltwhistle",
    value: "HWH",
  },
  {
    label: "Ham Street",
    value: "HMT",
  },
  {
    label: "Hamble",
    value: "HME",
  },
  {
    label: "Hamilton Central",
    value: "HNC",
  },
  {
    label: "Hamilton Square",
    value: "BKQ",
  },
  {
    label: "Hamilton West",
    value: "HNW",
  },
  {
    label: "Hammersmith Underground",
    value: "ZHA",
  },
  {
    label: "Hammerton",
    value: "HMM",
  },
  {
    label: "Hampden Park",
    value: "HMD",
  },
  {
    label: "Hampstead Heath",
    value: "HDH",
  },
  {
    label: "Hampton",
    value: "HMP",
  },
  {
    label: "Hampton Court",
    value: "HMC",
  },
  {
    label: "Hampton Wick",
    value: "HMW",
  },
  {
    label: "Hampton-in-Arden",
    value: "HIA",
  },
  {
    label: "Hamstead",
    value: "HSD",
  },
  {
    label: "Hamworthy",
    value: "HAM",
  },
  {
    label: "Hanborough",
    value: "HND",
  },
  {
    label: "Handforth",
    value: "HTH",
  },
  {
    label: "Hanley (Bus)",
    value: "HNY",
  },
  {
    label: "Hanwell",
    value: "HAN",
  },
  {
    label: "Hapton",
    value: "HPN",
  },
  {
    label: "Harlech",
    value: "HRL",
  },
  {
    label: "Harlesden",
    value: "HDN",
  },
  {
    label: "Harling Road",
    value: "HRD",
  },
  {
    label: "Harlington",
    value: "HLN",
  },
  {
    label: "Harlow Mill",
    value: "HWM",
  },
  {
    label: "Harlow Town",
    value: "HWN",
  },
  {
    label: "Harold Wood",
    value: "HRO",
  },
  {
    label: "Harpenden",
    value: "HPD",
  },
  {
    label: "Harrietsham",
    value: "HRM",
  },
  {
    label: "Harringay",
    value: "HGY",
  },
  {
    label: "Harringay Green Lanes",
    value: "HRY",
  },
  {
    label: "Harrington",
    value: "HRR",
  },
  {
    label: "Harrogate",
    value: "HGT",
  },
  {
    label: "Harrow & Wealdstone",
    value: "HRW",
  },
  {
    label: "Harrow-on-the-Hill",
    value: "HOH",
  },
  {
    label: "Hartford",
    value: "HTF",
  },
  {
    label: "Hartlebury",
    value: "HBY",
  },
  {
    label: "Hartlepool",
    value: "HPL",
  },
  {
    label: "Hartwood",
    value: "HTW",
  },
  {
    label: "Harwich International",
    value: "HPQ",
  },
  {
    label: "Harwich Town",
    value: "HWC",
  },
  {
    label: "Haslemere",
    value: "HSL",
  },
  {
    label: "Hassocks",
    value: "HSK",
  },
  {
    label: "Hastings",
    value: "HGS",
  },
  {
    label: "Hatch End",
    value: "HTE",
  },
  {
    label: "Hatfield",
    value: "HAT",
  },
  {
    label: "Hatfield & Stainforth",
    value: "HFS",
  },
  {
    label: "Hatfield Peverel",
    value: "HAP",
  },
  {
    label: "Hathersage",
    value: "HSG",
  },
  {
    label: "Hattersley",
    value: "HTY",
  },
  {
    label: "Hatton",
    value: "HTN",
  },
  {
    label: "Hatton Cross (Bus)",
    value: "XHC",
  },
  {
    label: "Havant",
    value: "HAV",
  },
  {
    label: "Havenhouse",
    value: "HVN",
  },
  {
    label: "Haverfordwest",
    value: "HVF",
  },
  {
    label: "Hawarden",
    value: "HWD",
  },
  {
    label: "Hawarden Bridge",
    value: "HWB",
  },
  {
    label: "Hawick (Bus)",
    value: "HWK",
  },
  {
    label: "Hawkhead",
    value: "HKH",
  },
  {
    label: "Haworth (Bus)",
    value: "HWT",
  },
  {
    label: "Haydon Bridge",
    value: "HDB",
  },
  {
    label: "Haydons Road",
    value: "HYR",
  },
  {
    label: "Hayes (Kent)",
    value: "HYS",
  },
  {
    label: "Hayes & Harlington",
    value: "HAY",
  },
  {
    label: "Hayle",
    value: "HYL",
  },
  {
    label: "Haymarket",
    value: "HYM",
  },
  {
    label: "Haywards Heath",
    value: "HHE",
  },
  {
    label: "Hazel Grove",
    value: "HAZ",
  },
  {
    label: "Headcorn",
    value: "HCN",
  },
  {
    label: "Headingley",
    value: "HDY",
  },
  {
    label: "Headstone Lane",
    value: "HDL",
  },
  {
    label: "Heald Green",
    value: "HDG",
  },
  {
    label: "Healing",
    value: "HLI",
  },
  {
    label: "Heath High Level",
    value: "HHL",
  },
  {
    label: "Heath Low Level",
    value: "HLL",
  },
  {
    label: "Heathrow Airport T1 (Bus)",
    value: "HWO",
  },
  {
    label: "Heathrow Airport T123",
    value: "HXX",
  },
  {
    label: "Heathrow Airport T2 (Bus)",
    value: "HWA",
  },
  {
    label: "Heathrow Airport T3 (Bus)",
    value: "HWE",
  },
  {
    label: "Heathrow Airport T4",
    value: "HAF",
  },
  {
    label: "Heathrow Airport T4 (Bus)",
    value: "HWF",
  },
  {
    label: "Heathrow Airport T5",
    value: "HWV",
  },
  {
    label: "Heathrow Airport T5 (Bus)",
    value: "HWX",
  },
  {
    label: "Heathrow Central Bus Stn",
    value: "HTR",
  },
  {
    label: "Heaton Chapel",
    value: "HTC",
  },
  {
    label: "Hebden Bridge",
    value: "HBD",
  },
  {
    label: "Heckington",
    value: "HEC",
  },
  {
    label: "Hedge End",
    value: "HDE",
  },
  {
    label: "Hednesford",
    value: "HNF",
  },
  {
    label: "Heighington",
    value: "HEI",
  },
  {
    label: "Helensburgh Central",
    value: "HLC",
  },
  {
    label: "Helensburgh Upper",
    value: "HLU",
  },
  {
    label: "Hellifield",
    value: "HLD",
  },
  {
    label: "Helmsdale",
    value: "HMS",
  },
  {
    label: "Helsby",
    value: "HSB",
  },
  {
    label: "Helston (Bus)",
    value: "XAV",
  },
  {
    label: "Hemel Hempstead",
    value: "HML",
  },
  {
    label: "Hendon",
    value: "HEN",
  },
  {
    label: "Hengoed",
    value: "HNG",
  },
  {
    label: "Henley-in-Arden",
    value: "HNL",
  },
  {
    label: "Henley-on-Thames",
    value: "HOT",
  },
  {
    label: "Hensall",
    value: "HEL",
  },
  {
    label: "Hereford",
    value: "HFD",
  },
  {
    label: "Herne Bay",
    value: "HNB",
  },
  {
    label: "Herne Hill",
    value: "HNH",
  },
  {
    label: "Hersham",
    value: "HER",
  },
  {
    label: "Hertford East",
    value: "HFE",
  },
  {
    label: "Hertford North",
    value: "HFN",
  },
  {
    label: "Hessle",
    value: "HES",
  },
  {
    label: "Heswall",
    value: "HSW",
  },
  {
    label: "Hever",
    value: "HEV",
  },
  {
    label: "Heworth",
    value: "HEW",
  },
  {
    label: "Heworth (T & W Metro)",
    value: "HEZ",
  },
  {
    label: "Hexham",
    value: "HEX",
  },
  {
    label: "Heyford",
    value: "HYD",
  },
  {
    label: "Heysham Port",
    value: "HHB",
  },
  {
    label: "High Barnet",
    value: "ZHB",
  },
  {
    label: "High Brooms",
    value: "HIB",
  },
  {
    label: "High Street",
    value: "HST",
  },
  {
    label: "High Wycombe",
    value: "HWY",
  },
  {
    label: "Higham",
    value: "HGM",
  },
  {
    label: "Highams Park",
    value: "HIP",
  },
  {
    label: "Highbridge & Burnham",
    value: "HIG",
  },
  {
    label: "Highbury & Islington",
    value: "HHY",
  },
  {
    label: "Hightown",
    value: "HTO",
  },
  {
    label: "Hildenborough",
    value: "HLB",
  },
  {
    label: "Hillfoot",
    value: "HLF",
  },
  {
    label: "Hillington East",
    value: "HLE",
  },
  {
    label: "Hillington West",
    value: "HLW",
  },
  {
    label: "Hillside",
    value: "HIL",
  },
  {
    label: "Hilsea",
    value: "HLS",
  },
  {
    label: "Hinchley Wood",
    value: "HYW",
  },
  {
    label: "Hinckley",
    value: "HNK",
  },
  {
    label: "Hindley",
    value: "HIN",
  },
  {
    label: "Hinton Admiral",
    value: "HNA",
  },
  {
    label: "Hirwaun (Bus)",
    value: "XHW",
  },
  {
    label: "Hitchin",
    value: "HIT",
  },
  {
    label: "Hither Green",
    value: "HGR",
  },
  {
    label: "Hockley",
    value: "HOC",
  },
  {
    label: "Hoek Van Holland",
    value: "HVH",
  },
  {
    label: "Hollingbourne",
    value: "HBN",
  },
  {
    label: "Hollinwood",
    value: "HOD",
  },
  {
    label: "Holmes Chapel",
    value: "HCH",
  },
  {
    label: "Holmwood",
    value: "HLM",
  },
  {
    label: "Holsworthy (Bus)",
    value: "XEE",
  },
  {
    label: "Holton Heath",
    value: "HOL",
  },
  {
    label: "Holyhead",
    value: "HHD",
  },
  {
    label: "Holytown",
    value: "HLY",
  },
  {
    label: "Homerton",
    value: "HMN",
  },
  {
    label: "Honeybourne",
    value: "HYB",
  },
  {
    label: "Honiton",
    value: "HON",
  },
  {
    label: "Honley",
    value: "HOY",
  },
  {
    label: "Honor Oak Park",
    value: "HPA",
  },
  {
    label: "Hook",
    value: "HOK",
  },
  {
    label: "Hooton",
    value: "HOO",
  },
  {
    label: "Hope (Derbyshire)",
    value: "HOP",
  },
  {
    label: "Hope (Flintshire)",
    value: "HPE",
  },
  {
    label: "Hopton Heath",
    value: "HPT",
  },
  {
    label: "Horden",
    value: "HRE",
  },
  {
    label: "Horley",
    value: "HOR",
  },
  {
    label: "Hornbeam Park",
    value: "HBP",
  },
  {
    label: "Hornsey",
    value: "HRN",
  },
  {
    label: "Horsforth",
    value: "HRS",
  },
  {
    label: "Horsham",
    value: "HRH",
  },
  {
    label: "Horsley",
    value: "HSY",
  },
  {
    label: "Horton-in-Ribblesdale",
    value: "HIR",
  },
  {
    label: "Horwich Parkway",
    value: "HWI",
  },
  {
    label: "Hoscar",
    value: "HSC",
  },
  {
    label: "Hough Green",
    value: "HGN",
  },
  {
    label: "Hounslow",
    value: "HOU",
  },
  {
    label: "Hove",
    value: "HOV",
  },
  {
    label: "Hoveton & Wroxham",
    value: "HXM",
  },
  {
    label: "How Wood",
    value: "HWW",
  },
  {
    label: "Howden",
    value: "HOW",
  },
  {
    label: "Howwood",
    value: "HOZ",
  },
  {
    label: "Hoxton",
    value: "HOX",
  },
  {
    label: "Hoylake",
    value: "HYK",
  },
  {
    label: "Hubberts Bridge",
    value: "HBB",
  },
  {
    label: "Hucknall",
    value: "HKN",
  },
  {
    label: "Huddersfield",
    value: "HUD",
  },
  {
    label: "Hull",
    value: "HUL",
  },
  {
    label: "Hull (Bus)",
    value: "HUU",
  },
  {
    label: "Humphrey Park",
    value: "HUP",
  },
  {
    label: "Huncoat",
    value: "HCT",
  },
  {
    label: "Hungerford",
    value: "HGD",
  },
  {
    label: "Hunmanby",
    value: "HUB",
  },
  {
    label: "Hunstanton (Bus)",
    value: "HUS",
  },
  {
    label: "Huntingdon",
    value: "HUN",
  },
  {
    label: "Huntly",
    value: "HNT",
  },
  {
    label: "Hunts Cross",
    value: "HNX",
  },
  {
    label: "Hursley Post Office (Bus)",
    value: "HSE",
  },
  {
    label: "Hurst Green",
    value: "HUR",
  },
  {
    label: "Hutton Cranswick",
    value: "HUT",
  },
  {
    label: "Huyton",
    value: "HUY",
  },
  {
    label: "Hyde Central",
    value: "HYC",
  },
  {
    label: "Hyde North",
    value: "HYT",
  },
  {
    label: "Hyde Park (Tram)",
    value: "HYP",
  },
  {
    label: "Hykeham",
    value: "HKM",
  },
  {
    label: "Hykeham Crossroads (Bus)",
    value: "HCR",
  },
  {
    label: "Hyndland",
    value: "HYN",
  },
  {
    label: "Hythe",
    value: "HYH",
  },
  {
    label: "Hythe Waterside (Bus)",
    value: "HYZ",
  },
  {
    label: "IBM",
    value: "IBM",
  },
  {
    label: "Ifield",
    value: "IFI",
  },
  {
    label: "Ilford",
    value: "IFD",
  },
  {
    label: "Ilkeston",
    value: "ILN",
  },
  {
    label: "Ilkley",
    value: "ILK",
  },
  {
    label: "Imperial Wharf",
    value: "IMW",
  },
  {
    label: "Ince",
    value: "INC",
  },
  {
    label: "Ince & Elton",
    value: "INE",
  },
  {
    label: "Ingatestone",
    value: "INT",
  },
  {
    label: "Insch",
    value: "INS",
  },
  {
    label: "Invergordon",
    value: "IGD",
  },
  {
    label: "Invergowrie",
    value: "ING",
  },
  {
    label: "Inverkeithing",
    value: "INK",
  },
  {
    label: "Inverkip",
    value: "INP",
  },
  {
    label: "Inverness",
    value: "INV",
  },
  {
    label: "Invershin",
    value: "INH",
  },
  {
    label: "Inverurie",
    value: "INR",
  },
  {
    label: "Ipswich",
    value: "IPS",
  },
  {
    label: "Irlam",
    value: "IRL",
  },
  {
    label: "Irvine",
    value: "IRV",
  },
  {
    label: "Isleworth",
    value: "ISL",
  },
  {
    label: "Islip",
    value: "ISP",
  },
  {
    label: "Iver",
    value: "IVR",
  },
  {
    label: "Ivybridge",
    value: "IVY",
  },
  {
    label: "James Cook",
    value: "JCH",
  },
  {
    label: "James Street",
    value: "LVJ",
  },
  {
    label: "Jewellery Quarter",
    value: "JEQ",
  },
  {
    label: "Johnston",
    value: "JOH",
  },
  {
    label: "Johnstone",
    value: "JHN",
  },
  {
    label: "Jordanhill",
    value: "JOR",
  },
  {
    label: "Kearsley",
    value: "KSL",
  },
  {
    label: "Kearsney",
    value: "KSN",
  },
  {
    label: "Keighley",
    value: "KEI",
  },
  {
    label: "Keith",
    value: "KEH",
  },
  {
    label: "Kelvedon",
    value: "KEL",
  },
  {
    label: "Kelvindale",
    value: "KVD",
  },
  {
    label: "Kemble",
    value: "KEM",
  },
  {
    label: "Kempston Hardwick",
    value: "KMH",
  },
  {
    label: "Kempton Park",
    value: "KMP",
  },
  {
    label: "Kemsing",
    value: "KMS",
  },
  {
    label: "Kemsley",
    value: "KML",
  },
  {
    label: "Kendal",
    value: "KEN",
  },
  {
    label: "Kenilworth",
    value: "KNW",
  },
  {
    label: "Kenley",
    value: "KLY",
  },
  {
    label: "Kennett",
    value: "KNE",
  },
  {
    label: "Kennishead",
    value: "KNS",
  },
  {
    label: "Kensal Green",
    value: "KNL",
  },
  {
    label: "Kensal Rise",
    value: "KNR",
  },
  {
    label: "Kensington High St Underground",
    value: "ZHS",
  },
  {
    label: "Kensington Olympia",
    value: "KPA",
  },
  {
    label: "Kent House",
    value: "KTH",
  },
  {
    label: "Kentish Town",
    value: "KTN",
  },
  {
    label: "Kentish Town West",
    value: "KTW",
  },
  {
    label: "Kenton",
    value: "KNT",
  },
  {
    label: "Kents Bank",
    value: "KBK",
  },
  {
    label: "Keswick Bus Station",
    value: "KWK",
  },
  {
    label: "Kettering",
    value: "KET",
  },
  {
    label: "Kettering (Bus)",
    value: "KEZ",
  },
  {
    label: "Kew Bridge",
    value: "KWB",
  },
  {
    label: "Kew Gardens",
    value: "KWG",
  },
  {
    label: "Keyham",
    value: "KEY",
  },
  {
    label: "Keynsham",
    value: "KYN",
  },
  {
    label: "Kidbrooke",
    value: "KDB",
  },
  {
    label: "Kidderminster",
    value: "KID",
  },
  {
    label: "Kidsgrove",
    value: "KDG",
  },
  {
    label: "Kidwelly",
    value: "KWL",
  },
  {
    label: "Kilburn High Road",
    value: "KBN",
  },
  {
    label: "Kilcreggan (Bus)",
    value: "KCG",
  },
  {
    label: "Kildale",
    value: "KLD",
  },
  {
    label: "Kildonan",
    value: "KIL",
  },
  {
    label: "Kilgetty",
    value: "KGT",
  },
  {
    label: "Kilmarnock",
    value: "KMK",
  },
  {
    label: "Kilmaurs",
    value: "KLM",
  },
  {
    label: "Kilpatrick",
    value: "KPT",
  },
  {
    label: "Kilwinning",
    value: "KWN",
  },
  {
    label: "Kinbrace",
    value: "KBC",
  },
  {
    label: "Kingham",
    value: "KGM",
  },
  {
    label: "Kinghorn",
    value: "KGH",
  },
  {
    label: "Kings Langley",
    value: "KGL",
  },
  {
    label: "Kings Lynn",
    value: "KLN",
  },
  {
    label: "Kings Lynn Bus Station",
    value: "KLB",
  },
  {
    label: "Kings Norton",
    value: "KNN",
  },
  {
    label: "Kings Nympton",
    value: "KGN",
  },
  {
    label: "Kings Park",
    value: "KGP",
  },
  {
    label: "Kings Sutton",
    value: "KGS",
  },
  {
    label: "Kingsbridge (Bus)",
    value: "XAW",
  },
  {
    label: "Kingsknowe",
    value: "KGE",
  },
  {
    label: "Kingston",
    value: "KNG",
  },
  {
    label: "Kingswear",
    value: "KWR",
  },
  {
    label: "Kingswood",
    value: "KND",
  },
  {
    label: "Kingussie",
    value: "KIN",
  },
  {
    label: "Kintbury",
    value: "KIT",
  },
  {
    label: "KINTORE",
    value: "KTR",
  },
  {
    label: "Kirby Cross",
    value: "KBX",
  },
  {
    label: "Kirk Sandall",
    value: "KKS",
  },
  {
    label: "Kirkby",
    value: "KIR",
  },
  {
    label: "Kirkby in Ashfield",
    value: "KKB",
  },
  {
    label: "Kirkby Stephen",
    value: "KSW",
  },
  {
    label: "Kirkby-in-Furness",
    value: "KBF",
  },
  {
    label: "Kirkcaldy",
    value: "KDY",
  },
  {
    label: "Kirkconnel",
    value: "KRK",
  },
  {
    label: "Kirkdale",
    value: "KKD",
  },
  {
    label: "Kirkham & Wesham",
    value: "KKM",
  },
  {
    label: "Kirkhill",
    value: "KKH",
  },
  {
    label: "Kirknewton",
    value: "KKN",
  },
  {
    label: "Kirkstall Forge",
    value: "KLF",
  },
  {
    label: "Kirkwood",
    value: "KWD",
  },
  {
    label: "Kirton Lindsey",
    value: "KTL",
  },
  {
    label: "Kiveton Bridge",
    value: "KIV",
  },
  {
    label: "Kiveton Park",
    value: "KVP",
  },
  {
    label: "Knaresborough",
    value: "KNA",
  },
  {
    label: "Knebworth",
    value: "KBW",
  },
  {
    label: "Knighton",
    value: "KNI",
  },
  {
    label: "Knockholt",
    value: "KCK",
  },
  {
    label: "Knottingley",
    value: "KNO",
  },
  {
    label: "Knucklas",
    value: "KNU",
  },
  {
    label: "Knutsford",
    value: "KNF",
  },
  {
    label: "Kyle of Lochalsh",
    value: "KYL",
  },
  {
    label: "Kyleakin, Skye (Bus)",
    value: "KYK",
  },
  {
    label: "Ladybank",
    value: "LDY",
  },
  {
    label: "Ladywell",
    value: "LAD",
  },
  {
    label: "Laindon",
    value: "LAI",
  },
  {
    label: "Lairg",
    value: "LRG",
  },
  {
    label: "Lake",
    value: "LKE",
  },
  {
    label: "Lakenheath",
    value: "LAK",
  },
  {
    label: "Lamphey",
    value: "LAM",
  },
  {
    label: "Lanark",
    value: "LNK",
  },
  {
    label: "Lancaster",
    value: "LAN",
  },
  {
    label: "Lancing",
    value: "LAC",
  },
  {
    label: "Landywood",
    value: "LAW",
  },
  {
    label: "Langbank",
    value: "LGB",
  },
  {
    label: "Langho",
    value: "LHO",
  },
  {
    label: "Langholm (Bus)",
    value: "LHL",
  },
  {
    label: "Langley",
    value: "LNY",
  },
  {
    label: "Langley Green",
    value: "LGG",
  },
  {
    label: "Langley Mill",
    value: "LGM",
  },
  {
    label: "Langside",
    value: "LGS",
  },
  {
    label: "Langwathby",
    value: "LGW",
  },
  {
    label: "Langwith-Whaley Thorns",
    value: "LAG",
  },
  {
    label: "Lapford",
    value: "LAP",
  },
  {
    label: "Lapworth",
    value: "LPW",
  },
  {
    label: "Larbert",
    value: "LBT",
  },
  {
    label: "Largs",
    value: "LAR",
  },
  {
    label: "Larkhall",
    value: "LRH",
  },
  {
    label: "Larne Harbour (Bus)",
    value: "LRN",
  },
  {
    label: "Launceston (Bus)",
    value: "XAZ",
  },
  {
    label: "Laurencekirk",
    value: "LAU",
  },
  {
    label: "Lawrence Hill",
    value: "LWH",
  },
  {
    label: "Layton",
    value: "LAY",
  },
  {
    label: "Lazonby & Kirkoswald",
    value: "LZB",
  },
  {
    label: "Lea Bridge",
    value: "LEB",
  },
  {
    label: "Lea Green",
    value: "LEG",
  },
  {
    label: "Lea Hall",
    value: "LEH",
  },
  {
    label: "Leagrave",
    value: "LEA",
  },
  {
    label: "Lealholm",
    value: "LHM",
  },
  {
    label: "Leamington Spa",
    value: "LMS",
  },
  {
    label: "Leasowe",
    value: "LSW",
  },
  {
    label: "Leatherhead",
    value: "LHD",
  },
  {
    label: "Ledbury",
    value: "LED",
  },
  {
    label: "Lee",
    value: "LEE",
  },
  {
    label: "Leeds",
    value: "LDS",
  },
  {
    label: "Leeds Bradford Airport (Bus)",
    value: "XLB",
  },
  {
    label: "Leeds Festival (Bus)",
    value: "XLD",
  },
  {
    label: "Leeds, Whitehall (Bus)",
    value: "LZZ",
  },
  {
    label: "Leicester",
    value: "LEI",
  },
  {
    label: "Leigh (Kent)",
    value: "LIH",
  },
  {
    label: "Leigh-on-Sea",
    value: "LES",
  },
  {
    label: "Leighton Buzzard",
    value: "LBZ",
  },
  {
    label: "Lelant",
    value: "LEL",
  },
  {
    label: "Lelant Saltings",
    value: "LTS",
  },
  {
    label: "Lenham",
    value: "LEN",
  },
  {
    label: "Lenzie",
    value: "LNZ",
  },
  {
    label: "Leominster",
    value: "LEO",
  },
  {
    label: "Letchworth Garden City",
    value: "LET",
  },
  {
    label: "Leuchars",
    value: "LEU",
  },
  {
    label: "Levenshulme",
    value: "LVM",
  },
  {
    label: "Levisham",
    value: "XLA",
  },
  {
    label: "Lewes",
    value: "LWS",
  },
  {
    label: "Lewisham",
    value: "LEW",
  },
  {
    label: "Leyland",
    value: "LEY",
  },
  {
    label: "Leyton Midland Road",
    value: "LEM",
  },
  {
    label: "Leytonstone High Road",
    value: "LER",
  },
  {
    label: "Lichfield City",
    value: "LIC",
  },
  {
    label: "Lichfield Trent Valley",
    value: "LTV",
  },
  {
    label: "Lidlington",
    value: "LID",
  },
  {
    label: "Lille Europe",
    value: "LIU",
  },
  {
    label: "Limehouse",
    value: "LHS",
  },
  {
    label: "Lincoln Bus Station",
    value: "LBS",
  },
  {
    label: "Lincoln Central",
    value: "LCN",
  },
  {
    label: "Lindford (Bus)",
    value: "LNF",
  },
  {
    label: "Lingfield",
    value: "LFD",
  },
  {
    label: "Lingwood",
    value: "LGD",
  },
  {
    label: "Linlithgow",
    value: "LIN",
  },
  {
    label: "Liphook",
    value: "LIP",
  },
  {
    label: "Liskeard",
    value: "LSK",
  },
  {
    label: "Lismore (Bus)",
    value: "LSM",
  },
  {
    label: "Liss",
    value: "LIS",
  },
  {
    label: "Lisvane & Thornhill",
    value: "LVT",
  },
  {
    label: "Little Kimble",
    value: "LTK",
  },
  {
    label: "Little Sutton",
    value: "LTT",
  },
  {
    label: "Littleborough",
    value: "LTL",
  },
  {
    label: "Littlehampton",
    value: "LIT",
  },
  {
    label: "Littlehaven",
    value: "LVN",
  },
  {
    label: "Littleport",
    value: "LTP",
  },
  {
    label: "Liverpool Central",
    value: "LVC",
  },
  {
    label: "Liverpool Landing Stage",
    value: "LVS",
  },
  {
    label: "Liverpool Lime Street",
    value: "LIV",
  },
  {
    label: "Liverpool South Parkway",
    value: "LPY",
  },
  {
    label: "Liverpool Street Low level",
    value: "LIX",
  },
  {
    label: "Livingston North",
    value: "LSN",
  },
  {
    label: "Livingston South",
    value: "LVG",
  },
  {
    label: "Llanaber",
    value: "LLA",
  },
  {
    label: "Llanbedr",
    value: "LBR",
  },
  {
    label: "Llanbister Road",
    value: "LLT",
  },
  {
    label: "Llanbradach",
    value: "LNB",
  },
  {
    label: "Llandaf",
    value: "LLN",
  },
  {
    label: "Llandanwg",
    value: "LDN",
  },
  {
    label: "Llandecwyn",
    value: "LLC",
  },
  {
    label: "Llandeilo",
    value: "LLL",
  },
  {
    label: "Llandovery",
    value: "LLV",
  },
  {
    label: "Llandrindod",
    value: "LLO",
  },
  {
    label: "Llandudno",
    value: "LLD",
  },
  {
    label: "Llandudno Junction",
    value: "LLJ",
  },
  {
    label: "Llandybie",
    value: "LLI",
  },
  {
    label: "Llanelli",
    value: "LLE",
  },
  {
    label: "Llanfairfechan",
    value: "LLF",
  },
  {
    label: "Llanfairpwll",
    value: "LPG",
  },
  {
    label: "Llangadog",
    value: "LLG",
  },
  {
    label: "Llangammarch",
    value: "LLM",
  },
  {
    label: "Llangennech",
    value: "LLH",
  },
  {
    label: "Llangynllo",
    value: "LGO",
  },
  {
    label: "Llanharan",
    value: "LLR",
  },
  {
    label: "Llanhilleth",
    value: "LTH",
  },
  {
    label: "Llanishen",
    value: "LLS",
  },
  {
    label: "Llanrwst",
    value: "LWR",
  },
  {
    label: "Llansamlet",
    value: "LAS",
  },
  {
    label: "Llantwit Major",
    value: "LWM",
  },
  {
    label: "Llanwrda",
    value: "LNR",
  },
  {
    label: "Llanwrtyd",
    value: "LNW",
  },
  {
    label: "Llwyngwril",
    value: "LLW",
  },
  {
    label: "Llwynypia",
    value: "LLY",
  },
  {
    label: "Loch Awe",
    value: "LHA",
  },
  {
    label: "Loch Eil Outward Bound",
    value: "LHE",
  },
  {
    label: "Lochailort",
    value: "LCL",
  },
  {
    label: "Lochboisdale, South Uist (Bus)",
    value: "LCB",
  },
  {
    label: "Locheilside",
    value: "LCS",
  },
  {
    label: "Lochgelly",
    value: "LCG",
  },
  {
    label: "Lochluichart",
    value: "LCC",
  },
  {
    label: "Lochmaddy, North Uist (Bus)",
    value: "LCH",
  },
  {
    label: "Lochwinnoch",
    value: "LHW",
  },
  {
    label: "Lockerbie",
    value: "LOC",
  },
  {
    label: "Lockwood",
    value: "LCK",
  },
  {
    label: "London Blackfriars",
    value: "BFR",
  },
  {
    label: "London Bridge",
    value: "LBG",
  },
  {
    label: "London Cannon Street",
    value: "CST",
  },
  {
    label: "London Charing Cross",
    value: "CHX",
  },
  {
    label: "London Euston",
    value: "EUS",
  },
  {
    label: "London Fenchurch Street",
    value: "FST",
  },
  {
    label: "London Fields",
    value: "LOF",
  },
  {
    label: "London Kings Cross",
    value: "KGX",
  },
  {
    label: "London Liverpool Street",
    value: "LST",
  },
  {
    label: "London Marylebone",
    value: "MYB",
  },
  {
    label: "London Paddington",
    value: "PAD",
  },
  {
    label: "London Road (Brighton)",
    value: "LRB",
  },
  {
    label: "London Road (Guildford)",
    value: "LRD",
  },
  {
    label: "London St Pancras (Intl)",
    value: "STP",
  },
  {
    label: "London Victoria",
    value: "VIC",
  },
  {
    label: "London Waterloo",
    value: "WAT",
  },
  {
    label: "London Waterloo East",
    value: "WAE",
  },
  {
    label: "Long Buckby",
    value: "LBK",
  },
  {
    label: "Long Eaton",
    value: "LGE",
  },
  {
    label: "Long Preston",
    value: "LPR",
  },
  {
    label: "Longbeck",
    value: "LGK",
  },
  {
    label: "Longbridge",
    value: "LOB",
  },
  {
    label: "Longcross",
    value: "LNG",
  },
  {
    label: "Longfield",
    value: "LGF",
  },
  {
    label: "Longniddry",
    value: "LND",
  },
  {
    label: "Longport",
    value: "LPT",
  },
  {
    label: "Longton",
    value: "LGN",
  },
  {
    label: "Looe",
    value: "LOO",
  },
  {
    label: "Lostock",
    value: "LOT",
  },
  {
    label: "Lostock Gralam",
    value: "LTG",
  },
  {
    label: "Lostock Hall",
    value: "LOH",
  },
  {
    label: "Lostwithiel",
    value: "LOS",
  },
  {
    label: "Loughborough",
    value: "LBO",
  },
  {
    label: "Loughborough Junction",
    value: "LGJ",
  },
  {
    label: "Low Moor",
    value: "LMR",
  },
  {
    label: "Lowdham",
    value: "LOW",
  },
  {
    label: "Lower Sydenham",
    value: "LSY",
  },
  {
    label: "Lowestoft",
    value: "LWT",
  },
  {
    label: "Ludlow",
    value: "LUD",
  },
  {
    label: "Luton",
    value: "LUT",
  },
  {
    label: "Luton (Bus)",
    value: "LUB",
  },
  {
    label: "Luton Airport (Bus)",
    value: "LUA",
  },
  {
    label: "Luton Airport Parkway",
    value: "LTN",
  },
  {
    label: "Luxulyan",
    value: "LUX",
  },
  {
    label: "Lydney",
    value: "LYD",
  },
  {
    label: "Lye",
    value: "LYE",
  },
  {
    label: "Lymington Pier",
    value: "LYP",
  },
  {
    label: "Lymington Town",
    value: "LYT",
  },
  {
    label: "Lympstone Commando",
    value: "LYC",
  },
  {
    label: "Lympstone Village",
    value: "LYM",
  },
  {
    label: "Lyneham Camp (Bus)",
    value: "XBD",
  },
  {
    label: "Lytham",
    value: "LTM",
  },
  {
    label: "Macclesfield",
    value: "MAC",
  },
  {
    label: "Machynlleth",
    value: "MCN",
  },
  {
    label: "Maesteg",
    value: "MST",
  },
  {
    label: "Maesteg (Ewenny Road)",
    value: "MEW",
  },
  {
    label: "Maghull",
    value: "MAG",
  },
  {
    label: "Maghull North",
    value: "MNS",
  },
  {
    label: "Maiden Newton",
    value: "MDN",
  },
  {
    label: "Maidenhead",
    value: "MAI",
  },
  {
    label: "Maidstone Barracks",
    value: "MDB",
  },
  {
    label: "Maidstone East",
    value: "MDE",
  },
  {
    label: "Maidstone West",
    value: "MDW",
  },
  {
    label: "Malden Manor",
    value: "MAL",
  },
  {
    label: "Mallaig",
    value: "MLG",
  },
  {
    label: "Malton",
    value: "MLT",
  },
  {
    label: "Malvern Link",
    value: "MVL",
  },
  {
    label: "Manchester Airport",
    value: "MIA",
  },
  {
    label: "Manchester Oxford Road",
    value: "MCO",
  },
  {
    label: "Manchester Piccadilly",
    value: "MAN",
  },
  {
    label: "Manchester United FC",
    value: "MUF",
  },
  {
    label: "Manchester Victoria",
    value: "MCV",
  },
  {
    label: "Manea",
    value: "MNE",
  },
  {
    label: "Manningtree",
    value: "MNG",
  },
  {
    label: "Manor Park",
    value: "MNP",
  },
  {
    label: "Manor Road",
    value: "MNR",
  },
  {
    label: "Manorbier",
    value: "MRB",
  },
  {
    label: "Manors",
    value: "MAS",
  },
  {
    label: "Manors (T & W Metro)",
    value: "MRM",
  },
  {
    label: "Mansfield",
    value: "MFT",
  },
  {
    label: "Mansfield Woodhouse",
    value: "MSW",
  },
  {
    label: "March",
    value: "MCH",
  },
  {
    label: "Marden",
    value: "MRN",
  },
  {
    label: "Margate",
    value: "MAR",
  },
  {
    label: "Market Harborough",
    value: "MHR",
  },
  {
    label: "Market Rasen",
    value: "MKR",
  },
  {
    label: "Markinch",
    value: "MNC",
  },
  {
    label: "Marks Tey",
    value: "MKT",
  },
  {
    label: "Marlborough (Bus)",
    value: "XBH",
  },
  {
    label: "Marlow",
    value: "MLW",
  },
  {
    label: "Marne La Vallee",
    value: "MCK",
  },
  {
    label: "Marple",
    value: "MPL",
  },
  {
    label: "Marsden",
    value: "MSN",
  },
  {
    label: "Marseille St Charles",
    value: "MSC",
  },
  {
    label: "Marske",
    value: "MSK",
  },
  {
    label: "Marston Green",
    value: "MGN",
  },
  {
    label: "Martin Mill",
    value: "MTM",
  },
  {
    label: "Martins Heron",
    value: "MAO",
  },
  {
    label: "Marton",
    value: "MTO",
  },
  {
    label: "Maryhill",
    value: "MYH",
  },
  {
    label: "Maryland",
    value: "MYL",
  },
  {
    label: "Maryport",
    value: "MRY",
  },
  {
    label: "Matlock",
    value: "MAT",
  },
  {
    label: "Matlock Bath",
    value: "MTB",
  },
  {
    label: "Mauldeth Road",
    value: "MAU",
  },
  {
    label: "Maxwell Park",
    value: "MAX",
  },
  {
    label: "Maybole",
    value: "MAY",
  },
  {
    label: "Maze Hill",
    value: "MZH",
  },
  {
    label: "Meadowhall",
    value: "MHS",
  },
  {
    label: "Meldreth",
    value: "MEL",
  },
  {
    label: "Melksham",
    value: "MKM",
  },
  {
    label: "Melksham Market Place (Bus)",
    value: "XBO",
  },
  {
    label: "Melrose (Bus)",
    value: "MLS",
  },
  {
    label: "Melton",
    value: "MES",
  },
  {
    label: "Melton Mowbray",
    value: "MMO",
  },
  {
    label: "Menheniot",
    value: "MEN",
  },
  {
    label: "Menston",
    value: "MNN",
  },
  {
    label: "Meols",
    value: "MEO",
  },
  {
    label: "Meols Cop",
    value: "MEC",
  },
  {
    label: "Meopham",
    value: "MEP",
  },
  {
    label: "Meridian Water",
    value: "MRW",
  },
  {
    label: "Merryton",
    value: "MEY",
  },
  {
    label: "Merstham",
    value: "MHM",
  },
  {
    label: "Merthyr Tydfil",
    value: "MER",
  },
  {
    label: "Merthyr Vale",
    value: "MEV",
  },
  {
    label: "Metheringham",
    value: "MGM",
  },
  {
    label: "Metro Centre",
    value: "MCE",
  },
  {
    label: "Mevagissey (Bus)",
    value: "XEF",
  },
  {
    label: "Mexborough",
    value: "MEX",
  },
  {
    label: "Micheldever",
    value: "MIC",
  },
  {
    label: "Micklefield",
    value: "MIK",
  },
  {
    label: "Middlesbrough",
    value: "MBR",
  },
  {
    label: "Middlewood",
    value: "MDL",
  },
  {
    label: "Midgham",
    value: "MDG",
  },
  {
    label: "Midsomer Norton (Bus)",
    value: "XBR",
  },
  {
    label: "Milford (Surrey)",
    value: "MLF",
  },
  {
    label: "Milford Haven",
    value: "MFH",
  },
  {
    label: "Mill Hill (Lancashire)",
    value: "MLH",
  },
  {
    label: "Mill Hill Broadway",
    value: "MIL",
  },
  {
    label: "Millbrook (Bedfordshire)",
    value: "MLB",
  },
  {
    label: "Millbrook (Hampshire)",
    value: "MBK",
  },
  {
    label: "Millfield (T & W Metro)",
    value: "MIF",
  },
  {
    label: "Milliken Park",
    value: "MIN",
  },
  {
    label: "Millom",
    value: "MLM",
  },
  {
    label: "Mills Hill",
    value: "MIH",
  },
  {
    label: "Milngavie",
    value: "MLN",
  },
  {
    label: "Milnrow",
    value: "MLR",
  },
  {
    label: "Milton Keynes Central",
    value: "MKC",
  },
  {
    label: "Minehead",
    value: "MHD",
  },
  {
    label: "Minehead (Bus)",
    value: "XBW",
  },
  {
    label: "Minehead Butlins (Bus)",
    value: "XBV",
  },
  {
    label: "Minffordd",
    value: "MFF",
  },
  {
    label: "Minster",
    value: "MSR",
  },
  {
    label: "Mirfield",
    value: "MIR",
  },
  {
    label: "Mistley",
    value: "MIS",
  },
  {
    label: "Mitcham Eastfields",
    value: "MTC",
  },
  {
    label: "Mitcham Junction",
    value: "MIJ",
  },
  {
    label: "Mobberley",
    value: "MOB",
  },
  {
    label: "Monifieth",
    value: "MON",
  },
  {
    label: "Monks Risborough",
    value: "MRS",
  },
  {
    label: "Montpelier",
    value: "MTP",
  },
  {
    label: "Montrose",
    value: "MTS",
  },
  {
    label: "Moorfields",
    value: "MRF",
  },
  {
    label: "Moorgate",
    value: "MOG",
  },
  {
    label: "Moorside",
    value: "MSD",
  },
  {
    label: "Moorthorpe",
    value: "MRP",
  },
  {
    label: "Morar",
    value: "MRR",
  },
  {
    label: "Morchard Road",
    value: "MRD",
  },
  {
    label: "Morden South",
    value: "MDS",
  },
  {
    label: "Morecambe",
    value: "MCM",
  },
  {
    label: "Moreton (Dorset)",
    value: "MTN",
  },
  {
    label: "Moreton (Merseyside)",
    value: "MRT",
  },
  {
    label: "Moreton-in-Marsh",
    value: "MIM",
  },
  {
    label: "Moretonhampstead (Bus)",
    value: "XEK",
  },
  {
    label: "Morfa Mawddach",
    value: "MFA",
  },
  {
    label: "Morley",
    value: "MLY",
  },
  {
    label: "Morpeth",
    value: "MPT",
  },
  {
    label: "Mortimer",
    value: "MOR",
  },
  {
    label: "Mortlake",
    value: "MTL",
  },
  {
    label: "Moses Gate",
    value: "MSS",
  },
  {
    label: "Moss Side",
    value: "MOS",
  },
  {
    label: "Mossley",
    value: "MSL",
  },
  {
    label: "Mossley Hill",
    value: "MSH",
  },
  {
    label: "Mosspark",
    value: "MPK",
  },
  {
    label: "Moston",
    value: "MSO",
  },
  {
    label: "Motherwell",
    value: "MTH",
  },
  {
    label: "Motspur Park",
    value: "MOT",
  },
  {
    label: "Mottingham",
    value: "MTG",
  },
  {
    label: "Mottisfont & Dunbridge",
    value: "DBG",
  },
  {
    label: "Mouldsworth",
    value: "MLD",
  },
  {
    label: "Moulsecoomb",
    value: "MCB",
  },
  {
    label: "Mount Florida",
    value: "MFL",
  },
  {
    label: "Mount Vernon",
    value: "MTV",
  },
  {
    label: "Mountain Ash",
    value: "MTA",
  },
  {
    label: "Muck (Bus)",
    value: "MUK",
  },
  {
    label: "Muir of Ord",
    value: "MOO",
  },
  {
    label: "Muirend",
    value: "MUI",
  },
  {
    label: "Musselburgh",
    value: "MUB",
  },
  {
    label: "Mytholmroyd",
    value: "MYT",
  },
  {
    label: "Nafferton",
    value: "NFN",
  },
  {
    label: "Nailsea & Backwell",
    value: "NLS",
  },
  {
    label: "Nairn",
    value: "NRN",
  },
  {
    label: "Nantwich",
    value: "NAN",
  },
  {
    label: "Narberth",
    value: "NAR",
  },
  {
    label: "Narborough",
    value: "NBR",
  },
  {
    label: "Navigation Road",
    value: "NVR",
  },
  {
    label: "Neath",
    value: "NTH",
  },
  {
    label: "Needham Market",
    value: "NMT",
  },
  {
    label: "Neilston",
    value: "NEI",
  },
  {
    label: "Nelson",
    value: "NEL",
  },
  {
    label: "Neston",
    value: "NES",
  },
  {
    label: "Netherfield",
    value: "NET",
  },
  {
    label: "Nethertown",
    value: "NRT",
  },
  {
    label: "Netley",
    value: "NTL",
  },
  {
    label: "New Barnet",
    value: "NBA",
  },
  {
    label: "New Beckenham",
    value: "NBC",
  },
  {
    label: "New Brighton",
    value: "NBN",
  },
  {
    label: "New Clee",
    value: "NCE",
  },
  {
    label: "New Cross",
    value: "NWX",
  },
  {
    label: "New Cross Gate",
    value: "NXG",
  },
  {
    label: "New Cumnock",
    value: "NCK",
  },
  {
    label: "New Eltham",
    value: "NEH",
  },
  {
    label: "New Hey",
    value: "NHY",
  },
  {
    label: "New Holland",
    value: "NHL",
  },
  {
    label: "New Hythe",
    value: "NHE",
  },
  {
    label: "New Lane",
    value: "NLN",
  },
  {
    label: "New Malden",
    value: "NEM",
  },
  {
    label: "New Mills Central",
    value: "NMC",
  },
  {
    label: "New Mills Newtown",
    value: "NMN",
  },
  {
    label: "New Milton",
    value: "NWM",
  },
  {
    label: "New Pudsey",
    value: "NPD",
  },
  {
    label: "New Southgate",
    value: "NSG",
  },
  {
    label: "Newark Castle",
    value: "NCT",
  },
  {
    label: "Newark North Gate",
    value: "NNG",
  },
  {
    label: "Newbridge",
    value: "NBE",
  },
  {
    label: "Newbury",
    value: "NBY",
  },
  {
    label: "Newbury Park Underground",
    value: "ZNP",
  },
  {
    label: "Newbury Racecourse",
    value: "NRC",
  },
  {
    label: "Newcastle",
    value: "NCL",
  },
  {
    label: "Newcastle Airport",
    value: "APN",
  },
  {
    label: "Newcastle Central Metro",
    value: "NCZ",
  },
  {
    label: "Newcourt",
    value: "NCO",
  },
  {
    label: "Newcraighall",
    value: "NEW",
  },
  {
    label: "Newhaven Harbour",
    value: "NVH",
  },
  {
    label: "Newhaven Marine (Bus)",
    value: "NVM",
  },
  {
    label: "Newhaven Town",
    value: "NVN",
  },
  {
    label: "Newington",
    value: "NGT",
  },
  {
    label: "Newmarket",
    value: "NMK",
  },
  {
    label: "Newport (Essex)",
    value: "NWE",
  },
  {
    label: "Newport (South Wales)",
    value: "NWP",
  },
  {
    label: "Newquay",
    value: "NQY",
  },
  {
    label: "Newstead",
    value: "NSD",
  },
  {
    label: "Newton",
    value: "NTN",
  },
  {
    label: "Newton Abbot",
    value: "NTA",
  },
  {
    label: "Newton Aycliffe",
    value: "NAY",
  },
  {
    label: "Newton for Hyde",
    value: "NWN",
  },
  {
    label: "Newton St Cyres",
    value: "NTC",
  },
  {
    label: "Newton-le-Willows",
    value: "NLW",
  },
  {
    label: "Newton-on-Ayr",
    value: "NOA",
  },
  {
    label: "Newtongrange",
    value: "NEG",
  },
  {
    label: "Newtonmore",
    value: "NWR",
  },
  {
    label: "Newtown (Powys)",
    value: "NWT",
  },
  {
    label: "Ninian Park",
    value: "NNP",
  },
  {
    label: "Nitshill",
    value: "NIT",
  },
  {
    label: "Norbiton",
    value: "NBT",
  },
  {
    label: "Norbury",
    value: "NRB",
  },
  {
    label: "Normans Bay",
    value: "NSB",
  },
  {
    label: "Normanton",
    value: "NOR",
  },
  {
    label: "North Berwick",
    value: "NBW",
  },
  {
    label: "North Camp",
    value: "NCM",
  },
  {
    label: "North Dulwich",
    value: "NDL",
  },
  {
    label: "North Fambridge",
    value: "NFA",
  },
  {
    label: "North Llanrwst",
    value: "NLR",
  },
  {
    label: "North Queensferry",
    value: "NQU",
  },
  {
    label: "North Road",
    value: "NRD",
  },
  {
    label: "North Sheen",
    value: "NSH",
  },
  {
    label: "North Walsham",
    value: "NWA",
  },
  {
    label: "North Wembley",
    value: "NWB",
  },
  {
    label: "Northallerton",
    value: "NTR",
  },
  {
    label: "Northampton",
    value: "NMP",
  },
  {
    label: "Northfield",
    value: "NFD",
  },
  {
    label: "Northfleet",
    value: "NFL",
  },
  {
    label: "Northolt Park",
    value: "NLT",
  },
  {
    label: "Northumberland Park",
    value: "NUM",
  },
  {
    label: "Northwich",
    value: "NWI",
  },
  {
    label: "Norton Bridge",
    value: "NTB",
  },
  {
    label: "Norton Bridge (Bus)",
    value: "NBS",
  },
  {
    label: "Norwich",
    value: "NRW",
  },
  {
    label: "Norwood Junction",
    value: "NWD",
  },
  {
    label: "Nottingham",
    value: "NOT",
  },
  {
    label: "Nuneaton",
    value: "NUN",
  },
  {
    label: "Nunhead",
    value: "NHD",
  },
  {
    label: "Nunnery Square (Tram)",
    value: "NUR",
  },
  {
    label: "Nunthorpe",
    value: "NNT",
  },
  {
    label: "Nutbourne",
    value: "NUT",
  },
  {
    label: "Nutfield",
    value: "NUF",
  },
  {
    label: "Nutfield Memorial Hall (Bus)",
    value: "XET",
  },
  {
    label: "Oakengates",
    value: "OKN",
  },
  {
    label: "Oakham",
    value: "OKM",
  },
  {
    label: "Oakleigh Park",
    value: "OKL",
  },
  {
    label: "Oakwood LUL (Enfield)",
    value: "ZOA",
  },
  {
    label: "Oban",
    value: "OBN",
  },
  {
    label: "Ockendon",
    value: "OCK",
  },
  {
    label: "Ockley",
    value: "OLY",
  },
  {
    label: "Okehampton",
    value: "OKE",
  },
  {
    label: "Okehampton (Bus)",
    value: "XCG",
  },
  {
    label: "Old Hill",
    value: "OHL",
  },
  {
    label: "Old Roan",
    value: "ORN",
  },
  {
    label: "Old Street",
    value: "OLD",
  },
  {
    label: "Oldfield Park",
    value: "OLF",
  },
  {
    label: "Oldham Mumps",
    value: "OLM",
  },
  {
    label: "Oldham Werneth",
    value: "OLW",
  },
  {
    label: "Olton",
    value: "OLT",
  },
  {
    label: "Ore",
    value: "ORE",
  },
  {
    label: "Ormskirk",
    value: "OMS",
  },
  {
    label: "Orpington",
    value: "ORP",
  },
  {
    label: "Orrell",
    value: "ORR",
  },
  {
    label: "Orrell Park",
    value: "OPK",
  },
  {
    label: "Otford",
    value: "OTF",
  },
  {
    label: "Otley Bus Station",
    value: "OTL",
  },
  {
    label: "Oulton Broad North",
    value: "OUN",
  },
  {
    label: "Oulton Broad South",
    value: "OUS",
  },
  {
    label: "Oundle Market Place (Bus)",
    value: "OUD",
  },
  {
    label: "Outwood",
    value: "OUT",
  },
  {
    label: "Overpool",
    value: "OVE",
  },
  {
    label: "Overton",
    value: "OVR",
  },
  {
    label: "Oxenholme Lake District",
    value: "OXN",
  },
  {
    label: "Oxenhope",
    value: "XOB",
  },
  {
    label: "Oxford",
    value: "OXF",
  },
  {
    label: "Oxford Parkway",
    value: "OXP",
  },
  {
    label: "Oxshott",
    value: "OXS",
  },
  {
    label: "Oxted",
    value: "OXT",
  },
  {
    label: "Paddington Low Level",
    value: "PAA",
  },
  {
    label: "Paddock Wood",
    value: "PDW",
  },
  {
    label: "Padgate",
    value: "PDG",
  },
  {
    label: "Padstow Bus Terminus",
    value: "PDT",
  },
  {
    label: "Paignton",
    value: "PGN",
  },
  {
    label: "Paisley Canal",
    value: "PCN",
  },
  {
    label: "Paisley Gilmour Street",
    value: "PYG",
  },
  {
    label: "Paisley St James",
    value: "PYJ",
  },
  {
    label: "Pallion (T & W Metro)",
    value: "PAI",
  },
  {
    label: "Palmers Green",
    value: "PAL",
  },
  {
    label: "Pangbourne",
    value: "PAN",
  },
  {
    label: "Pannal",
    value: "PNL",
  },
  {
    label: "Pantyffynnon",
    value: "PTF",
  },
  {
    label: "Par",
    value: "PAR",
  },
  {
    label: "Par (Bus)",
    value: "XDR",
  },
  {
    label: "Parbold",
    value: "PBL",
  },
  {
    label: "Paris Nord",
    value: "PBN",
  },
  {
    label: "Park Lane (Bus)",
    value: "CIC",
  },
  {
    label: "Park Street",
    value: "PKT",
  },
  {
    label: "Parkgate",
    value: "PAQ",
  },
  {
    label: "Parkstone (Dorset)",
    value: "PKS",
  },
  {
    label: "Parson Street",
    value: "PSN",
  },
  {
    label: "Partick",
    value: "PTK",
  },
  {
    label: "Parton",
    value: "PRN",
  },
  {
    label: "Patchway",
    value: "PWY",
  },
  {
    label: "Patricroft",
    value: "PAT",
  },
  {
    label: "Patterton",
    value: "PTT",
  },
  {
    label: "Peartree",
    value: "PEA",
  },
  {
    label: "Peckham Rye",
    value: "PMR",
  },
  {
    label: "Peebles Bus Stop",
    value: "PBS",
  },
  {
    label: "Pegswood",
    value: "PEG",
  },
  {
    label: "Pelaw (T & W Metro)",
    value: "PAW",
  },
  {
    label: "Pemberton",
    value: "PEM",
  },
  {
    label: "Pembrey & Burry Port",
    value: "PBY",
  },
  {
    label: "Pembroke",
    value: "PMB",
  },
  {
    label: "Pembroke Dock",
    value: "PMD",
  },
  {
    label: "Pembroke Dock Ferry Term",
    value: "PDK",
  },
  {
    label: "Pen-y-bont",
    value: "PNY",
  },
  {
    label: "Penally",
    value: "PNA",
  },
  {
    label: "Penarth",
    value: "PEN",
  },
  {
    label: "Pencoed",
    value: "PCD",
  },
  {
    label: "Pengam",
    value: "PGM",
  },
  {
    label: "Penge East",
    value: "PNE",
  },
  {
    label: "Penge West",
    value: "PNW",
  },
  {
    label: "Penhelig",
    value: "PHG",
  },
  {
    label: "Penistone",
    value: "PNS",
  },
  {
    label: "Penkridge",
    value: "PKG",
  },
  {
    label: "Penmaenmawr",
    value: "PMW",
  },
  {
    label: "Penmere",
    value: "PNM",
  },
  {
    label: "Penrhiwceiber",
    value: "PER",
  },
  {
    label: "Penrhyndeudraeth",
    value: "PRH",
  },
  {
    label: "Penrith",
    value: "PNR",
  },
  {
    label: "Penryn",
    value: "PYN",
  },
  {
    label: "Pensarn",
    value: "PES",
  },
  {
    label: "Penshurst",
    value: "PHR",
  },
  {
    label: "Pentre-bach",
    value: "PTB",
  },
  {
    label: "Penychain",
    value: "PNC",
  },
  {
    label: "Penyffordd",
    value: "PNF",
  },
  {
    label: "Penywaun (Bus)",
    value: "XPZ",
  },
  {
    label: "Penzance",
    value: "PNZ",
  },
  {
    label: "Perranporth (Bus)",
    value: "XCL",
  },
  {
    label: "Perranwell",
    value: "PRW",
  },
  {
    label: "Perry Barr",
    value: "PRY",
  },
  {
    label: "Pershore",
    value: "PSH",
  },
  {
    label: "Perth",
    value: "PTH",
  },
  {
    label: "Peterborough",
    value: "PBO",
  },
  {
    label: "Peterborough Queensgate (Bus)",
    value: "PBU",
  },
  {
    label: "Petersfield",
    value: "PTR",
  },
  {
    label: "Petts Wood",
    value: "PET",
  },
  {
    label: "Pevensey & Westham",
    value: "PEV",
  },
  {
    label: "Pevensey Bay",
    value: "PEB",
  },
  {
    label: "Pewsey",
    value: "PEW",
  },
  {
    label: "Piccadilly Circus Underground",
    value: "ZPC",
  },
  {
    label: "Pickering",
    value: "XPK",
  },
  {
    label: "Pickering Eastgate (Bus)",
    value: "PIZ",
  },
  {
    label: "Pilning",
    value: "PIL",
  },
  {
    label: "Pinhoe",
    value: "PIN",
  },
  {
    label: "Pitlochry",
    value: "PIT",
  },
  {
    label: "Pitsea",
    value: "PSE",
  },
  {
    label: "Plaistow",
    value: "ZPS",
  },
  {
    label: "Pleasington",
    value: "PLS",
  },
  {
    label: "Plockton",
    value: "PLK",
  },
  {
    label: "Pluckley",
    value: "PLC",
  },
  {
    label: "Plumley",
    value: "PLM",
  },
  {
    label: "Plumpton",
    value: "PMP",
  },
  {
    label: "Plumstead",
    value: "PLU",
  },
  {
    label: "Plymouth",
    value: "PLY",
  },
  {
    label: "Plymouth Saltash Road (Bus)",
    value: "XDJ",
  },
  {
    label: "Pokesdown",
    value: "POK",
  },
  {
    label: "Polegate",
    value: "PLG",
  },
  {
    label: "Polesworth",
    value: "PSW",
  },
  {
    label: "Pollokshaws East",
    value: "PWE",
  },
  {
    label: "Pollokshaws West",
    value: "PWW",
  },
  {
    label: "Pollokshields East",
    value: "PLE",
  },
  {
    label: "Pollokshields West",
    value: "PLW",
  },
  {
    label: "Polmont",
    value: "PMT",
  },
  {
    label: "Polsloe Bridge",
    value: "POL",
  },
  {
    label: "Ponders End",
    value: "PON",
  },
  {
    label: "Pont-y-Pant",
    value: "PYP",
  },
  {
    label: "Pontarddulais",
    value: "PTD",
  },
  {
    label: "Pontefract Baghill",
    value: "PFR",
  },
  {
    label: "Pontefract Monkhill",
    value: "PFM",
  },
  {
    label: "Pontefract Tanshelf",
    value: "POT",
  },
  {
    label: "Pontlottyn",
    value: "PLT",
  },
  {
    label: "Pontyclun",
    value: "PYC",
  },
  {
    label: "Pontypool & New Inn",
    value: "PPL",
  },
  {
    label: "Pontypridd",
    value: "PPD",
  },
  {
    label: "Poole",
    value: "POO",
  },
  {
    label: "Poppleton",
    value: "POP",
  },
  {
    label: "Port Glasgow",
    value: "PTG",
  },
  {
    label: "Port Sunlight",
    value: "PSL",
  },
  {
    label: "Port Talbot Parkway",
    value: "PTA",
  },
  {
    label: "Portchester",
    value: "PTC",
  },
  {
    label: "Porth",
    value: "POR",
  },
  {
    label: "Porthcawl (Bus)",
    value: "XEO",
  },
  {
    label: "Porthmadog",
    value: "PTM",
  },
  {
    label: "Porthmadog Harbour (Bus)",
    value: "PMG",
  },
  {
    label: "Portlethen",
    value: "PLN",
  },
  {
    label: "Portslade",
    value: "PLD",
  },
  {
    label: "Portsmouth & Southsea",
    value: "PMS",
  },
  {
    label: "Portsmouth Arms",
    value: "PMA",
  },
  {
    label: "Portsmouth Harbour",
    value: "PMH",
  },
  {
    label: "Possilpark & Parkhouse",
    value: "PPK",
  },
  {
    label: "Potters Bar",
    value: "PBR",
  },
  {
    label: "Poulton-le-Fylde",
    value: "PFY",
  },
  {
    label: "Poynton",
    value: "PYT",
  },
  {
    label: "Prees",
    value: "PRS",
  },
  {
    label: "Prescot",
    value: "PSC",
  },
  {
    label: "Prestatyn",
    value: "PRT",
  },
  {
    label: "Prestbury",
    value: "PRB",
  },
  {
    label: "Preston",
    value: "PRE",
  },
  {
    label: "Preston C S (Ferry)",
    value: "XPT",
  },
  {
    label: "Preston Park",
    value: "PRP",
  },
  {
    label: "Prestonpans",
    value: "PST",
  },
  {
    label: "Prestwich Metrolink (Bus)",
    value: "PWC",
  },
  {
    label: "Prestwick Intl Airport",
    value: "PRA",
  },
  {
    label: "Prestwick Town",
    value: "PTW",
  },
  {
    label: "Priesthill & Darnley",
    value: "PTL",
  },
  {
    label: "Princes Risborough",
    value: "PRR",
  },
  {
    label: "Princetown (Bus)",
    value: "XPF",
  },
  {
    label: "Prittlewell",
    value: "PRL",
  },
  {
    label: "Private Charter",
    value: "SIR",
  },
  {
    label: "Prudhoe",
    value: "PRU",
  },
  {
    label: "Pulborough",
    value: "PUL",
  },
  {
    label: "Purfleet",
    value: "PFL",
  },
  {
    label: "Purley",
    value: "PUR",
  },
  {
    label: "Purley Oaks",
    value: "PUO",
  },
  {
    label: "Putney",
    value: "PUT",
  },
  {
    label: "Pwllheli",
    value: "PWL",
  },
  {
    label: "Pye Corner",
    value: "PYE",
  },
  {
    label: "Pyle",
    value: "PYL",
  },
  {
    label: "Quainton Road",
    value: "QRD",
  },
  {
    label: "Quakers Yard",
    value: "QYD",
  },
  {
    label: "Queenborough",
    value: "QBR",
  },
  {
    label: "Queens Park (Glasgow)",
    value: "QPK",
  },
  {
    label: "Queens Park (London)",
    value: "QPW",
  },
  {
    label: "Queens Road Peckham",
    value: "QRP",
  },
  {
    label: "Queenstown Road Battersea",
    value: "QRB",
  },
  {
    label: "Quintrell Downs",
    value: "QUI",
  },
  {
    label: "Radcliffe (Nottinghamshire)",
    value: "RDF",
  },
  {
    label: "Radcliffe Metrolink (Bus)",
    value: "RCF",
  },
  {
    label: "Radlett",
    value: "RDT",
  },
  {
    label: "Radley",
    value: "RAD",
  },
  {
    label: "Radstock (Bus)",
    value: "XEQ",
  },
  {
    label: "Radyr",
    value: "RDR",
  },
  {
    label: "Rainford",
    value: "RNF",
  },
  {
    label: "Rainham (Essex)",
    value: "RNM",
  },
  {
    label: "Rainham (Kent)",
    value: "RAI",
  },
  {
    label: "Rainhill",
    value: "RNH",
  },
  {
    label: "Ramsgate",
    value: "RAM",
  },
  {
    label: "Ramsgate Harbour (Bus)",
    value: "RMG",
  },
  {
    label: "Ramsgreave & Wilpshire",
    value: "RGW",
  },
  {
    label: "Rannoch",
    value: "RAN",
  },
  {
    label: "Rauceby",
    value: "RAU",
  },
  {
    label: "Ravenglass for Eskdale",
    value: "RAV",
  },
  {
    label: "Ravensbourne",
    value: "RVB",
  },
  {
    label: "Ravensthorpe",
    value: "RVN",
  },
  {
    label: "Rawcliffe",
    value: "RWC",
  },
  {
    label: "Rayleigh",
    value: "RLG",
  },
  {
    label: "Raynes Park",
    value: "RAY",
  },
  {
    label: "Reading",
    value: "RDG",
  },
  {
    label: "Reading West",
    value: "RDW",
  },
  {
    label: "Rectory Road",
    value: "REC",
  },
  {
    label: "Redbridge",
    value: "RDB",
  },
  {
    label: "Redcar Central",
    value: "RCC",
  },
  {
    label: "Redcar East",
    value: "RCE",
  },
  {
    label: "Reddish North",
    value: "RDN",
  },
  {
    label: "Reddish South",
    value: "RDS",
  },
  {
    label: "Redditch",
    value: "RDC",
  },
  {
    label: "Redhill",
    value: "RDH",
  },
  {
    label: "Redland",
    value: "RDA",
  },
  {
    label: "Redruth",
    value: "RED",
  },
  {
    label: "Reedham (Norfolk)",
    value: "REE",
  },
  {
    label: "Reedham (Surrey)",
    value: "RHM",
  },
  {
    label: "Regent Centre (Bus)",
    value: "REG",
  },
  {
    label: "Reigate",
    value: "REI",
  },
  {
    label: "Renton",
    value: "RTN",
  },
  {
    label: "Retford",
    value: "RET",
  },
  {
    label: "Rhigos (Bus)",
    value: "RHG",
  },
  {
    label: "Rhiwbina",
    value: "RHI",
  },
  {
    label: "Rhoose Cardiff Intl Airport",
    value: "RIA",
  },
  {
    label: "Rhosneigr",
    value: "RHO",
  },
  {
    label: "Rhum (Bus)",
    value: "RHU",
  },
  {
    label: "Rhyl",
    value: "RHL",
  },
  {
    label: "Rhymney",
    value: "RHY",
  },
  {
    label: "Rhymney Tredegar (Bus)",
    value: "XTV",
  },
  {
    label: "Ribblehead",
    value: "RHD",
  },
  {
    label: "Rice Lane",
    value: "RIL",
  },
  {
    label: "Richmond",
    value: "RMD",
  },
  {
    label: "Richmond, Nth Yorks (Bus)",
    value: "RMK",
  },
  {
    label: "Rickmansworth",
    value: "RIC",
  },
  {
    label: "Riddlesdown",
    value: "RDD",
  },
  {
    label: "Ridgmont",
    value: "RID",
  },
  {
    label: "Riding Mill",
    value: "RDM",
  },
  {
    label: "Risca & Pontymister",
    value: "RCA",
  },
  {
    label: "Rishton",
    value: "RIS",
  },
  {
    label: "Robertsbridge",
    value: "RBR",
  },
  {
    label: "Robin Hood Airport (Bus)",
    value: "RHA",
  },
  {
    label: "Robroyston",
    value: "RRN",
  },
  {
    label: "Roby",
    value: "ROB",
  },
  {
    label: "Rochdale",
    value: "RCD",
  },
  {
    label: "Roche",
    value: "ROC",
  },
  {
    label: "Rochester",
    value: "RTR",
  },
  {
    label: "Rochford",
    value: "RFD",
  },
  {
    label: "Rock Ferry",
    value: "RFY",
  },
  {
    label: "Rogart",
    value: "ROG",
  },
  {
    label: "Rogerstone",
    value: "ROR",
  },
  {
    label: "Rolleston",
    value: "ROL",
  },
  {
    label: "Roman Bridge",
    value: "RMB",
  },
  {
    label: "Romford",
    value: "RMF",
  },
  {
    label: "Romiley",
    value: "RML",
  },
  {
    label: "Romsey",
    value: "ROM",
  },
  {
    label: "Romsey Bus Station",
    value: "REB",
  },
  {
    label: "Roose",
    value: "ROO",
  },
  {
    label: "Rose Grove",
    value: "RSG",
  },
  {
    label: "Rose Hill Marple",
    value: "RSH",
  },
  {
    label: "Rosslare Europort",
    value: "RSB",
  },
  {
    label: "Rosyth",
    value: "ROS",
  },
  {
    label: "Rotherham Central",
    value: "RMC",
  },
  {
    label: "Rotherhithe",
    value: "ROE",
  },
  {
    label: "Rothesay, Bute (Bus)",
    value: "RTY",
  },
  {
    label: "Roughton Road",
    value: "RNR",
  },
  {
    label: "Rowlands Castle",
    value: "RLN",
  },
  {
    label: "Rowley Regis",
    value: "ROW",
  },
  {
    label: "Roy Bridge",
    value: "RYB",
  },
  {
    label: "Roydon",
    value: "RYN",
  },
  {
    label: "Royston",
    value: "RYS",
  },
  {
    label: "Ruabon",
    value: "RUA",
  },
  {
    label: "Rufford",
    value: "RUF",
  },
  {
    label: "Rugby",
    value: "RUG",
  },
  {
    label: "Rugeley Town",
    value: "RGT",
  },
  {
    label: "Rugeley Trent Valley",
    value: "RGL",
  },
  {
    label: "Runcorn",
    value: "RUN",
  },
  {
    label: "Runcorn East",
    value: "RUE",
  },
  {
    label: "Ruskington",
    value: "RKT",
  },
  {
    label: "Ruswarp",
    value: "RUS",
  },
  {
    label: "Rutherglen",
    value: "RUT",
  },
  {
    label: "Ryde Esplanade",
    value: "RYD",
  },
  {
    label: "Ryde Pier Head",
    value: "RYP",
  },
  {
    label: "Ryde St Johns Road",
    value: "RYR",
  },
  {
    label: "Ryder Brow",
    value: "RRB",
  },
  {
    label: "Rye",
    value: "RYE",
  },
  {
    label: "Rye House",
    value: "RYH",
  },
  {
    label: "Sale Metrolink (Bus)",
    value: "SLE",
  },
  {
    label: "Salford Central",
    value: "SFD",
  },
  {
    label: "Salford Crescent",
    value: "SLD",
  },
  {
    label: "Salfords",
    value: "SAF",
  },
  {
    label: "Salhouse",
    value: "SAH",
  },
  {
    label: "Salisbury",
    value: "SAL",
  },
  {
    label: "Saltaire",
    value: "SAE",
  },
  {
    label: "Saltash",
    value: "STS",
  },
  {
    label: "Saltburn",
    value: "SLB",
  },
  {
    label: "Saltcoats",
    value: "SLT",
  },
  {
    label: "Saltmarshe",
    value: "SAM",
  },
  {
    label: "Salwick",
    value: "SLW",
  },
  {
    label: "Sampford Courtenay",
    value: "SMC",
  },
  {
    label: "Sandal & Agbrigg",
    value: "SNA",
  },
  {
    label: "Sandbach",
    value: "SDB",
  },
  {
    label: "Sanderstead",
    value: "SNR",
  },
  {
    label: "Sandhills",
    value: "SDL",
  },
  {
    label: "Sandhurst",
    value: "SND",
  },
  {
    label: "Sandling",
    value: "SDG",
  },
  {
    label: "Sandown",
    value: "SAN",
  },
  {
    label: "Sandplace",
    value: "SDP",
  },
  {
    label: "Sandringham (Bus)",
    value: "XSA",
  },
  {
    label: "Sandwell & Dudley",
    value: "SAD",
  },
  {
    label: "Sandwich",
    value: "SDW",
  },
  {
    label: "Sandy",
    value: "SDY",
  },
  {
    label: "Sankey for Penketh",
    value: "SNK",
  },
  {
    label: "Sanquhar",
    value: "SQH",
  },
  {
    label: "Sarn",
    value: "SRR",
  },
  {
    label: "Saundersfoot",
    value: "SDF",
  },
  {
    label: "Saunderton",
    value: "SDR",
  },
  {
    label: "Sawbridgeworth",
    value: "SAW",
  },
  {
    label: "Saxilby",
    value: "SXY",
  },
  {
    label: "Saxmundham",
    value: "SAX",
  },
  {
    label: "Scarborough",
    value: "SCA",
  },
  {
    label: "Scotscalder",
    value: "SCT",
  },
  {
    label: "Scotstounhill",
    value: "SCH",
  },
  {
    label: "Scrabster (Bus)",
    value: "SCB",
  },
  {
    label: "Scunthorpe",
    value: "SCU",
  },
  {
    label: "Sea Mills",
    value: "SML",
  },
  {
    label: "Seaburn (T & W Metro)",
    value: "SEB",
  },
  {
    label: "Seaford",
    value: "SEF",
  },
  {
    label: "Seaforth & Litherland",
    value: "SFL",
  },
  {
    label: "Seaham",
    value: "SEA",
  },
  {
    label: "Seamer",
    value: "SEM",
  },
  {
    label: "Seascale",
    value: "SSC",
  },
  {
    label: "Seaton Carew",
    value: "SEC",
  },
  {
    label: "Seaton, Devon (Bus)",
    value: "SSF",
  },
  {
    label: "Seer Green",
    value: "SRG",
  },
  {
    label: "Selby",
    value: "SBY",
  },
  {
    label: "Selhurst",
    value: "SRS",
  },
  {
    label: "Selkirk (Bus)",
    value: "SKK",
  },
  {
    label: "Sellafield",
    value: "SEL",
  },
  {
    label: "Selling",
    value: "SEG",
  },
  {
    label: "Selly Oak",
    value: "SLY",
  },
  {
    label: "Settle",
    value: "SET",
  },
  {
    label: "Seven Kings",
    value: "SVK",
  },
  {
    label: "Seven Sisters",
    value: "SVS",
  },
  {
    label: "Sevenoaks",
    value: "SEV",
  },
  {
    label: "Severn Beach",
    value: "SVB",
  },
  {
    label: "Severn Tunnel Junction",
    value: "STJ",
  },
  {
    label: "Shadwell",
    value: "SDE",
  },
  {
    label: "Shaftesbury Town Hall (Bus)",
    value: "SWH",
  },
  {
    label: "Shalford",
    value: "SFR",
  },
  {
    label: "Shanklin",
    value: "SHN",
  },
  {
    label: "Shaw & Crompton",
    value: "SHA",
  },
  {
    label: "Shawfair",
    value: "SFI",
  },
  {
    label: "Shawford",
    value: "SHW",
  },
  {
    label: "Shawlands",
    value: "SHL",
  },
  {
    label: "Sheerness-on-Sea",
    value: "SSS",
  },
  {
    label: "Sheffield",
    value: "SHF",
  },
  {
    label: "Sheffield Arena (Tram)",
    value: "SAI",
  },
  {
    label: "Sheffield Cathedral(Tram)",
    value: "SHQ",
  },
  {
    label: "Shelford",
    value: "SED",
  },
  {
    label: "Shenfield",
    value: "SNF",
  },
  {
    label: "Shenstone",
    value: "SEN",
  },
  {
    label: "Shepherds Bush",
    value: "SPB",
  },
  {
    label: "Shepherds Well",
    value: "SPH",
  },
  {
    label: "Shepley",
    value: "SPY",
  },
  {
    label: "Shepperton",
    value: "SHP",
  },
  {
    label: "Shepreth",
    value: "STH",
  },
  {
    label: "Sherborne",
    value: "SHE",
  },
  {
    label: "Sherburn-in-Elmet",
    value: "SIE",
  },
  {
    label: "Sheringham",
    value: "SHM",
  },
  {
    label: "Shettleston",
    value: "SLS",
  },
  {
    label: "Shieldmuir",
    value: "SDM",
  },
  {
    label: "Shifnal",
    value: "SFN",
  },
  {
    label: "Shildon",
    value: "SHD",
  },
  {
    label: "Shiplake",
    value: "SHI",
  },
  {
    label: "Shipley",
    value: "SHY",
  },
  {
    label: "Shippea Hill",
    value: "SPP",
  },
  {
    label: "Shipton",
    value: "SIP",
  },
  {
    label: "Shirebrook",
    value: "SHB",
  },
  {
    label: "Shirehampton",
    value: "SHH",
  },
  {
    label: "Shireoaks",
    value: "SRO",
  },
  {
    label: "Shirley",
    value: "SRL",
  },
  {
    label: "Shoeburyness",
    value: "SRY",
  },
  {
    label: "Sholing",
    value: "SHO",
  },
  {
    label: "Shoreditch High Street",
    value: "SDC",
  },
  {
    label: "Shoreham (Kent)",
    value: "SEH",
  },
  {
    label: "Shoreham-by-Sea",
    value: "SSE",
  },
  {
    label: "Shortlands",
    value: "SRT",
  },
  {
    label: "Shotton",
    value: "SHT",
  },
  {
    label: "Shotts",
    value: "SHS",
  },
  {
    label: "Shrewsbury",
    value: "SHR",
  },
  {
    label: "Sidcup",
    value: "SID",
  },
  {
    label: "Sileby",
    value: "SIL",
  },
  {
    label: "Silecroft",
    value: "SIC",
  },
  {
    label: "Silkstone Common",
    value: "SLK",
  },
  {
    label: "Silver Street",
    value: "SLV",
  },
  {
    label: "Silverdale",
    value: "SVR",
  },
  {
    label: "Singer",
    value: "SIN",
  },
  {
    label: "Sittingbourne",
    value: "SIT",
  },
  {
    label: "Skegness",
    value: "SKG",
  },
  {
    label: "Skewen",
    value: "SKE",
  },
  {
    label: "Skipton",
    value: "SKI",
  },
  {
    label: "Slade Green",
    value: "SGR",
  },
  {
    label: "Slaithwaite",
    value: "SWT",
  },
  {
    label: "Slateford",
    value: "SLA",
  },
  {
    label: "Sleaford",
    value: "SLR",
  },
  {
    label: "Sleights",
    value: "SLH",
  },
  {
    label: "Slough",
    value: "SLO",
  },
  {
    label: "Small Heath",
    value: "SMA",
  },
  {
    label: "Smallbrook Junction",
    value: "SAB",
  },
  {
    label: "Smethwick Galton Bridge",
    value: "SGB",
  },
  {
    label: "Smethwick Rolfe Street",
    value: "SMR",
  },
  {
    label: "Smithy Bridge",
    value: "SMB",
  },
  {
    label: "Snaith",
    value: "SNI",
  },
  {
    label: "Snodland",
    value: "SDA",
  },
  {
    label: "Snowdown",
    value: "SWO",
  },
  {
    label: "Sole Street",
    value: "SOR",
  },
  {
    label: "Solihull",
    value: "SOL",
  },
  {
    label: "Somerleyton",
    value: "SYT",
  },
  {
    label: "South Acton",
    value: "SAT",
  },
  {
    label: "South Bank",
    value: "SBK",
  },
  {
    label: "South Bermondsey",
    value: "SBM",
  },
  {
    label: "South Croydon",
    value: "SCY",
  },
  {
    label: "South Elmsall",
    value: "SES",
  },
  {
    label: "South Gosforth (T & W Metro)",
    value: "SGH",
  },
  {
    label: "South Greenford",
    value: "SGN",
  },
  {
    label: "South Gyle",
    value: "SGL",
  },
  {
    label: "South Hampstead",
    value: "SOH",
  },
  {
    label: "South Hylton (T & W Metro)",
    value: "SHZ",
  },
  {
    label: "South Kenton",
    value: "SOK",
  },
  {
    label: "South Merton",
    value: "SMO",
  },
  {
    label: "South Milford",
    value: "SOM",
  },
  {
    label: "South Ruislip",
    value: "SRU",
  },
  {
    label: "South Tottenham",
    value: "STO",
  },
  {
    label: "South Wigston",
    value: "SWS",
  },
  {
    label: "South Woodham Ferrers",
    value: "SOF",
  },
  {
    label: "Southall",
    value: "STL",
  },
  {
    label: "Southampton Airport Parkway",
    value: "SOA",
  },
  {
    label: "Southampton Central",
    value: "SOU",
  },
  {
    label: "Southampton Eastern Docks",
    value: "XSN",
  },
  {
    label: "Southampton Town Quay (Bus)",
    value: "STQ",
  },
  {
    label: "Southampton Western Docks",
    value: "XSK",
  },
  {
    label: "Southbourne",
    value: "SOB",
  },
  {
    label: "Southbury",
    value: "SBU",
  },
  {
    label: "Southease",
    value: "SEE",
  },
  {
    label: "Southend Airport",
    value: "SIA",
  },
  {
    label: "Southend Central",
    value: "SOC",
  },
  {
    label: "Southend East",
    value: "SOE",
  },
  {
    label: "Southend Victoria",
    value: "SOV",
  },
  {
    label: "Southminster",
    value: "SMN",
  },
  {
    label: "Southport",
    value: "SOP",
  },
  {
    label: "Southport, Lord Street (Bus)",
    value: "SOZ",
  },
  {
    label: "Southsea Hoverport (Bus)",
    value: "SHV",
  },
  {
    label: "Southwell (Bus)",
    value: "SLZ",
  },
  {
    label: "Southwick",
    value: "SWK",
  },
  {
    label: "Sowerby Bridge",
    value: "SOW",
  },
  {
    label: "Spalding",
    value: "SPA",
  },
  {
    label: "Spean Bridge",
    value: "SBR",
  },
  {
    label: "Spital",
    value: "SPI",
  },
  {
    label: "Spondon",
    value: "SPO",
  },
  {
    label: "Spooner Row",
    value: "SPN",
  },
  {
    label: "Spring Road",
    value: "SRI",
  },
  {
    label: "Springburn",
    value: "SPR",
  },
  {
    label: "Springfield",
    value: "SPF",
  },
  {
    label: "Squires Gate",
    value: "SQU",
  },
  {
    label: "St Albans",
    value: "SAC",
  },
  {
    label: "St Albans Abbey",
    value: "SAA",
  },
  {
    label: "St Andrews (Bus)",
    value: "SAO",
  },
  {
    label: "St Andrews Road",
    value: "SAR",
  },
  {
    label: "St Annes-on-the-Sea",
    value: "SAS",
  },
  {
    label: "St Austell",
    value: "SAU",
  },
  {
    label: "St Bees",
    value: "SBS",
  },
  {
    label: "St Budeaux Ferry Road",
    value: "SBF",
  },
  {
    label: "St Budeaux Victoria Road",
    value: "SBV",
  },
  {
    label: "St Columb Road",
    value: "SCR",
  },
  {
    label: "St Denys",
    value: "SDN",
  },
  {
    label: "St Erth",
    value: "SER",
  },
  {
    label: "St Germans",
    value: "SGM",
  },
  {
    label: "St Helens Central",
    value: "SNH",
  },
  {
    label: "St Helens Junction",
    value: "SHJ",
  },
  {
    label: "St Helier",
    value: "SIH",
  },
  {
    label: "St Ives",
    value: "SIV",
  },
  {
    label: "St James (T & W Metro)",
    value: "SJN",
  },
  {
    label: "St James Street",
    value: "SJS",
  },
  {
    label: "St James' Park",
    value: "SJP",
  },
  {
    label: "St Johns",
    value: "SAJ",
  },
  {
    label: "St Keyne Wishing Well Halt",
    value: "SKN",
  },
  {
    label: "St Leonards Warrior Square",
    value: "SLQ",
  },
  {
    label: "St Margarets (Hertfordshire)",
    value: "SMT",
  },
  {
    label: "St Margarets (London)",
    value: "SMG",
  },
  {
    label: "St Mary Cray",
    value: "SMY",
  },
  {
    label: "St Michaels",
    value: "STM",
  },
  {
    label: "St Neots",
    value: "SNO",
  },
  {
    label: "St Neots (Bus)",
    value: "XEI",
  },
  {
    label: "St Peters (T & W Metro)",
    value: "STZ",
  },
  {
    label: "Stadium of Light (T & W Metro)",
    value: "STI",
  },
  {
    label: "Stafford",
    value: "STA",
  },
  {
    label: "Staines",
    value: "SNS",
  },
  {
    label: "Stallingborough",
    value: "SLL",
  },
  {
    label: "Stalybridge",
    value: "SYB",
  },
  {
    label: "Stamford",
    value: "SMD",
  },
  {
    label: "Stamford Hill",
    value: "SMH",
  },
  {
    label: "Stanford-le-Hope",
    value: "SFO",
  },
  {
    label: "Stanhope",
    value: "SNP",
  },
  {
    label: "Stanlow & Thornton",
    value: "SNT",
  },
  {
    label: "Stansted Airport",
    value: "SSD",
  },
  {
    label: "Stansted Airport Bus Stop",
    value: "XTH",
  },
  {
    label: "Stansted Mountfitchet",
    value: "SST",
  },
  {
    label: "Staplehurst",
    value: "SPU",
  },
  {
    label: "Stapleton Road",
    value: "SRD",
  },
  {
    label: "Starbeck",
    value: "SBE",
  },
  {
    label: "Starcross",
    value: "SCS",
  },
  {
    label: "Staveley",
    value: "SVL",
  },
  {
    label: "Stechford",
    value: "SCF",
  },
  {
    label: "Steeton & Silsden",
    value: "SON",
  },
  {
    label: "Stepps",
    value: "SPS",
  },
  {
    label: "Stevenage",
    value: "SVG",
  },
  {
    label: "Stevenston",
    value: "STV",
  },
  {
    label: "Stewartby",
    value: "SWR",
  },
  {
    label: "Stewarton",
    value: "STT",
  },
  {
    label: "Stirling",
    value: "STG",
  },
  {
    label: "Stockport",
    value: "SPT",
  },
  {
    label: "Stocksfield",
    value: "SKS",
  },
  {
    label: "Stocksmoor",
    value: "SSM",
  },
  {
    label: "Stockton",
    value: "STK",
  },
  {
    label: "Stoke Mandeville",
    value: "SKM",
  },
  {
    label: "Stoke Newington",
    value: "SKW",
  },
  {
    label: "Stoke-on-Trent",
    value: "SOT",
  },
  {
    label: "Stone",
    value: "SNE",
  },
  {
    label: "Stone Crossing",
    value: "SCG",
  },
  {
    label: "Stone Crown Street (Bus)",
    value: "SCN",
  },
  {
    label: "Stone Granville Square (Bus)",
    value: "SGQ",
  },
  {
    label: "Stonebridge Park",
    value: "SBP",
  },
  {
    label: "Stonegate",
    value: "SOG",
  },
  {
    label: "Stonehaven",
    value: "STN",
  },
  {
    label: "Stonehouse",
    value: "SHU",
  },
  {
    label: "Stoneleigh",
    value: "SNL",
  },
  {
    label: "Stornoway, Lewis (Bus)",
    value: "SOY",
  },
  {
    label: "Stourbridge Junction",
    value: "SBJ",
  },
  {
    label: "Stourbridge Town",
    value: "SBT",
  },
  {
    label: "Stow",
    value: "SOI",
  },
  {
    label: "Stowmarket",
    value: "SMK",
  },
  {
    label: "Stranraer",
    value: "STR",
  },
  {
    label: "Stranraer West Pier (Bus)",
    value: "SWP",
  },
  {
    label: "Stratford (London)",
    value: "SRA",
  },
  {
    label: "Stratford International",
    value: "SFA",
  },
  {
    label: "Stratford Parkway",
    value: "STY",
  },
  {
    label: "Stratford-upon-Avon",
    value: "SAV",
  },
  {
    label: "Strathcarron",
    value: "STC",
  },
  {
    label: "Strawberry Hill",
    value: "STW",
  },
  {
    label: "Streatham",
    value: "STE",
  },
  {
    label: "Streatham Common",
    value: "SRC",
  },
  {
    label: "Streatham Hill",
    value: "SRH",
  },
  {
    label: "Street (Bus)",
    value: "XCU",
  },
  {
    label: "Streethouse",
    value: "SHC",
  },
  {
    label: "Stretford Metrolink (Bus)",
    value: "SRF",
  },
  {
    label: "Strines",
    value: "SRN",
  },
  {
    label: "Stromeferry",
    value: "STF",
  },
  {
    label: "Strood",
    value: "SOO",
  },
  {
    label: "Stroud",
    value: "STD",
  },
  {
    label: "Sturry",
    value: "STU",
  },
  {
    label: "Styal",
    value: "SYA",
  },
  {
    label: "Sudbury",
    value: "SUY",
  },
  {
    label: "Sudbury & Harrow Road",
    value: "SUD",
  },
  {
    label: "Sudbury Hill Harrow",
    value: "SDH",
  },
  {
    label: "Sugar Loaf",
    value: "SUG",
  },
  {
    label: "Summerston",
    value: "SUM",
  },
  {
    label: "Sunbury",
    value: "SUU",
  },
  {
    label: "Sunderland",
    value: "SUN",
  },
  {
    label: "Sundridge Park",
    value: "SUP",
  },
  {
    label: "Sunningdale",
    value: "SNG",
  },
  {
    label: "Sunnymeads",
    value: "SNY",
  },
  {
    label: "Surbiton",
    value: "SUR",
  },
  {
    label: "Surrey Quays",
    value: "SQE",
  },
  {
    label: "Sutton (London)",
    value: "SUO",
  },
  {
    label: "Sutton Coldfield",
    value: "SUT",
  },
  {
    label: "Sutton Common",
    value: "SUC",
  },
  {
    label: "Sutton Parkway",
    value: "SPK",
  },
  {
    label: "Swaffham Tourist Inf Ctr (Bus)",
    value: "SWB",
  },
  {
    label: "Swale",
    value: "SWL",
  },
  {
    label: "Swanley",
    value: "SAY",
  },
  {
    label: "Swanscombe",
    value: "SWM",
  },
  {
    label: "Swansea",
    value: "SWA",
  },
  {
    label: "Swansea Docks (Bus)",
    value: "SWF",
  },
  {
    label: "Swanwick",
    value: "SNW",
  },
  {
    label: "Sway",
    value: "SWY",
  },
  {
    label: "Swaythling",
    value: "SWG",
  },
  {
    label: "Swinderby",
    value: "SWD",
  },
  {
    label: "Swinderby A46 Roundabout (Bus)",
    value: "SWC",
  },
  {
    label: "Swindon",
    value: "SWI",
  },
  {
    label: "Swindon Bus Station",
    value: "XDK",
  },
  {
    label: "Swineshead",
    value: "SWE",
  },
  {
    label: "Swinton (Manchester)",
    value: "SNN",
  },
  {
    label: "Swinton (South Yorkshire)",
    value: "SWN",
  },
  {
    label: "Sydenham",
    value: "SYD",
  },
  {
    label: "Sydenham Hill",
    value: "SYH",
  },
  {
    label: "Syon Lane",
    value: "SYL",
  },
  {
    label: "Syston",
    value: "SYS",
  },
  {
    label: "Tackley",
    value: "TAC",
  },
  {
    label: "Tadworth",
    value: "TAD",
  },
  {
    label: "Taffs Well",
    value: "TAF",
  },
  {
    label: "Tain",
    value: "TAI",
  },
  {
    label: "Tal-y-Cafn",
    value: "TLC",
  },
  {
    label: "Talsarnau",
    value: "TAL",
  },
  {
    label: "Talybont",
    value: "TLB",
  },
  {
    label: "Tame Bridge Parkway",
    value: "TAB",
  },
  {
    label: "Tamworth",
    value: "TAM",
  },
  {
    label: "Tan-y-Bwlch (Bus)",
    value: "TYB",
  },
  {
    label: "Taplow",
    value: "TAP",
  },
  {
    label: "Tarbert, Harris (Bus)",
    value: "TBT",
  },
  {
    label: "Tattenham Corner",
    value: "TAT",
  },
  {
    label: "Taunton",
    value: "TAU",
  },
  {
    label: "Taunton (Bus)",
    value: "XDQ",
  },
  {
    label: "Tavistock (Bus)",
    value: "XCV",
  },
  {
    label: "Taynuilt",
    value: "TAY",
  },
  {
    label: "Teddington",
    value: "TED",
  },
  {
    label: "Tees Valley Airport (Bus)",
    value: "TVA",
  },
  {
    label: "Tees-side Airport",
    value: "TEA",
  },
  {
    label: "Teignmouth",
    value: "TGM",
  },
  {
    label: "Telford Central",
    value: "TFC",
  },
  {
    label: "Templecombe",
    value: "TMC",
  },
  {
    label: "Tenby",
    value: "TEN",
  },
  {
    label: "Teynham",
    value: "TEY",
  },
  {
    label: "Thames Ditton",
    value: "THD",
  },
  {
    label: "Thatcham",
    value: "THA",
  },
  {
    label: "Thatto Heath",
    value: "THH",
  },
  {
    label: "The Hawthorns",
    value: "THW",
  },
  {
    label: "The Lakes",
    value: "TLK",
  },
  {
    label: "Theale",
    value: "THE",
  },
  {
    label: "Theobalds Grove",
    value: "TEO",
  },
  {
    label: "Thetford",
    value: "TTF",
  },
  {
    label: "Thirsk",
    value: "THI",
  },
  {
    label: "Thornaby",
    value: "TBY",
  },
  {
    label: "Thorne North",
    value: "TNN",
  },
  {
    label: "Thorne South",
    value: "TNS",
  },
  {
    label: "Thornford",
    value: "THO",
  },
  {
    label: "Thornliebank",
    value: "THB",
  },
  {
    label: "Thornton Abbey",
    value: "TNA",
  },
  {
    label: "Thornton Heath",
    value: "TTH",
  },
  {
    label: "Thorntonhall",
    value: "THT",
  },
  {
    label: "Thorpe Bay",
    value: "TPB",
  },
  {
    label: "Thorpe Culvert",
    value: "TPC",
  },
  {
    label: "Thorpe-le-Soken",
    value: "TLS",
  },
  {
    label: "Three Bridges",
    value: "TBD",
  },
  {
    label: "Three Oaks",
    value: "TOK",
  },
  {
    label: "Thurgarton",
    value: "THU",
  },
  {
    label: "Thurnscoe",
    value: "THC",
  },
  {
    label: "Thurso",
    value: "THS",
  },
  {
    label: "Thurston",
    value: "TRS",
  },
  {
    label: "Tilbury Riverside (Bus)",
    value: "TBR",
  },
  {
    label: "Tilbury Town",
    value: "TIL",
  },
  {
    label: "Tile Hill",
    value: "THL",
  },
  {
    label: "Tilehurst",
    value: "TLH",
  },
  {
    label: "Tinsley Meadowhall (Tram)",
    value: "TIN",
  },
  {
    label: "Tintagel (Bus)",
    value: "XCY",
  },
  {
    label: "Tipton",
    value: "TIP",
  },
  {
    label: "Tir-phil",
    value: "TIR",
  },
  {
    label: "Tiree (Bus)",
    value: "TEE",
  },
  {
    label: "Tisbury",
    value: "TIS",
  },
  {
    label: "Tiverton (Bus)",
    value: "XDA",
  },
  {
    label: "Tiverton Parkway",
    value: "TVP",
  },
  {
    label: "Tobermory, Mull (Bus)",
    value: "TOB",
  },
  {
    label: "Todmorden",
    value: "TOD",
  },
  {
    label: "Tolworth",
    value: "TOL",
  },
  {
    label: "Ton Pentre",
    value: "TPN",
  },
  {
    label: "Tonbridge",
    value: "TON",
  },
  {
    label: "Tondu",
    value: "TDU",
  },
  {
    label: "Tonfanau",
    value: "TNF",
  },
  {
    label: "Tonypandy",
    value: "TNP",
  },
  {
    label: "Tooting",
    value: "TOO",
  },
  {
    label: "Topsham",
    value: "TOP",
  },
  {
    label: "Torquay",
    value: "TQY",
  },
  {
    label: "Torre",
    value: "TRR",
  },
  {
    label: "Totnes",
    value: "TOT",
  },
  {
    label: "Tottenham Court Road",
    value: "TCR",
  },
  {
    label: "Tottenham Hale",
    value: "TOM",
  },
  {
    label: "Totton",
    value: "TTN",
  },
  {
    label: "Tower Hill Underground",
    value: "ZTH",
  },
  {
    label: "Town Green",
    value: "TWN",
  },
  {
    label: "Trafford Park",
    value: "TRA",
  },
  {
    label: "Trecynon (Bus)",
    value: "XTO",
  },
  {
    label: "Trefforest",
    value: "TRF",
  },
  {
    label: "Trefforest Estate",
    value: "TRE",
  },
  {
    label: "Trehafod",
    value: "TRH",
  },
  {
    label: "Treherbert",
    value: "TRB",
  },
  {
    label: "Treorchy",
    value: "TRY",
  },
  {
    label: "Trimley",
    value: "TRM",
  },
  {
    label: "Tring",
    value: "TRI",
  },
  {
    label: "Troed-y-rhiw",
    value: "TRD",
  },
  {
    label: "Troon",
    value: "TRN",
  },
  {
    label: "Trowbridge",
    value: "TRO",
  },
  {
    label: "Truro",
    value: "TRU",
  },
  {
    label: "Tulloch",
    value: "TUL",
  },
  {
    label: "Tulse Hill",
    value: "TUH",
  },
  {
    label: "Tunbridge Wells",
    value: "TBW",
  },
  {
    label: "Turkey Street",
    value: "TUR",
  },
  {
    label: "Turnham Green Underground",
    value: "ZTG",
  },
  {
    label: "Turnpike Lane",
    value: "ZTL",
  },
  {
    label: "Tutbury & Hatton",
    value: "TUT",
  },
  {
    label: "Tweedbank",
    value: "TWB",
  },
  {
    label: "Twickenham",
    value: "TWI",
  },
  {
    label: "Twyford",
    value: "TWY",
  },
  {
    label: "Ty Croes",
    value: "TYC",
  },
  {
    label: "Ty Glas",
    value: "TGS",
  },
  {
    label: "Tygwyn",
    value: "TYG",
  },
  {
    label: "Tyndrum Lower",
    value: "TYL",
  },
  {
    label: "Tynemouth (T & W Metro)",
    value: "TYP",
  },
  {
    label: "Tyseley",
    value: "TYS",
  },
  {
    label: "Tywyn",
    value: "TYW",
  },
  {
    label: "Uckfield",
    value: "UCK",
  },
  {
    label: "Uddingston",
    value: "UDD",
  },
  {
    label: "Uig, Skye (Bus)",
    value: "UIG",
  },
  {
    label: "Ulceby",
    value: "ULC",
  },
  {
    label: "Ullapool (Bus)",
    value: "ULP",
  },
  {
    label: "Ulleskelf",
    value: "ULL",
  },
  {
    label: "Ulverston",
    value: "ULV",
  },
  {
    label: "Umberleigh",
    value: "UMB",
  },
  {
    label: "University",
    value: "UNI",
  },
  {
    label: "University (T & W Metro)",
    value: "UNV",
  },
  {
    label: "Uphall",
    value: "UHA",
  },
  {
    label: "Upholland",
    value: "UPL",
  },
  {
    label: "Upminster",
    value: "UPM",
  },
  {
    label: "Upminster Underground",
    value: "ZUM",
  },
  {
    label: "Upper Halliford",
    value: "UPH",
  },
  {
    label: "Upper Holloway",
    value: "UHL",
  },
  {
    label: "Upper Tyndrum",
    value: "UTY",
  },
  {
    label: "Upper Warlingham",
    value: "UWL",
  },
  {
    label: "Upton",
    value: "UPT",
  },
  {
    label: "Upwey",
    value: "UPW",
  },
  {
    label: "Urmston",
    value: "URM",
  },
  {
    label: "Uttoxeter",
    value: "UTT",
  },
  {
    label: "Valley",
    value: "VAL",
  },
  {
    label: "Valley Centertainment (Tram)",
    value: "VAE",
  },
  {
    label: "Vauxhall",
    value: "VXH",
  },
  {
    label: "Virginia Water",
    value: "VIR",
  },
  {
    label: "Waddon",
    value: "WDO",
  },
  {
    label: "Wadebridge Bus Station",
    value: "WBE",
  },
  {
    label: "Wadhurst",
    value: "WAD",
  },
  {
    label: "Wainfleet",
    value: "WFL",
  },
  {
    label: "Wakefield Kirkgate",
    value: "WKK",
  },
  {
    label: "Wakefield Westgate",
    value: "WKF",
  },
  {
    label: "Walkden",
    value: "WKD",
  },
  {
    label: "Wallasey Grove Road",
    value: "WLG",
  },
  {
    label: "Wallasey Village",
    value: "WLV",
  },
  {
    label: "Wallingford Market Place (Bus)",
    value: "XWX",
  },
  {
    label: "Wallington",
    value: "WLT",
  },
  {
    label: "Wallyford",
    value: "WAF",
  },
  {
    label: "Walmer",
    value: "WAM",
  },
  {
    label: "Walsall",
    value: "WSL",
  },
  {
    label: "Walsden",
    value: "WDN",
  },
  {
    label: "Waltham Cross",
    value: "WLC",
  },
  {
    label: "Walthamstow Central",
    value: "WHC",
  },
  {
    label: "Walthamstow Queens Road",
    value: "WMW",
  },
  {
    label: "Walton (Merseyside)",
    value: "WAO",
  },
  {
    label: "Walton-on-Thames",
    value: "WAL",
  },
  {
    label: "Walton-on-the-Naze",
    value: "WON",
  },
  {
    label: "Wanborough",
    value: "WAN",
  },
  {
    label: "Wandsworth Common",
    value: "WSW",
  },
  {
    label: "Wandsworth Road",
    value: "WWR",
  },
  {
    label: "Wandsworth Town",
    value: "WNT",
  },
  {
    label: "Wanstead Park",
    value: "WNP",
  },
  {
    label: "Wantage (Bus)",
    value: "XDC",
  },
  {
    label: "Wapping",
    value: "WPE",
  },
  {
    label: "Warblington",
    value: "WBL",
  },
  {
    label: "Ware",
    value: "WAR",
  },
  {
    label: "Wareham",
    value: "WRM",
  },
  {
    label: "Wargrave",
    value: "WGV",
  },
  {
    label: "Warminster",
    value: "WMN",
  },
  {
    label: "Warnham",
    value: "WNH",
  },
  {
    label: "Warrington Bank Quay",
    value: "WBQ",
  },
  {
    label: "Warrington Central",
    value: "WAC",
  },
  {
    label: "Warrington West",
    value: "WAW",
  },
  {
    label: "Warwick",
    value: "WRW",
  },
  {
    label: "Warwick Parkway",
    value: "WRP",
  },
  {
    label: "Warwick University (Bus)",
    value: "XWU",
  },
  {
    label: "Watchet (Bus)",
    value: "WCT",
  },
  {
    label: "Water Orton",
    value: "WTO",
  },
  {
    label: "Waterbeach",
    value: "WBC",
  },
  {
    label: "Wateringbury",
    value: "WTR",
  },
  {
    label: "Waterloo (Merseyside)",
    value: "WLO",
  },
  {
    label: "Waterloo Underground",
    value: "ZWA",
  },
  {
    label: "Watford High Street",
    value: "WFH",
  },
  {
    label: "Watford Junction",
    value: "WFJ",
  },
  {
    label: "Watford North",
    value: "WFN",
  },
  {
    label: "Watlington",
    value: "WTG",
  },
  {
    label: "Watton-at-Stone",
    value: "WAS",
  },
  {
    label: "Waun-gron Park",
    value: "WNG",
  },
  {
    label: "Wavertree Tech Park",
    value: "WAV",
  },
  {
    label: "Wedgwood",
    value: "WED",
  },
  {
    label: "Wedgwood Old Road Bridge (Bus)",
    value: "WER",
  },
  {
    label: "Weeley",
    value: "WEE",
  },
  {
    label: "Weeton",
    value: "WET",
  },
  {
    label: "Welham Green",
    value: "WMG",
  },
  {
    label: "Welling",
    value: "WLI",
  },
  {
    label: "Wellingborough",
    value: "WEL",
  },
  {
    label: "Wellington (Shropshire)",
    value: "WLN",
  },
  {
    label: "Wells (Bus)",
    value: "XDH",
  },
  {
    label: "Wells-Next-The-Sea (Bus)",
    value: "WEN",
  },
  {
    label: "Welshpool",
    value: "WLP",
  },
  {
    label: "Welwyn Garden City",
    value: "WGC",
  },
  {
    label: "Welwyn North",
    value: "WLW",
  },
  {
    label: "Wem",
    value: "WEM",
  },
  {
    label: "Wembley Central",
    value: "WMB",
  },
  {
    label: "Wembley Stadium",
    value: "WCX",
  },
  {
    label: "Wemyss Bay",
    value: "WMS",
  },
  {
    label: "Wendover",
    value: "WND",
  },
  {
    label: "Wennington",
    value: "WNN",
  },
  {
    label: "West Allerton",
    value: "WSA",
  },
  {
    label: "West Brompton",
    value: "WBP",
  },
  {
    label: "West Byfleet",
    value: "WBY",
  },
  {
    label: "West Calder",
    value: "WCL",
  },
  {
    label: "West Croydon",
    value: "WCY",
  },
  {
    label: "West Drayton",
    value: "WDT",
  },
  {
    label: "West Dulwich",
    value: "WDU",
  },
  {
    label: "West Ealing",
    value: "WEA",
  },
  {
    label: "West Ham",
    value: "WEH",
  },
  {
    label: "West Hampstead",
    value: "WHD",
  },
  {
    label: "West Hampstead Thameslink",
    value: "WHP",
  },
  {
    label: "West Horndon",
    value: "WHR",
  },
  {
    label: "West Kilbride",
    value: "WKB",
  },
  {
    label: "West Kirby",
    value: "WKI",
  },
  {
    label: "West Malling",
    value: "WMA",
  },
  {
    label: "West Norwood",
    value: "WNW",
  },
  {
    label: "West Ruislip",
    value: "WRU",
  },
  {
    label: "West Runton",
    value: "WRN",
  },
  {
    label: "West St Leonards",
    value: "WLD",
  },
  {
    label: "West Sutton",
    value: "WSU",
  },
  {
    label: "West Wickham",
    value: "WWI",
  },
  {
    label: "West Worthing",
    value: "WWO",
  },
  {
    label: "Westbury",
    value: "WSB",
  },
  {
    label: "Westbury (Bus)",
    value: "XDS",
  },
  {
    label: "Westcliff",
    value: "WCF",
  },
  {
    label: "Westcombe Park",
    value: "WCB",
  },
  {
    label: "Westenhanger",
    value: "WHA",
  },
  {
    label: "Wester Hailes",
    value: "WTA",
  },
  {
    label: "Westerfield",
    value: "WFI",
  },
  {
    label: "Westerton",
    value: "WES",
  },
  {
    label: "Westgate-on-Sea",
    value: "WGA",
  },
  {
    label: "Westhoughton",
    value: "WHG",
  },
  {
    label: "Weston Milton",
    value: "WNM",
  },
  {
    label: "Weston-super-Mare",
    value: "WSM",
  },
  {
    label: "Wetheral",
    value: "WRL",
  },
  {
    label: "Weybridge",
    value: "WYB",
  },
  {
    label: "Weymouth",
    value: "WEY",
  },
  {
    label: "Weymouth Quay (Bus)",
    value: "WYQ",
  },
  {
    label: "Whaley Bridge",
    value: "WBR",
  },
  {
    label: "Whalley",
    value: "WHE",
  },
  {
    label: "Whatstandwell",
    value: "WTS",
  },
  {
    label: "Whifflet",
    value: "WFF",
  },
  {
    label: "Whimple",
    value: "WHM",
  },
  {
    label: "Whinhill",
    value: "WNL",
  },
  {
    label: "Whiston",
    value: "WHN",
  },
  {
    label: "Whitby",
    value: "WTB",
  },
  {
    label: "Whitby Bus Station",
    value: "WTZ",
  },
  {
    label: "Whitchurch (Glamorgan)",
    value: "WHT",
  },
  {
    label: "Whitchurch (Hampshire)",
    value: "WCH",
  },
  {
    label: "Whitchurch (Shropshire)",
    value: "WTC",
  },
  {
    label: "White Hart Lane",
    value: "WHL",
  },
  {
    label: "White Notley",
    value: "WNY",
  },
  {
    label: "Whitechapel",
    value: "ZLW",
  },
  {
    label: "Whitechapel (Crossrail)",
    value: "WCC",
  },
  {
    label: "Whitecraigs",
    value: "WCR",
  },
  {
    label: "Whitehaven",
    value: "WTH",
  },
  {
    label: "Whitehill Prince of Wales (Bus",
    value: "WHH",
  },
  {
    label: "Whitland",
    value: "WTL",
  },
  {
    label: "Whitley Bridge",
    value: "WBD",
  },
  {
    label: "Whitlocks End",
    value: "WTE",
  },
  {
    label: "Whitstable",
    value: "WHI",
  },
  {
    label: "Whittlesea",
    value: "WLE",
  },
  {
    label: "Whittlesford Parkway",
    value: "WLF",
  },
  {
    label: "Whitton",
    value: "WTN",
  },
  {
    label: "Whitwell",
    value: "WWL",
  },
  {
    label: "Whyteleafe",
    value: "WHY",
  },
  {
    label: "Whyteleafe South",
    value: "WHS",
  },
  {
    label: "Wick",
    value: "WCK",
  },
  {
    label: "Wickford",
    value: "WIC",
  },
  {
    label: "Wickham Market",
    value: "WCM",
  },
  {
    label: "Widdrington",
    value: "WDD",
  },
  {
    label: "Widnes",
    value: "WID",
  },
  {
    label: "Widney Manor",
    value: "WMR",
  },
  {
    label: "Wigan North Western",
    value: "WGN",
  },
  {
    label: "Wigan Wallgate",
    value: "WGW",
  },
  {
    label: "Wigton",
    value: "WGT",
  },
  {
    label: "Wildmill",
    value: "WMI",
  },
  {
    label: "Willesden Junction",
    value: "WIJ",
  },
  {
    label: "Williamwood",
    value: "WLM",
  },
  {
    label: "Willington",
    value: "WIL",
  },
  {
    label: "Wilmcote",
    value: "WMC",
  },
  {
    label: "Wilmslow",
    value: "WML",
  },
  {
    label: "Wilnecote",
    value: "WNE",
  },
  {
    label: "Wimbledon",
    value: "WIM",
  },
  {
    label: "Wimbledon Chase",
    value: "WBO",
  },
  {
    label: "Winchelsea",
    value: "WSE",
  },
  {
    label: "Winchester",
    value: "WIN",
  },
  {
    label: "Winchfield",
    value: "WNF",
  },
  {
    label: "Winchmore Hill",
    value: "WIH",
  },
  {
    label: "Windermere",
    value: "WDM",
  },
  {
    label: "Windsor & Eton Central",
    value: "WNC",
  },
  {
    label: "Windsor & Eton Riverside",
    value: "WNR",
  },
  {
    label: "Winnersh",
    value: "WNS",
  },
  {
    label: "Winnersh Triangle",
    value: "WTI",
  },
  {
    label: "Winsford",
    value: "WSF",
  },
  {
    label: "Wisbech Horsefair (Bus)",
    value: "WIS",
  },
  {
    label: "Wishaw",
    value: "WSH",
  },
  {
    label: "Witham",
    value: "WTM",
  },
  {
    label: "Witley",
    value: "WTY",
  },
  {
    label: "Witney Market Place (Bus)",
    value: "WMP",
  },
  {
    label: "Witton",
    value: "WTT",
  },
  {
    label: "Wivelsfield",
    value: "WVF",
  },
  {
    label: "Wivenhoe",
    value: "WIV",
  },
  {
    label: "Woburn Sands",
    value: "WOB",
  },
  {
    label: "Woking",
    value: "WOK",
  },
  {
    label: "Wokingham",
    value: "WKM",
  },
  {
    label: "Woldingham",
    value: "WOH",
  },
  {
    label: "Wolverhampton",
    value: "WVH",
  },
  {
    label: "Wolverton",
    value: "WOL",
  },
  {
    label: "Wombwell",
    value: "WOM",
  },
  {
    label: "Wood End",
    value: "WDE",
  },
  {
    label: "Wood Street",
    value: "WST",
  },
  {
    label: "Woodbridge",
    value: "WDB",
  },
  {
    label: "Woodburn Road (Tram)",
    value: "WOD",
  },
  {
    label: "Woodgrange Park",
    value: "WGR",
  },
  {
    label: "Woodhall",
    value: "WDL",
  },
  {
    label: "Woodhouse",
    value: "WDH",
  },
  {
    label: "Woodlesford",
    value: "WDS",
  },
  {
    label: "Woodley",
    value: "WLY",
  },
  {
    label: "Woodley, Hunters Inn (Bus)",
    value: "WDY",
  },
  {
    label: "Woodmansterne",
    value: "WME",
  },
  {
    label: "Woodsmoor",
    value: "WSR",
  },
  {
    label: "Wool",
    value: "WOO",
  },
  {
    label: "Woolston",
    value: "WLS",
  },
  {
    label: "Woolwich (Crossrail)",
    value: "WOW",
  },
  {
    label: "Woolwich Arsenal",
    value: "WWA",
  },
  {
    label: "Woolwich Dockyard",
    value: "WWD",
  },
  {
    label: "Wootton Bassett (Bus)",
    value: "XDI",
  },
  {
    label: "Wootton Wawen",
    value: "WWW",
  },
  {
    label: "Worcester Foregate Street",
    value: "WOF",
  },
  {
    label: "Worcester Park",
    value: "WCP",
  },
  {
    label: "Worcester Shrub Hill",
    value: "WOS",
  },
  {
    label: "Worcestershire Parkway",
    value: "WOP",
  },
  {
    label: "Workington",
    value: "WKG",
  },
  {
    label: "Workington Bus Station",
    value: "WOX",
  },
  {
    label: "Worksop",
    value: "WRK",
  },
  {
    label: "Worle",
    value: "WOR",
  },
  {
    label: "Worplesdon",
    value: "WPL",
  },
  {
    label: "Worstead",
    value: "WRT",
  },
  {
    label: "Worthing",
    value: "WRH",
  },
  {
    label: "Wrabness",
    value: "WRB",
  },
  {
    label: "Wraysbury",
    value: "WRY",
  },
  {
    label: "Wrenbury",
    value: "WRE",
  },
  {
    label: "Wressle",
    value: "WRS",
  },
  {
    label: "Wrexham Central",
    value: "WXC",
  },
  {
    label: "Wrexham General",
    value: "WRX",
  },
  {
    label: "Wye",
    value: "WYE",
  },
  {
    label: "Wylam",
    value: "WYM",
  },
  {
    label: "Wylde Green",
    value: "WYL",
  },
  {
    label: "Wymondham",
    value: "WMD",
  },
  {
    label: "Wythall",
    value: "WYT",
  },
  {
    label: "Yalding",
    value: "YAL",
  },
  {
    label: "Yardley Wood",
    value: "YRD",
  },
  {
    label: "Yarm",
    value: "YRM",
  },
  {
    label: "Yarmouth (Isle of Wight)",
    value: "YMH",
  },
  {
    label: "Yate",
    value: "YAE",
  },
  {
    label: "Yatton",
    value: "YAT",
  },
  {
    label: "Yeoford",
    value: "YEO",
  },
  {
    label: "Yeovil Bus Station",
    value: "YVB",
  },
  {
    label: "Yeovil Junction",
    value: "YVJ",
  },
  {
    label: "Yeovil Pen Mill",
    value: "YVP",
  },
  {
    label: "Yetminster",
    value: "YET",
  },
  {
    label: "Ynyswen",
    value: "YNW",
  },
  {
    label: "Yoker",
    value: "YOK",
  },
  {
    label: "York",
    value: "YRK",
  },
  {
    label: "Yorton",
    value: "YRT",
  },
  {
    label: "Ystrad Mynach",
    value: "YSM",
  },
  {
    label: "Ystrad Rhondda",
    value: "YSR",
  },
]

const stationsWithCrs = stations.reduce((current, thisItem) => {
  return [
    ...current,
    {
      label: `${thisItem.label} - ${thisItem.value}`,
      value: thisItem.value,
    },
  ]
}, [])

export default stationsWithCrs
