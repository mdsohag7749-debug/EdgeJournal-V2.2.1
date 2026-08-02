import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { fileToDataURL } from '../lib/utils';

export default function ImageUpload({ label, value, onChange }) {
  const [dragOver, setDragOver] = useState(false);

  async function processFile(file) {
    if (!file || !file.type?.startsWith('image/')) return;
    const dataUrl = await fileToDataURL(file);
    onChange(dataUrl);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }

  return (
    <div className="field">
      <label>{label}</label>
      {value ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: 'relative',
            border: dragOver ? '1px solid var(--red)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            background: 'var(--bg)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <img src={value} alt={label} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }} />
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onChange('')}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(10,10,12,0.75)' }}
            aria-label={`Remove ${label}`}
          >
            <X size={14} />
          </button>
          {dragOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--red-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--red)',
                pointerEvents: 'none',
              }}
            >
              Drop to replace
            </div>
          )}
        </div>
      ) : (
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: dragOver ? '1px dashed var(--red)' : '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '20px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            color: dragOver ? 'var(--red)' : 'var(--text-muted)',
            fontSize: 13,
            background: dragOver ? 'var(--red-glow)' : undefined,
            transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
          }}
        >
          <ImagePlus size={20} />
          <span>Tap to upload, or drag & drop an image</span>
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  );
}
