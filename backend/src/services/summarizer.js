const { callLLM } = require('./llmRouter');

/**
 * Heuristic/Regex based summarizer that extracts sentences containing key directives.
 */
function fallbackRegexParser(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return 'No court order text available.';
  }

  const cleanText = rawText.replace(/\s+/g, ' ').trim();
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const keywords = ['ordered', 'directed', 'shall', 'allowed', 'dismissed', 'adjourned'];
  const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');

  const matchingSentences = sentences.filter(sentence => regex.test(sentence));

  if (matchingSentences.length > 0) {
    return matchingSentences.slice(0, 3).join(' ');
  }

  return sentences.slice(0, 2).join(' ');
}

/**
 * Summarizes the court order raw text.
 * Dispatches the summarization prompt to the LLM router using custom headers.
 */
async function summarizeOrder(rawText, headers = {}) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return '';
  }

  const provider = headers['x-ai-provider'];
  const model = headers['x-ai-model'];
  const apiKey = headers['x-ai-api-key'];

  try {
    const prompt = `Summarize the following court order text in 1-2 concise sentences focusing on the key actions/directives. Do not include introductory text like "Here is a summary". Just return the summary itself:\n\n${rawText}`;
    const summary = await callLLM({ provider, model, apiKey, prompt });
    if (summary && summary.trim()) {
      return summary.trim();
    }
  } catch (err) {
    console.warn('Failed to call LLM for order summarization, falling back to regex parser. Error:', err.message);
  }

  return fallbackRegexParser(rawText);
}

module.exports = {
  summarizeOrder,
  fallbackRegexParser
};
