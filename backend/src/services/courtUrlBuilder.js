// CAT bench codes from cis.cgat.gov.in/catlive/case_status.php
const CAT_BENCH_CODES = {
  'CAT/Delhi':      100,  'CAT/N.Delhi':     100,  'CAT/N. Delhi':   100, 'CAT/N Delhi': 100,
  'CAT/Mumbai':     210,  'CAT/BB':           210,
  'CAT/Kolkata':    350,  'CAT/ Kolkata':     350,
  'CAT/Chennai':    310,
  'CAT/Patna':      116,
  'CAT/JP':         291,  'CAT/Jodhpur':      111,
  'CAT/JBL':        200,
  'CAT/ALD':        330,  'CAT/Allahabad':    330,
  'CAT/HYD':        21,   'CAT/HYB':          21,
  'CAT/Lko':        332,
  'CAT/ADI':        120,
  'CAT/CHD':        60,
  'CAT/GHY':        40,
  'CAT/Bangluru':   103,  'CAT/Bangalore':    103,  'CAT/Banglore': 103,
  'CAT/Ernakulam':  180,
  'CAT/CTC':        260,
  'CAT':            100,  // Default Principal Bench Delhi
};

// CAT case type values — primary type is extracted before any /
const CAT_CASE_TYPES = {
  'OA': 1, 'OA.': 1, 'TA': 2, 'MA': 3, 'MA/OA': 3, 'CP': 4, 'CP/OA': 4,
  'PT': 5, 'RA': 6, 'RA/OA': 6, 'RA/WP': 6, 'RP': 6, 'RP/WP': 6,
  'CCP': 7, 'MJC': 3, 'WPCT': 2, 'WPCT/OA': 2, 'OA/CP': 1, 'OA/MA': 3,
  'WP/OA': 1, 'CWJC': 1, 'CWP': 1, 'SCA': 1, 'SLP': 1,
};

// eCourtsIndia court codes for High Courts and Supreme Court
const ECOURTS_CODES = {
  'SC': 'SCIN01', 'Supreme Court': 'SCIN01',
  'HC/Delhi': 'DLHC01', 'HC/Mumbai': 'HCBM01', 'HC/BB': 'HCBM01',
  'HC/Kolkata': 'WBHC01', 'HC/Chennai': 'TNHC01',
  'HC/Banglore': 'KAHC01', 'HC/Bangluru': 'KAHC01',
  'HC/Patna': 'BRHC01', 'HC/JP': 'RJHC01', 'HC/JBL': 'MPHC01',
  'HC/ALD': 'UPHC01', 'HC/LKO': 'UPHC02', 'HC/Guj': 'GJHC01',
  'HC/ADI': 'GJHC01', 'HC/HYD': 'TSHC01', 'HC/TS': 'TSHC01',
  'HC/GHY': 'ASHC01', 'HC/CGH': 'CTHC01', 'HC/CTC': 'ORHC01',
  'HC/KNK': 'KAHC01', 'HC/Ernakulam': 'KLHC01',
};

function buildCourtUrls(caseRecord) {
  const forum = (caseRecord.forum || '').trim().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  const rawType = (caseRecord.case_type || '').trim().toUpperCase();
  // Take primary case type (before /) — e.g. "OA/CP" → "OA", "MA/OA" → "MA"
  const caseType = rawType.split('/')[0].replace(/\.$/, '');
  // Take primary case number (before / or ,) — e.g. "238/1052" → "238"
  const caseNum = String(caseRecord.case_number || '').trim().split(/[/,]|\s+/)[0];
  const caseYear = caseRecord.case_year;

  if (!forum || !caseNum || !caseYear) {
    return [{ url: null, source: 'Missing forum/case_number/year', method: 'GET' }];
  }

  // ── CAT: Direct API call ──
  if (forum.startsWith('CAT') || forum.includes('CAT')) {
    const benchCode = CAT_BENCH_CODES[forum];
    if (benchCode) {
      const catType = CAT_CASE_TYPES[rawType] || CAT_CASE_TYPES[caseType] || 1;
      return [{
        url: `https://cis.cgat.gov.in/catlive/partyDetail.php?caseNo=${caseNum}&benchCode1=${benchCode}&caseType=${catType}&year=${caseYear}&id=casetypewise`,
        source: `CAT ${forum} — case status API`,
        method: 'GET',
        benchCode, catType,
      }];
    }
    // Unknown CAT bench — link to general CAT page
    return [{
      url: 'https://cis.cgat.gov.in/catlive/case_status.php',
      source: 'CAT case status (select bench manually)',
      method: 'GET',
    }];
  }

  // ── Supreme Court ──
  if (forum === 'SC' || forum === 'Supreme Court') {
    return [{
      url: `https://ecourtsindia.com/search?q=${encodeURIComponent(caseType + ' ' + caseNum + ' ' + caseYear)}&cc=SCIN01&fy=${caseYear}`,
      source: 'Supreme Court — eCourtsIndia',
      method: 'GET',
    }];
  }

  // ── High Courts: eCourtsIndia search ──
  if (forum.startsWith('HC') || forum.startsWith('PHC')) {
    const cc = ECOURTS_CODES[forum];
    const q = caseType + '/' + caseNum + '/' + caseYear;
    if (cc) {
      return [{
        url: `https://ecourtsindia.com/search?q=${encodeURIComponent(q)}&cc=${cc}&fy=${caseYear}`,
        source: `${forum} — eCourtsIndia search`,
        method: 'GET',
      }];
    }
    return [{
      url: `https://ecourtsindia.com/search?q=${encodeURIComponent(q)}&fy=${caseYear}`,
      source: 'eCourtsIndia generic search',
      method: 'GET',
    }];
  }

  return [{
    url: `https://ecourtsindia.com/search?q=${encodeURIComponent(caseType + ' ' + caseNum + ' ' + caseYear)}&fy=${caseYear}`,
    source: 'eCourtsIndia generic search',
    method: 'GET',
  }];
}

module.exports = { buildCourtUrls, CAT_BENCH_CODES };
