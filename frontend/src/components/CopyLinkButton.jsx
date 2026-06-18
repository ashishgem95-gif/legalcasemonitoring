import React, { useState } from 'react';

export default function CopyLinkButton({ caseId, size = 'sm' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}/cases/${caseId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
      document.body.removeChild(textarea);
    }
  };

  const btnStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: size === 'xs' ? '0.1rem' : '0.2rem 0.35rem',
    fontSize: size === 'xs' ? '0.7rem' : '0.8rem',
    color: copied ? 'var(--status-disposed)' : 'var(--text-muted)',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    transition: 'color 0.2s',
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={btnStyle}
      title={copied ? 'Copied!' : 'Copy case link'}
      aria-label="Copy case link"
    >
      {copied ? '\u2713 Copied' : '\u{1F517}'}
    </button>
  );
}
