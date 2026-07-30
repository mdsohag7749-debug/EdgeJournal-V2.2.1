// Trade Screenshot Upload UI. Two exports sharing one data hook:
//   - TradeScreenshotManager: full upload/preview/delete/replace grid,
//     used inside TradeFormPanel (a trade must already be saved, since
//     the storage path is keyed by trade id).
//   - TradeScreenshotGallery: lazy-loading, read-only grid + Lightbox,
//     used inside the Trade Details expanded row.
// Both talk to Supabase only through src/lib/screenshotApi.js.

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X, RefreshCw, Images } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Lightbox from './Lightbox';
import {
  listScreenshots,
  uploadScreenshot,
  deleteScreenshot,
  replaceScreenshot,
  MAX_SCREENSHOTS_PER_TRADE,
  SCREENSHOT_ACCEPTED_LABEL,
} from '../lib/screenshotApi';

function useTradeScreenshots(tradeId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!tradeId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listScreenshots(tradeId);
      setItems(rows);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load screenshots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId]);

  return { items, setItems, loading, error, setError, reload: load };
}

function GridThumb({ children }) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '4 / 3',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
      }}
    >
      {children}
    </div>
  );
}

function ProgressOverlay({ percent, label }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(10,10,12,0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: '#fff',
        fontSize: 11.5,
      }}
    >
      <span>{label}</span>
      <div style={{ width: '70%', height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--red)', transition: 'width 0.15s ease' }} />
      </div>
      <span>{percent}%</span>
    </div>
  );
}

// Full manager: upload button, per-image preview/replace/delete,
// upload progress. Only usable once the trade has a real id.
export function TradeScreenshotManager({ tradeId }) {
  const { user } = useAuth();
  const { items, setItems, loading, error, setError, reload } = useTradeScreenshots(tradeId);
  const [lightbox, setLightbox] = useState(null);
  const [uploadPct, setUploadPct] = useState(null);
  const [busyId, setBusyId] = useState(null); // screenshot currently being replaced/deleted
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const replaceTargetRef = useRef(null);

  const atLimit = items.length >= MAX_SCREENSHOTS_PER_TRADE;

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id || !tradeId) return;

    setError('');
    setUploadPct(0);
    try {
      const saved = await uploadScreenshot(user.id, tradeId, file, setUploadPct);
      setItems((prev) => [...prev, saved]);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploadPct(null);
    }
  }

  async function handleReplaceFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !user?.id || !tradeId || !target) return;

    setError('');
    setBusyId(target.id);
    setUploadPct(0);
    try {
      const saved = await replaceScreenshot(user.id, tradeId, target, file, setUploadPct);
      setItems((prev) => prev.map((s) => (s.id === target.id ? saved : s)));
    } catch (err) {
      setError(err.message || 'Replace failed.');
    } finally {
      setBusyId(null);
      setUploadPct(null);
    }
  }

  function triggerReplace(screenshot) {
    replaceTargetRef.current = screenshot;
    replaceInputRef.current?.click();
  }

  async function handleDelete(screenshot) {
    setError('');
    setBusyId(screenshot.id);
    try {
      await deleteScreenshot(screenshot);
      setItems((prev) => prev.filter((s) => s.id !== screenshot.id));
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (!tradeId) {
    return (
      <div className="field">
        <label>Trade Screenshots</label>
        <div
          style={{
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px 12px',
            fontSize: 12.5,
            color: 'var(--text-faint)',
            textAlign: 'center',
          }}
        >
          Save this trade first, then come back to attach up to {MAX_SCREENSHOTS_PER_TRADE} screenshots.
        </div>
      </div>
    );
  }

  return (
    <div className="field">
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Trade Screenshots</span>
        <span style={{ fontWeight: 400, color: 'var(--text-faint)', fontSize: 11.5 }}>
          {items.length}/{MAX_SCREENSHOTS_PER_TRADE}
        </span>
      </label>

      {error && (
        <p style={{ fontSize: 12, color: 'var(--loss)', marginBottom: 8 }}>{error}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
        {items.map((s) => (
          <GridThumb key={s.id}>
            {s.url && (
              <img
                src={s.url}
                alt={s.fileName || 'Trade screenshot'}
                loading="lazy"
                onClick={() => setLightbox(s.url)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
              />
            )}
            {busyId === s.id && uploadPct !== null && <ProgressOverlay percent={uploadPct} label="Replacing" />}
            {busyId === s.id && uploadPct === null && <ProgressOverlay percent={100} label="Removing" />}
            {busyId !== s.id && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  display: 'flex',
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => triggerReplace(s)}
                  aria-label="Replace screenshot"
                  style={{ background: 'rgba(10,10,12,0.75)' }}
                >
                  <RefreshCw size={13} color="#fff" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => handleDelete(s)}
                  aria-label="Delete screenshot"
                  style={{ background: 'rgba(10,10,12,0.75)' }}
                >
                  <X size={13} color="#fff" />
                </button>
              </div>
            )}
          </GridThumb>
        ))}

        {!atLimit && (
          <GridThumb>
            {uploadPct !== null ? (
              <ProgressOverlay percent={uploadPct} label="Uploading" />
            ) : (
              <label
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 11.5,
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <ImagePlus size={18} />
                <span>Add screenshot</span>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleUpload} style={{ display: 'none' }} />
              </label>
            )}
          </GridThumb>
        )}
      </div>

      {loading && items.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>Loading screenshots…</p>}
      {!loading && items.length === 0 && !uploadPct && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
          {SCREENSHOT_ACCEPTED_LABEL} · up to 10 MB each
        </p>
      )}

      {/* Hidden input reused for every "replace" click so we don't mount
          one <input> per thumbnail. */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleReplaceFile}
        style={{ display: 'none' }}
      />

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

// Read-only lazy-loading gallery for the Trade Details expanded row.
// Editing (upload/delete/replace) happens in TradeFormPanel — here the
// user can only preview via the Lightbox, matching how the legacy
// single `screenshot` field already behaves in this view.
export function TradeScreenshotGallery({ tradeId }) {
  const { items, loading, error } = useTradeScreenshots(tradeId);
  const [lightbox, setLightbox] = useState(null);

  if (loading) {
    return <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Loading screenshots…</div>;
  }
  if (error) {
    return <div style={{ fontSize: 12.5, color: 'var(--loss)' }}>{error}</div>;
  }
  if (!items.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Images size={14} /> No screenshots attached.
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          marginBottom: 8,
        }}
      >
        Trade Screenshots ({items.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
        {items.map((s) => (
          <GridThumb key={s.id}>
            {s.url && (
              <img
                src={s.url}
                alt={s.fileName || 'Trade screenshot'}
                loading="lazy"
                onClick={() => setLightbox(s.url)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
              />
            )}
          </GridThumb>
        ))}
      </div>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
