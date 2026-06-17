const { callLLM } = require('./llmRouter');

const CITATION_PARSE_PROMPT = `You are a legal research assistant for the Indian Railways.
Analyze the following court judgment text and extract citation metadata.

Return ONLY valid JSON (no markdown, no code fences, no commentary) with these exact keys:
- category: One of "56j" (if about Rule 56(j) compulsory retirement), or "upsc_advice" (if about UPSC advice/consultation)
- title: Full case citation in format "Party vs Party ((Year) Vol Reporter Page)" — extract from the judgment header
- description: Brief summary of the key legal holding and reasoning (max 250 words, 2-3 paragraphs)
- where_to_cite: Practical guidance on when this precedent should be cited in a counter-affidavit or reply pleading by the Railways (max 150 words)

Example output:
{"category":"56j","title":"Union of India vs Dulal Dutt (1993) 2 SCC 179","description":"The Supreme Court held that compulsory retirement under FR 56(j) is not a punishment...","where_to_cite":"Use this when defending a 56(j) retirement order challenged in CAT to argue that judicial review is limited..."}

If you cannot determine a value, use an empty string "".
If the text is not a legal judgment, return {"category":"","title":"","description":"","where_to_cite":""}.

--- JUDGMENT TEXT BELOW ---`;

async function parseCitationFromText(text, headers = {}) {
  const provider = (headers['x-ai-provider'] || 'gemini').toLowerCase().trim();
  const model = (headers['x-ai-model'] || '').trim();
  const apiKey = headers['x-ai-api-key'] || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'undefined') {
    return { error: 'No AI API key configured. Please set an API key in the gear icon settings.' };
  }

  const prompt = CITATION_PARSE_PROMPT + '\n\n' + (text.length > 8000 ? text.substring(0, 8000) + '\n\n[... text truncated ...]' : text);

  try {
    const aiResponse = await callLLM({ provider, model, apiKey, prompt });

    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    return {
      category: parsed.category || '',
      title: parsed.title || '',
      description: parsed.description || '',
      where_to_cite: parsed.where_to_cite || '',
    };
  } catch (err) {
    console.error('Citation AI parse error:', err.message);
    return { error: 'AI could not parse the judgment. Please fill in the details manually.' };
  }
}

module.exports = { parseCitationFromText };
