const https = require('https');

/**
 * Helper to perform HTTPS request and return response body as text.
 */
async function makeRequest(url, options, body) {
  const TIMEOUT_MS = 30000;
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      method: options.method || 'POST',
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`API responded with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    const timer = setTimeout(() => {
      req.destroy(new Error('LLM request timeout after 30s'));
    }, TIMEOUT_MS);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Dispatch prompt to chosen LLM provider and model.
 */
exports.callLLM = async ({ provider, model, apiKey, prompt }) => {
  const selectedProvider = (provider || 'gemini').toLowerCase().trim();
  
  // Resolve API key
  let key = apiKey;
  if (!key) {
    // Check .env variables
    const envKeyName = `${selectedProvider.toUpperCase()}_API_KEY`;
    key = process.env[envKeyName];
    if (!key && selectedProvider === 'gemini') {
      key = process.env.GEMINI_API_KEY; // Support legacy name
    }
  }

  if (!key || !key.trim() || key === 'undefined') {
    throw new Error(`API key for provider "${selectedProvider}" is not configured. Please supply it in Settings.`);
  }

  // Determine model
  let selectedModel = (model || '').trim();
  if (!selectedModel) {
    if (selectedProvider === 'gemini') selectedModel = 'gemini-1.5-flash';
    else if (selectedProvider === 'openai') selectedModel = 'gpt-4o-mini';
    else if (selectedProvider === 'anthropic') selectedModel = 'claude-3-5-sonnet-20241022';
    else if (selectedProvider === 'deepseek') selectedModel = 'deepseek-chat';
  }

  console.log(`Routing LLM prompt to Provider: ${selectedProvider}, Model: ${selectedModel}`);

  try {
    // 1. Google Gemini
    if (selectedProvider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`;
      const payload = {
        contents: [{
          parts: [{ text: prompt }]
        }]
      };
      const response = await makeRequest(url, {
        headers: { 'Content-Type': 'application/json' }
      }, payload);
      
      const parsed = JSON.parse(response);
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned an empty response.');
      }
      return text.trim();
    }

    // 2. OpenAI GPT
    if (selectedProvider === 'openai') {
      const url = 'https://api.openai.com/v1/chat/completions';
      const payload = {
        model: selectedModel,
        messages: [{ role: 'user', content: prompt }]
      };
      const response = await makeRequest(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        }
      }, payload);

      const parsed = JSON.parse(response);
      const text = parsed.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('OpenAI API returned an empty response.');
      }
      return text.trim();
    }

    // 3. Anthropic Claude
    if (selectedProvider === 'anthropic') {
      const url = 'https://api.anthropic.com/v1/messages';
      const payload = {
        model: selectedModel,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      };
      const response = await makeRequest(url, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        }
      }, payload);

      const parsed = JSON.parse(response);
      const text = parsed.content?.[0]?.text;
      if (!text) {
        throw new Error('Anthropic API returned an empty response.');
      }
      return text.trim();
    }

    // 4. DeepSeek
    if (selectedProvider === 'deepseek') {
      const url = 'https://api.deepseek.com/v1/chat/completions';
      const payload = {
        model: selectedModel,
        messages: [{ role: 'user', content: prompt }]
      };
      const response = await makeRequest(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        }
      }, payload);

      const parsed = JSON.parse(response);
      const text = parsed.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('DeepSeek API returned an empty response.');
      }
      return text.trim();
    }

    throw new Error(`Unsupported AI Provider: ${selectedProvider}`);
  } catch (err) {
    console.error(`LLM Call failed for ${selectedProvider} (${selectedModel}):`, err.message);
    throw err;
  }
};
