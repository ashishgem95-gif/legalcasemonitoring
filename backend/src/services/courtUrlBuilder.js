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

// High Court eCourts portal codes (for direct search URL)
const ECOURTS_HC_CODES = {
  'HC/Delhi':   { state: 'DL', dist: '1', est: 'DLHC01' },
  'HC/Mumbai':  { state: 'MH', dist: '2', est: 'MHHC01' },
  'HC/BB':      { state: 'MH', dist: '2', est: 'MHHC01' },
  'HC/Kolkata': { state: 'WB', dist: '1', est: 'WBHC01' },
  'HC/Chennai': { state: 'TN', dist: '1', est: 'TNHC01' },
  'HC/Banglore':{ state: 'KA', dist: '1', est: 'KAHC01' },
  'HC/Bangluru':{ state: 'KA', dist: '1', est: 'KAHC01' },
  'HC/Patna':   { state: 'BR', dist: '1', est: 'BRHC01' },
  'HC/JP':      { state: 'RJ', dist: '1', est: 'RJHC01' },
  'HC/JBL':     { state: 'MP', dist: '1', est: 'MPHC01' },
  'HC/ALD':     { state: 'UP', dist: '1', est: 'UPHC01' },
  'HC/LKO':     { state: 'UP', dist: '2', est: 'UPHC02' },
  'HC/Guj':     { state: 'GJ', dist: '1', est: 'GJHC01' },
  'HC/ADI':     { state: 'GJ', dist: '1', est: 'GJHC01' },
  'HC/HYD':     { state: 'TS', dist: '1', est: 'TSHC01' },
  'HC/TS':      { state: 'TS', dist: '1', est: 'TSHC01' },
  'HC/GHY':     { state: 'AS', dist: '1', est: 'ASHC01' },
  'HC/CGH':     { state: 'CT', dist: '1', est: 'CTHC01' },
  'HC/CTC':     { state: 'OR', dist: '1', est: 'ORHC01' },
  'HC/KNK':     { state: 'KA', dist: '2', est: 'KAHC01' },
  'HC/Ernakulam':{ state: 'KL', dist: '1', est: 'KLHC01' },
};

// Case type codes for certain High Courts (numeric codes vary)
function getHCCaseTypeCode(caseType, forum) {
  const t = (caseType || '').toUpperCase();
  if (t.startsWith('WP')) return '3'; // Writ Petition
  if (t.startsWith('CRP')) return '4'; // Civil Revision
  if (t.startsWith('CA')) return '5'; // Civil Appeal
  if (t.startsWith('SCA')) return '6';
  if (t.startsWith('SLP')) return '7';
  if (t.startsWith('CP')) return '8';
  if (t.startsWith('OA')) return '3'; // May not apply to HC
  return '3'; // Default
}

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

  // ── High Courts: eCourtsIndia search (no CAPTCHA) + direct eCourts link ──
  if (forum.startsWith('HC') || forum.startsWith('PHC')) {
    const cc = ECOURTS_CODES[forum];
    const q = caseType + '/' + caseNum + '/' + caseYear;
    const urls = [];

    // Primary: eCourtsIndia search (no CAPTCHA needed)
    if (cc) {
      urls.push({
        url: `https://ecourtsindia.com/search?q=${encodeURIComponent(q)}&cc=${cc}&fy=${caseYear}`,
        source: `${forum} — eCourtsIndia search`,
        method: 'GET',
      });
    }

    // Secondary: Direct eCourts portal link (pre-filled, needs CAPTCHA)
    const hcInfo = ECOURTS_HC_CODES[forum];
    if (hcInfo) {
      const ctCode = getHCCaseTypeCode(caseType, forum);
      urls.push({
        url: `https://services.ecourts.gov.in/ecourtindia_v6/?p=high_court/caseStatus&app_token=&stateCode=${hcInfo.state}&distCode=${hcInfo.dist}&courtCode=${hcInfo.est}&caseType=${ctCode}&caseNo=${caseNum}&cYear=${caseYear}`,
        source: `${forum} — eCourts Portal (CAPTCHA required)`,
        method: 'GET',
        needsCaptcha: true,
      });
    }

    if (!cc) {
      urls.push({
        url: `https://ecourtsindia.com/search?q=${encodeURIComponent(q)}&fy=${caseYear}`,
        source: 'eCourtsIndia generic search',
        method: 'GET',
      });
    }

    return urls;
  }

  return [{
    url: `https://ecourtsindia.com/search?q=${encodeURIComponent(caseType + ' ' + caseNum + ' ' + caseYear)}&fy=${caseYear}`,
    source: 'eCourtsIndia generic search',
    method: 'GET',
  }];
}

module.exports = { buildCourtUrls, CAT_BENCH_CODES };
