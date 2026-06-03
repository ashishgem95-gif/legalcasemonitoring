import React, { useState, useEffect } from 'react';

export default function AiSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-1.5-flash');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Suggested models per provider
  const modelSuggestions = {
    gemini: [
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
    ],
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
    ],
    anthropic: [
      { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Sonnet 4.6)' },
      { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' }
    ],
    deepseek: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat (V3/V4)' },
      { value: 'deepseek-v4-flash', label: 'DeepSeek v4 Flash' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' }
    ]
  };

  // Load from localStorage on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem('ccms_provider') || 'gemini';
    const savedModel = localStorage.getItem('ccms_model') || 'gemini-1.5-flash';
    const savedKey = localStorage.getItem('ccms_apikey') || '';

    setProvider(savedProvider);
    setApiKey(savedKey);

    // Determine if the saved model matches any standard suggestions
    const suggestions = modelSuggestions[savedProvider] || [];
    const isStandard = suggestions.some(m => m.value === savedModel);

    if (isStandard || !savedModel) {
      setModel(savedModel || (suggestions[0]?.value || ''));
      setIsCustomModel(false);
    } else {
      setModel(savedModel);
      setIsCustomModel(true);
    }
  }, []);

  // Save changes to localStorage
  const saveSettings = (newProvider, newModel, newKey) => {
    localStorage.setItem('ccms_provider', newProvider);
    localStorage.setItem('ccms_model', newModel);
    localStorage.setItem('ccms_apikey', newKey);
  };

  const handleProviderChange = (e) => {
    const nextProvider = e.target.value;
    setProvider(nextProvider);

    // Default to first suggested model of the new provider
    const nextModel = modelSuggestions[nextProvider]?.[0]?.value || '';
    setModel(nextModel);
    setIsCustomModel(false);
    
    // Auto-load matching API Key if configured
    const key = localStorage.getItem('ccms_apikey') || '';
    saveSettings(nextProvider, nextModel, key);
  };

  const handleModelChange = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomModel(true);
      setModel('');
    } else {
      setIsCustomModel(false);
      setModel(val);
      saveSettings(provider, val, apiKey);
    }
  };

  const handleCustomModelChange = (e) => {
    const val = e.target.value;
    setModel(val);
    saveSettings(provider, val, apiKey);
  };

  const handleKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    saveSettings(provider, model, val);
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem 1rem', background: '#f9fafb', marginBottom: '1.25rem' }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="18" height="18" fill="none" stroke="#1f2937" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <strong style={{ fontSize: '0.85rem', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            एआई मॉडल एवं कुंजी सेटिंग्स / AI Model & API Configuration
          </strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', background: '#e5e7eb', color: '#374151', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
            {provider.toUpperCase()}: {model || 'Default'}
          </span>
          <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: '#4b5563', fontWeight: 'bold' }}>
            ▼
          </span>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            
            {/* AI Provider */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563', fontSize: '0.75rem' }}>AI Provider / प्रदाता</label>
              <select
                className="select-input"
                style={{ width: '100%', height: '38px', background: '#fff', borderColor: '#d1d5db', color: '#111827', padding: '0.4rem 0.75rem' }}
                value={provider}
                onChange={handleProviderChange}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="deepseek">DeepSeek AI</option>
              </select>
            </div>

            {/* AI Model */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563', fontSize: '0.75rem' }}>AI Model / मॉडल</label>
              {!isCustomModel ? (
                <select
                  className="select-input"
                  style={{ width: '100%', height: '38px', background: '#fff', borderColor: '#d1d5db', color: '#111827', padding: '0.4rem 0.75rem' }}
                  value={model}
                  onChange={handleModelChange}
                >
                  {(modelSuggestions[provider] || []).map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                  <option value="__custom__">⚙️ Enter Custom Model...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ flex: 1, height: '38px', background: '#fff', borderColor: '#d1d5db', color: '#111827', padding: '0.4rem 0.75rem' }}
                    placeholder="Enter custom model string..."
                    value={model}
                    onChange={handleCustomModelChange}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '38px', padding: '0 0.5rem' }}
                    onClick={() => {
                      setIsCustomModel(false);
                      const def = modelSuggestions[provider]?.[0]?.value || '';
                      setModel(def);
                      saveSettings(provider, def, apiKey);
                    }}
                    title="Switch to preset models"
                  >
                    Presets
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* API Key */}
          <div className="form-group">
            <label className="form-label" style={{ color: '#4b5563', fontSize: '0.75rem' }}>
              API Key / एपीआई कुंजी
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="form-control"
                style={{ width: '100%', paddingRight: '2.5rem', background: '#fff', borderColor: '#d1d5db', color: '#111827', height: '38px' }}
                placeholder={`Enter your private ${provider.toUpperCase()} API Key (saved locally in your browser)`}
                value={apiKey}
                onChange={handleKeyChange}
              />
              <button
                type="button"
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#4b5563',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem'
                }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
              ⚠️ Your key is saved locally in your browser's LocalStorage. It is sent as a secure header only to your backend server.
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
