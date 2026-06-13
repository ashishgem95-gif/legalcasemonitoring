const { callLLM } = require('./llmRouter');
const { logger } = require('../config/logger');

const TYPE_ADDENDUMS = {
  UPSC: `CASE TYPE GUIDANCE - UPSC ADVICE CASE:
- The departmental decision was made AFTER consultation with UPSC.
- Cite: Union of India Vs. T.V. Patel (2007) 4 SCC 785.
- Cite: State of Tamil Nadu Vs. Thiru K.V. Karuppiah (2007).
- Frame UPSC advice as directory (not binding on the Government).
- Distinguish between UPSC 'advice' (consultative) and 'concurrence' (binding).
- Emphasize that the final decision rests with the Government/President.`,

  '56j': `CASE TYPE GUIDANCE - RULE 56(j) COMPULSORY RETIREMENT:
- Cite: State of Gujarat Vs. Umedbhai M. Patel (2001) 3 SCC 314.
- Cite: Union of India Vs. Dulal Dutt (1993) 2 SCC 179.
- Compulsory retirement is NOT punishment (no stigma attached).
- Emphasize administrative discretion based on public interest.
- Distinguish from punitive actions under Discipline & Appeal Rules.
- Highlight that the order was made in public interest, not as a penalty.`,

  Contempt: `CASE TYPE GUIDANCE - CONTEMPT PETITION:
- Show bona fide intent and unconditional apology if applicable.
- Cite: Supreme Court Bar Association v. Union of India (1998) 4 SCC 409.
- Distinguish between civil contempt and criminal contempt.
- Emphasize that the alleged act was not willful or deliberate.
- Reference curative/remedial steps already taken.`,

  OA: '',
  Misc: '',
};

const BASE_PROMPT = `You are a senior legal counsel for the Ministry of Railways, Government of India, drafting a formal counter-affidavit / reply in an ongoing judicial proceeding. Use formal Indian legal English, structured as numbered paragraphs.

DRAFTING REQUIREMENTS:
1. Open with a proper title block (In the Court of..., Case No..., Title of the case).
2. Reply point-by-point to each contention raised in the uploaded affidavit.
3. Numbered paragraphs (1, 2, 3, ...) - each addressing a specific contention.
4. Cite relevant Railway Board rules, instructions, circulars, and established case law where applicable.
5. Reference the precedent cases the user provided to show consistency in departmental position.
6. Maintain a respectful, professional tone throughout.
7. Include a verification clause at the end (I, [name], do hereby verify...).
8. Include a signature block (Deponent, Place, Date).
9. Length: 1500-2500 words unless user has specified otherwise.

CUSTOM INSTRUCTIONS FROM USER:
{customInstructions}

CONTEXT (precedent cases the user provided - use these to maintain consistency in departmental position):
{precedents}

UPLOADED AFFIDAVIT TEXT TO REPLY TO:
{uploadedText}

Now draft the complete reply affidavit. Output ONLY the formal legal text, no preamble or explanation:`;

function detectCaseType(text) {
  if (!text) return 'OA';
  const t = text.toLowerCase();
  if (/\bupsc\b/.test(t) || /union public service commission/.test(t)) return 'UPSC';
  if (/56\s*\(\s*j\s*\)/.test(t) || /compulsory retirement/.test(t) || /premature retirement/.test(t)) return '56j';
  if (/contempt/.test(t)) return 'Contempt';
  return 'OA';
}

function buildPrecedentsText(precedents) {
  if (!precedents || precedents.length === 0) return '(No precedent cases provided)';
  return precedents.map((p, idx) => {
    return `[Precedent ${idx + 1}]
- Case Reference: ${p.case_ref_no || 'N/A'}
- Forum: ${p.forum || 'Unknown'}
- Applicant: ${p.applicant || 'N/A'}
- Respondent: ${p.respondent || 'N/A'}
- Case Type: ${p.case_type || 'N/A'}
- Present Status: ${p.present_status || 'Pending'}
- Synopsis: ${p.synopsis || 'N/A'}`;
  }).join('\n\n');
}

function buildPrompt({ caseType, uploadedText, precedents, customInstructions, promptOverride }) {
  if (promptOverride && promptOverride.trim()) {
    return promptOverride;
  }
  const addendum = TYPE_ADDENDUMS[caseType] || '';
  const baseTemplate = addendum ? `${BASE_PROMPT}\n\n${addendum}` : BASE_PROMPT;
  return baseTemplate
    .replace('{customInstructions}', customInstructions?.trim() || '(none)')
    .replace('{precedents}', buildPrecedentsText(precedents || []))
    .replace('{uploadedText}', uploadedText?.trim() || '(no text)');
}

async function generateReply({ provider, model, apiKey, caseType, uploadedText, precedents, customInstructions, promptOverride }) {
  const detectedType = caseType || detectCaseType(uploadedText);
  const prompt = buildPrompt({ caseType: detectedType, uploadedText, precedents, customInstructions, promptOverride });

  logger.info({
    caseType: detectedType,
    precedentCount: precedents?.length || 0,
    promptLength: prompt.length,
    uploadedTextLength: uploadedText?.length || 0,
    provider: provider || 'default',
    model: model || 'default',
  }, 'AI affidavit draft requested');

  const text = await callLLM({ provider, model, apiKey, prompt });

  logger.info({
    caseType: detectedType,
    responseLength: text.length,
    precedentCount: precedents?.length || 0,
  }, 'AI affidavit draft generated');

  return {
    text,
    detectedCaseType: detectedType,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
  };
}

module.exports = { generateReply, buildPrompt, detectCaseType, TYPE_ADDENDUMS };
