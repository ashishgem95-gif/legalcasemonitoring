const { callLLM } = require('./llmRouter');

/**
 * Heuristics/regex fallback to extract case parameters and format them as YAML
 */
function fallbackRegexToYaml(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return `railway: CR
applicant: Unknown Petitioner
respondent: Union of India
employee_designation: 
case_type: OA
case_number: 0
case_year: 2026
forum: CAT
synopsis: Fresh case file ingested.
file_no: 
link_file_no: 
present_status: Pending`;
  }

  // 1. Clean and split sentences
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const sentences = cleanText.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

  // 2. Scan for case reference numbers (e.g. WP No 2342/2011, O.A. 123 of 2020, etc.)
  let case_type = 'OA';
  let case_number = '';
  let case_year = new Date().getFullYear();
  let forum = 'CAT';

  const refMatch = text.match(/(?:WP|W\.P\.|OA|O\.A\.|Civil Appeal|Writ Petition)\s*(?:No\.?|Num\.?)?\s*(\d+)\s*(?:\/|of)\s*(\d{4})/i);
  if (refMatch) {
    case_number = refMatch[1];
    case_year = refMatch[2];
    
    const typeStr = refMatch[0].toLowerCase();
    if (typeStr.includes('wp') || typeStr.includes('writ')) {
      case_type = 'WP';
      forum = 'HC';
    } else if (typeStr.includes('appeal')) {
      case_type = 'CA';
      forum = 'SC';
    }
  } else {
    // Try generic numbers
    const numMatch = text.match(/\b(\d+)\/(\d{4})\b/);
    if (numMatch) {
      case_number = numMatch[1];
      case_year = numMatch[2];
    }
  }

  // 3. Scan for forum
  if (/Supreme\s+Court/i.test(text)) {
    forum = 'SC';
  } else if (/High\s+Court/i.test(text)) {
    forum = 'HC';
  } else if (/Tribunal|CAT\b/i.test(text)) {
    forum = 'CAT';
  }

  // 4. Scan for applicant vs respondent (e.g. "UOI Vs John", "Jane versus Railway")
  let applicant = 'Union of India';
  let respondent = 'Respondent';
  
  const vsMatch = text.match(/(.*?)\s+(?:Vs\.?|VS|vs|versus|v\/s|V\/s)\s+(.*?)(?:\.|\s+filed|\s+pending|$)/i);
  if (vsMatch) {
    applicant = vsMatch[1].replace(/.*?(?:petitioner|applicant|between)\b/i, '').trim();
    respondent = vsMatch[2].replace(/(?:respondent|defendants).*?$/i, '').trim();
    applicant = applicant.substring(0, 100).trim();
    respondent = respondent.substring(0, 100).trim();
  }

  // 5. Scan for designation
  let employee_designation = '';
  const desMatch = text.match(/\b(AXEN|CMD|Sr\.\s*Store\s*Officer|ACM|Clerk|Nodal\s*Officer|Advocate)\b/i);
  if (desMatch) {
    employee_designation = desMatch[0];
  }

  // 6. Synopsis
  let synopsis = 'Case detail parsed from ingested text.';
  if (sentences.length > 0) {
    synopsis = sentences.slice(0, 2).join(' ').replace(/["']/g, '');
    if (synopsis.length > 250) {
      synopsis = synopsis.substring(0, 247) + '...';
    }
  }

  // 7. Status
  let present_status = 'Pending';
  if (/stay\s+granted/i.test(text)) {
    present_status = 'Stay Granted';
  } else if (/disposed|allowed|dismissed/i.test(text)) {
    present_status = 'Disposed';
  } else if (/sine\s+die/i.test(text)) {
    present_status = 'Sine Die';
  }

  // Return formatted YAML
  return `railway: CR
applicant: ${applicant || 'Petitioner'}
respondent: ${respondent || 'Union of India'}
employee_designation: ${employee_designation}
case_type: ${case_type}
case_number: ${case_number || '101'}
case_year: ${case_year}
forum: ${forum}
synopsis: ${synopsis}
file_no: 
link_file_no: 
present_status: ${present_status}`;
}

/**
 * Extracts case details from document text using LLM router, falling back to regex.
 */
exports.parseCaseFile = async (rawText, headers = {}) => {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return fallbackRegexToYaml('');
  }

  const provider = headers['x-ai-provider'];
  const model = headers['x-ai-model'];
  const apiKey = headers['x-ai-api-key'];

  try {
    const prompt = `Analyze the following legal case file, petition, or order text. Extract the key metadata fields and return them strictly in YAML format. Do not wrap the output in markdown code blocks (like \`\`\`yaml) or any other quotes. Return ONLY the valid raw YAML text containing the following fields:
- railway (use CR, ER, WR, SR, etc.)
- applicant (the petitioner or employee name)
- respondent (the defending party, e.g. UOI & Ors)
- employee_designation (the employee job title if mentioned)
- case_type (use WP, OA, CA, etc.)
- case_number (just the digit, e.g. 2342)
- case_year (just the 4 digit year, e.g. 2011)
- forum (use CAT, HC, SC)
- synopsis (a brief 1-2 sentence legal description of the dispute)
- file_no (office file number if found)
- link_file_no (linked file number if found)
- present_status (e.g. Pending, Stay Granted, Sine Die, Disposed)

Legal Document Text:
${rawText}`;

    const yamlOutput = await callLLM({ provider, model, apiKey, prompt });
    if (yamlOutput && yamlOutput.trim()) {
      return yamlOutput.replace(/```yaml/g, '').replace(/```/g, '').trim();
    }
  } catch (err) {
    console.warn('Failed to call LLM for case parsing, falling back to regex parser. Error:', err.message);
  }

  return fallbackRegexToYaml(rawText);
};

exports.fallbackRegexToYaml = fallbackRegexToYaml;
