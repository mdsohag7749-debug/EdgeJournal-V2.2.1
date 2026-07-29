import { useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { exportAllData, downloadJSONFile, importAllData, estimateStorageBytes } from '../lib/storage';
import { Plus, X, Download, Upload, ShieldCheck, Database } from 'lucide-react';

function EditableList({ title, description, items, onChange }) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft('');
  }
  function remove(item) {
    onChange(items.filter((i) => i !== item));
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 className="section-title">{title}</h3>
      {description && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>{description}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {items.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Nothing added yet.</p>}
        {items.map((item) => (
          <div
            key={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13.5,
            }}
          >
            <span>{item}</span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(item)} aria-label={`Remove ${item}`}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add new..."
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '9px 12px',
            color: 'var(--text)',
            fontSize: 13.5,
          }}
        />
        <button className="btn btn-accent btn-sm" onClick={add}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

export default function System() {
  const {
    trades,
    goals,
    plans,
    reflections,
    models,
    setModels,
    riskCriteria,
    setRiskCriteria,
    checklistCriteria,
    setChecklistCriteria,
    reloadAllFromStorage,
  } = useData();
  const fileInputRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null);

  const bytes = estimateStorageBytes();
  const kb = (bytes / 1024).toFixed(1);

  function handleExport() {
    const data = exportAllData(trades.items, goals.items, plans.items, reflections.items);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSONFile(data, `edgejournal-backup-${stamp}.json`);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importAllData(data);
      reloadAllFromStorage();
      if (Array.isArray(data.trades) && data.trades.length) {
        await trades.importMany(data.trades);
      }
      if (Array.isArray(data.goals) && data.goals.length) {
        await goals.importMany(data.goals);
      }
      if (Array.isArray(data.plans) && data.plans.length) {
        await plans.importMany(data.plans);
      }
      if (Array.isArray(data.reflections) && data.reflections.length) {
        await reflections.importMany(data.reflections);
      }
      setImportMsg({ type: 'success', text: 'Backup imported successfully.' });
    } catch (err) {
      setImportMsg({ type: 'error', text: 'Could not import this file. Make sure it is a valid EdgeJournal backup JSON.' });
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>System</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Configure the models and checklists used throughout your journal</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <EditableList title="Trading Models" description="Used in the Trade Log dropdown." items={models} onChange={setModels} />
        <EditableList title="Risk Management Checklist" description="Criteria shown in the trade log's risk checklist." items={riskCriteria} onChange={setRiskCriteria} />
        <EditableList title="Trade Checklist" description="Criteria shown in the trade log's execution checklist." items={checklistCriteria} onChange={setChecklistCriteria} />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h3 className="section-title">
          <Database size={16} /> Backup & Restore
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, marginBottom: 18 }}>
          Trades, goals, pre-market plans, and reflections sync to your Supabase account automatically. Everything else (study notes) lives only in this browser's local storage — export a backup regularly so you never lose that data.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={15} /> Export JSON Backup
          </button>
          <button className="btn btn-ghost" onClick={handleImportClick}>
            <Upload size={15} /> Import JSON Backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />
        </div>
        {importMsg && (
          <p style={{ fontSize: 13, marginTop: 12, color: importMsg.type === 'success' ? 'var(--win)' : 'var(--loss)' }}>{importMsg.text}</p>
        )}
      </div>

      <div className="card" style={{ padding: 22, borderColor: 'rgba(255,59,78,0.25)', background: 'linear-gradient(180deg, rgba(255,59,78,0.06), transparent)' }}>
        <h3 className="section-title">
          <ShieldCheck size={16} color="var(--red)" /> Data Safety Notice
        </h3>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p>Trades, goals, pre-market plans, and reflections are stored in your Supabase account, protected by row-level security so only you can ever read or change them. Study notes are still stored only in this browser's local storage — nothing about those is sent to a server.</p>
          <p>Clearing your browser data, using a different browser, or switching devices won't affect your trades, goals, plans, or reflections, but will make study notes inaccessible unless you've exported a backup.</p>
          <p>Screenshots are stored as embedded images, so large libraries can grow storage usage quickly — export backups periodically.</p>
          <p style={{ marginTop: 4 }}>
            Current local storage usage: <span className="mono" style={{ color: 'var(--text)' }}>{kb} KB</span>
          </p>
        </div>
      </div>
    </div>
  );
}
