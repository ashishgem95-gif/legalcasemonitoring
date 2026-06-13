import React, { useState } from 'react';
import api from '../utils/api';

const TYPE_ADDENDUMS = {
  UPSC: 'Drafting UPSC advice case reply. Cite T.V. Patel (2007) 4 SCC 785, K.V. Karuppiah (2007).',
  '56j': 'Drafting Rule 56(j) compulsory retirement case. Cite Umedbhai Patel (2001) 3 SCC 314, Dulal Dutt (1993) 2 SCC 179.',
  Contempt: 'Drafting contempt case reply. Cite SCBA v. UoI (1998) 4 SCC 409.',
  OA: 'Standard OA/TA/MA case reply.',
  Misc: 'Miscellaneous legal reply.',
};

function detectCaseTypeClient(text) {
  if (!text) return 'OA';
  const t = text.toLowerCase();
  if (/\bupsc\b/.test(t) || /union public service commission/.test(t)) return 'UPSC';
  if (/56\s*\(\s*j\s*\)/.test(t) || /compulsory retirement/.test(t) || /premature retirement/.test(t)) return '56j';
  if (/contempt/.test(t)) return 'Contempt';
  return 'OA';
}

function buildPromptPreview({ caseType, uploadedText, precedents, customInstructions }) {
  const addendum = TYPE_ADDENDUMS[caseType] || '';
  const precedentsText = precedents.length === 0
    ? '(No precedent cases provided)'
    : precedents.map((p, i) => `[Precedent ${i + 1}]\n- Case: ${p.case_ref_no || 'N/A'}\n- Forum: ${p.forum || 'N/A'}\n- Applicant: ${p.applicant || 'N/A'}\n- Respondent: ${p.respondent || 'N/A'}\n- Status: ${p.present_status || 'N/A'}\n- Synopsis: ${p.synopsis || 'N/A'}`).join('\n\n');
  return `You are a senior legal counsel for the Ministry of Railways, Government of India, drafting a formal counter-affidavit / reply in an ongoing judicial proceeding. Use formal Indian legal English, structured as numbered paragraphs.

DRAFTING REQUIREMENTS:
1. Open with a proper title block (In the Court of..., Case No..., Title).
2. Reply point-by-point to each contention.
3. Numbered paragraphs (1, 2, 3, ...).
4. Cite relevant Railway Board rules, instructions, and established case law.
5. Reference precedent cases to show consistency.
6. Maintain professional tone.
7. Include verification clause at the end.
8. Include signature block (Deponent, Place, Date).
9. Length: 1500-2500 words.

CUSTOM INSTRUCTIONS FROM USER:
${customInstructions?.trim() || '(none)'}

${addendum ? '\n' + addendum + '\n' : ''}
CONTEXT (precedent cases):
${precedentsText}

UPLOADED AFFIDAVIT TEXT TO REPLY TO:
${uploadedText?.trim()?.substring(0, 3000) || '(no text)'}
${uploadedText && uploadedText.length > 3000 ? '\n... [truncated for preview, full text will be sent]' : ''}

Now draft the complete reply affidavit. Output ONLY the formal legal text:`;
}

