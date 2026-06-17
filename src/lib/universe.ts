// Sector universe — 16 ETF benchmarks → constituent tickers.
// Extracted from trading workbook (Auto_beta sheet, 2026-06-17).
// Edit freely; the betas API uses this list on every refresh.

export const UNIVERSE: Record<string, string[]> = {
  QQQ: [
    "AAOI","AAPL","FSLR","HPQ","COST","BWXT","TTD","BE","IONQ","CRDO",
    "LTBR","QMCO","RGTI","QUBT","LAES","QBTS","DIS","KEYS","VRT","ESTC",
    "PSTG","MOD","MTZ","AI","DOCN","POWL","ASAN","AMZN","INTC","DELL",
    "FRSH","GOOGL","IREN","ST","CHWY","ETN","APH","SOFI","LSPD","BA",
    "HUBB","CFLT","JBL","META","KD","APLD","GEV","HPE","EME","CARR",
    "SPOT","APP","CEG","VST","NRG","OKLO","TLN","SMR","NNE","SONO",
    "FN","IBM","NTAP","WULF","CLS","NTNX","U","ANET","GRRR","RDDT",
    "NBIS","RKLB","ASTS","TEM","INOD","ZETA","CRWV","FLR","PWR","BTDR",
    "CORZ","KNX","FORM","AAON","SE","LITE","COHR","CIEN","GLW","TER",
    "TSEM","AXTI",
  ],
  IWM: [
    "RL","ROST","BOOT","DHI","URBN","FLUT","ORA","PHM","PYPL","PZZA",
    "NVR","IP","LEN","CBRL","LVS","CELH","KBH","IPI","MAT","GRBK",
    "ISRG","WYNN","TPH","DPZ","CIM","BXMT","MHK","W","ONON","ULTA",
    "BLDR","VFC","MGM","SEDG","FND","ASO","DRI","BZH","ILMN","TOL",
    "KNX","NVO","DKS","RNG","TMHC","NXT","NLY","DAR","ENPH","RXO",
    "TPR","SG","MGNI","BURL","BYD","LEVI","KMX","UPST","PENN","UBER",
    "BBWI","PVH","CMG","BROS","ANF","ABR","RH","NAIL","ITB","CROX",
    "AMRC","VSCO","ETSY","BKNG","NMRK","CZR","EAT","LYFT","AFRM",
    "TRIP","MELI","GAP","LMND","AEO","ARR","DFH","SHAK","WSM","EXPE",
    "XMTR","XYZ","DKNG","ALLY","AZEK","CPNG","DECK","WING",
    "AAL","DAL","ALK","UAL",
  ],
  XLE: [
    "EQT","CNQ","CVI","CRK","RRC","AR","WMB","CVE","CNX","CHX","PR",
    "VET","FANG","CTRA","SU","OXY","USO","PSX","TPL","HES","CHRD",
    "VLO","EOG","SM","XOM","HAL","DVN","SLB","COP","CVX","MPC","NOG",
    "APA","CRC","MTDR","OVV","CRGY","TALO","MGY","MUR","EC","BKR",
    "DK","NOV","OII","WHD","FTI","TDW","STNG","PAGP","HESM","OKE",
    "KMI","EPD","LNG","EE","PAA","TNK","TRGP","DINO","PARR","PBF","VNOM",
  ],
  DIA: [
    "TGT","CSX","VYM","YUM","CSCO","EW","LLY","FDX","CAT","TSCO",
    "GO","TRV","HD","LOW",
  ],
  BITO: ["HUT","MARA","BITO","COIN","MSTR","HOOD","GBTC","RIOT","CLSK","CRCL"],
  SMH: ["NVDA","TSM"],
  SOXL: [
    "AMAT","MRVL","ASML","ON","MCHP","MPWR","LRCX","MU","ENTG","KLAC",
    "TXN","QRVO","ADI","NXPI","QCOM","AMD","AVGO","ALAB","STX","SNDK",
    "WDC","ARM","NVMI",
  ],
  SPY: [
    "NFLX","FIG","DXCM","NKE","SFM","ALB","LYB","SBUX","RCL","CCL",
    "NCLH","CUK","CVNA","TT","USFD","OPEN","ABNB","BX","CAVA","PFGC",
    "SPYI","M","HIMS","HON","GE","MMM","IR","SYM","ODFL","JCI","AVAV",
    "PDYN","DPRO","ONDS","UMAC","KTOS","RCAT","BKSY","NTR","CF","MOS",
  ],
  XLF: [
    "COF","SYF","SCHW","RITM","MS","IVZ","STWD","JPM","BAC","TFC",
    "BRK.B","GS","WFC","C","FIS","MET","DPST","BLK","TROW","BEN",
    "AXP","APO","V","MA",
  ],
  XLI: ["GPK","GM","DE","ITW","UPS","A","KVYO","SWK","F","GNRC","STRL","PKG","WCC"],
  XLP: [
    "LW","BG","BF.B","BBY","BRBR","DLTR","KVUE","STZ","VZ","WMT","ADM",
    "T","KHC","TJX","HSY","CAG","CPB","SYY","PEP","MDLZ","POST","KDP",
    "TAP","MNST","GIS","SMPL","KO","SJM","HRL","FLO","DG","MKC","KMB",
    "PM","MO","PG","CL","CHD","CLX","MCD","TSN","ADP","BF.A",
  ],
  XLU: [
    "ED","ES","SRE","XEL","SO","DUK","AEP","EVRG","LNT","EIX","PNW",
    "WEC","CMS","DTE","OGE","ETR","CNP","PCG","PPL","D","EXC","NEE",
    "PEG","FE","ATO","NI","AWK",
  ],
  IGV: [
    "NOW","PD","LSPD","DOCU","S","ASAN","NTNX","CRM","MSFT","CDNS",
    "ESTC","AI","ZETA","SNPS","MNDY","ZS","ADSK","OKTA","PANW","INTU",
    "CRWD","WDAY","ZM","APPN","SNOW","DT","BOX","ORCL","RDDT","FIVN",
    "TEAM","IOT","DUOL","SHOP","DOCS","DASH","GTLB","ADBE","PATH",
    "VEEV","FOUR","TOST","BILL","FTNT","DBX","MDB","DDOG","TWLO","NET","YOU",
  ],
  GDX: [
    "AEM","KGC","EGO","RGLD","OR","AGI","SIL","IAG","NEM","GDXJ","WPM",
    "B","ITRG","HYMC","SBSW","PPTA","PLG","EMX","MUX","ASM","HMY","DRD",
    "AU","GFI","NG","SA","FNV","BTG","NGD","FSM","SSRM","EQX","CDE",
    "AG","HL","SVM","SILJ","EXK","PAAS",
  ],
  ARKK: ["PLTR","ROKU","TSLA","RBLX","TEM","SMCI"],
  KWEB: ["PDD","BABA","JD"],
};

export const BENCHMARKS = Object.keys(UNIVERSE);

export const SECTOR_LABEL: Record<string, string> = {
  QQQ:  "Nasdaq",
  IWM:  "Small Cap",
  XLE:  "Energy",
  DIA:  "Dow",
  BITO: "Crypto",
  SMH:  "Chips",
  SOXL: "Chips 3x",
  SPY:  "S&P 500",
  XLF:  "Finance",
  XLI:  "Industrials",
  XLP:  "Staples",
  XLU:  "Utilities",
  IGV:  "Software",
  GDX:  "Gold",
  ARKK: "Innovation",
  KWEB: "China",
};
