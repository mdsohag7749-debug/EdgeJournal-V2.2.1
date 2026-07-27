import { ImagePlus, X } from 'lucide-react';
import { fileToDataURL } from '../lib/utils';

export default function ImageUpload({ label, value, onChange }) {
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    onChange(dataUrl);
    e.target.value = '';
  }

  return (
    <div className="field">
      <label>{label}</label>
      {value ? (
        <div
          style={{
            position: 'relative',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            background: 'var(--bg)',
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
        </div>
      ) : (
        <label
          style={{
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '20px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          <ImagePlus size={20} />
          <span>Click to upload image</span>
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  );
}