export default function AiDraftReply() {
  const [uploadedText, setUploadedText] = useState('');
  const [filename, setFilename] = useState('');
  const [caseType, setCaseType] = useState('OA');
  const [caseTypeOverridden, setCaseTypeOverridden] = useState(false);
  const [precedents, setPrecedents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [promptOverride, setPromptOverride] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [error, setError] = useState(null);

  const handleFileUpload = async (file) => {
    setError(null);
    if (!file) return;
    setFilename(file.name);
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const result = await api.extractPdfText(file);
        const text = result.text || '';
        setUploadedText(text);
        if (!caseTypeOverridden) {
          const detected = detectCaseTypeClient(text);
          setCaseType(detected);
        }
      } catch (err) {
        setError('PDF extraction failed: ' + err.message);
      }
    } else {
      try {
        const text = await file.text();
        setUploadedText(text);
        if (!caseTypeOverridden) {
          const detected = detectCaseTypeClient(text);
          setCaseType(detected);
        }
      } catch (err) {
        setError('File read failed: ' + err.message);
      }
    }
  };

  const handleTextPaste = (text) => {
    setUploadedText(text);
    setFilename('Pasted text');
    if (!caseTypeOverridden) {
      const detected = detectCaseTypeClient(text);
      setCaseType(detected);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const results = await api.getCases({ search: searchQuery });
      setSearchResults(results.slice(0, 20));
    } catch (err) {
      setError('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  const togglePrecedent = (c) => {
    if (precedents.find(p => p.id === c.id)) {
      setPrecedents(precedents.filter(p => p.id !== c.id));
    } else if (precedents.length < 5) {
      setPrecedents([...precedents, c]);
    } else {
      setError('Maximum 5 precedents allowed. Remove one to add another.');
    }
  };

  const handleCaseTypeChange = (newType) => {
    setCaseType(newType);
    setCaseTypeOverridden(true);
  };

  const handleGenerate = async () => {
    setError(null);
    if (!uploadedText.trim()) {
      setError('Please upload an affidavit or paste text first.');
      return;
    }
    if (precedents.length === 0) {
      setError('Please select at least 1 precedent case.');
      return;
    }
    setGenerating(true);
    try {
      const result = await api.generateDraftReply({
        caseType,
        uploadedText,
        precedents,
        customInstructions,
        promptOverride: promptOverride.trim() || undefined,
      });
      setGeneratedDraft(result.text || '');
    } catch (err) {
      setError('Generation failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedDraft('');
    setTimeout(() => handleGenerate(), 100);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDraft);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="goi-banner" style={{
        background: 'linear-gradient(135deg, #0f2c59 0%, #1e3a8a 100%)',
        padding: '1.75rem 2rem', borderRadius: '12px', color: '#fff', marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(15, 44, 89, 0.15)',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontFamily: 'Outfit', fontWeight: 800, margin: 0 }}>
          ✨ AI Affidavit / Reply Drafter
        </h1>
        <p style={{ color: '#93c5fd', fontSize: '0.9rem', margin: '0.4rem 0 0 0' }}>
          Upload a new affidavit, pick 3-5 precedent cases, and generate a draft reply in formal legal language.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          ❌ {error}
        </div>
      )}

      <Section title="1. Upload New Affidavit">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            onChange={e => handleFileUpload(e.target.files[0])}
            style={{ fontSize: '0.875rem' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>or paste text:</span>
            <button
              type="button"
              onClick={() => {
                const text = prompt('Paste the affidavit text:');
                if (text) handleTextPaste(text);
              }}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
            >
              Paste Text
            </button>
          </div>
          {filename && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#0369a1' }}>
              📄 <strong>{filename}</strong> ({uploadedText.length.toLocaleString()} chars loaded)
            </div>
          )}
        </div>
      </Section>

      <Section title="2. Case Type">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={caseType}
            onChange={e => handleCaseTypeChange(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', minWidth: '200px' }}
          >
            <option value="OA">OA / TA / MA (Regular)</option>
            <option value="UPSC">UPSC Advice Case</option>
            <option value="56j">Rule 56(j) Compulsory Retirement</option>
            <option value="Contempt">Contempt Petition</option>
            <option value="Misc">Miscellaneous</option>
          </select>
          {caseTypeOverridden && (
            <span style={{ fontSize: '0.75rem', color: '#92400e', background: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              ✋ Manually set
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {TYPE_ADDENDUMS[caseType]}
          </span>
        </div>
      </Section>

      <Section title={`3. Select Precedent Cases (${precedents.length}/5)`}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="Search by case ref, applicant, respondent..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{ padding: '0.5rem 1rem', background: '#0f2c59', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600, cursor: searching ? 'wait' : 'pointer' }}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {precedents.length > 0 && (
          <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Selected:</span>
            {precedents.map(p => (
              <span key={p.id} style={{ background: '#dbeafe', border: '1px solid #93c5fd', color: '#1e3a8a', padding: '0.25rem 0.6rem', borderRadius: '14px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                {p.case_ref_no}
                <button
                  onClick={() => togglePrecedent(p)}
                  style={{ background: 'none', border: 'none', color: '#1e3a8a', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', padding: 0, lineHeight: 1 }}
                  title="Remove"
                >×</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
          {searchResults.length === 0 && !searching && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
              Search for cases above to see results. Click on a row to add as precedent.
            </div>
          )}
          {searchResults.map(c => {
            const isSelected = precedents.some(p => p.id === c.id);
            return (
              <div
                key={c.id}
                onClick={() => togglePrecedent(c)}
                style={{
                  padding: '0.6rem 0.85rem',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  fontSize: '0.82rem',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <input type="checkbox" checked={isSelected} readOnly style={{ marginTop: '0.2rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#0f2c59' }}>{c.case_ref_no}</div>
                  <div style={{ color: '#4b5563', marginTop: '0.15rem' }}>
                    {c.applicant?.substring(0, 60) || 'N/A'} <span style={{ color: '#9ca3af' }}>vs</span> {c.respondent?.substring(0, 60) || 'N/A'}
                  </div>
                  <div style={{ color: '#6b7280', marginTop: '0.15rem', fontSize: '0.75rem' }}>
                    {c.forum} | {c.present_status || 'Pending'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="4. Custom Instructions (optional)">
        <textarea
          placeholder="e.g. 'Focus on denial of promotion grounds. Cite 2018 Supreme Court ruling on promotion policy.'"
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', fontFamily: 'inherit' }}
        />
      </Section>

      <Section title="5. Prompt Preview (optional - edit before sending)">
        <button
          onClick={() => setShowPromptPreview(!showPromptPreview)}
          style={{ background: 'none', border: 'none', color: '#0f2c59', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
        >
          {showPromptPreview ? '▼ Hide' : '▶ Show'} full prompt (editable)
        </button>
        {showPromptPreview && (
          <div style={{ marginTop: '0.75rem' }}>
            <textarea
              value={promptOverride || buildPromptPreview({ caseType, uploadedText, precedents, customInstructions })}
              onChange={e => setPromptOverride(e.target.value)}
              rows={14}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', lineHeight: 1.5 }}
            />
            {promptOverride && (
              <button
                onClick={() => setPromptOverride('')}
                style={{ marginTop: '0.5rem', padding: '0.3rem 0.7rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Reset to auto-generated
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="6. Generate Draft">
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating ? '#9ca3af' : 'linear-gradient(135deg, #0f2c59 0%, #1e3a8a 100%)',
            color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem 1.5rem',
            fontSize: '0.95rem', fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          {generating ? (
            <>
              <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Generating (10-60 sec)...
            </>
          ) : (
            <>✨ Generate Reply</>
          )}
        </button>
      </Section>

      {generatedDraft && (
        <Section title="7. Generated Draft (editable - copy and use as needed)">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleCopy}
              style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              📋 Copy
            </button>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}
            >
              🔄 Regenerate (same inputs)
            </button>
            <button
              onClick={() => setGeneratedDraft('')}
              style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              🗑️ Clear
            </button>
            <span style={{ fontSize: '0.8rem', color: '#6b7280', alignSelf: 'center' }}>
              {generatedDraft.length.toLocaleString()} characters
            </span>
          </div>
          <textarea
            value={generatedDraft}
            onChange={e => setGeneratedDraft(e.target.value)}
            rows={20}
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace', lineHeight: 1.6 }}
          />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #d1d5db', borderRadius: '12px',
      padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
    }}>
      <h3 style={{ fontSize: '1rem', color: '#0f2c59', margin: '0 0 0.85rem 0', fontWeight: 700, fontFamily: 'Outfit' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
