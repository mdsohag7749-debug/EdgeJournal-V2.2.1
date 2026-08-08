// Saved Views panel — the production UI for creating, loading, renaming and
// deleting Journal filter+sort configurations. Imported by TradingJournal.
//
// The panel is account-aware: only views stamped with the currently selected
// account are listed (see viewsForAccount), so a view saved under Account A
// can never be applied while Account B is selected — and even if it were, the
// DataContext keeps `trades.items` scoped to the selected account.
//
// The component is presentational for storage decisions: it renders the view
// list and calls `onCreate/onApply/onRename/onDelete`; the page owns the
// persisted state (src/lib/savedViews.js). This keeps the panel easy to test
// and the persistence rules in one place.

import { useState } from 'react';
import { Save, Pencil, Trash2, X, Play, Pin } from 'lucide-react';
import SidePanel from './SidePanel';
import { viewsForAccount } from '../lib/savedViews';

const SORT_LABEL = {
  date: 'Date',
  pair: 'Pair',
  profit: 'PnL',
  rr: 'R:R',
  result: 'Win/Loss',
  account: 'Account',
  risk: 'Risk %',
  setup: 'Setup',
  rating: 'Rating',
};

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1.5px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '9px 12px',
  fontSize: 13.5,
  width: '100%',
  minWidth: 0,
};

export default function SavedViewsPanel({ open, onClose, views, accountId, getAccountName, onCreate, onApply, onRename, onDelete }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const scoped = viewsForAccount(views, accountId);
  const accountLabel = getAccountName ? getAccountName(accountId) : accountId;

  function submitCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give this view a name.');
      return;
    }
    setError('');
    const result = onCreate(trimmed);
    if (result?.error) setError(result.error);
    else {
      setNotice(result?.view ? `Saved "${result.view.name}".` : 'View saved.');
      setName('');
    }
  }

  function startRename(view) {
    setEditingId(view.id);
    setDraft(view.name);
    setError('');
  }

  function submitRename(view) {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }
    const result = onRename(view.id, trimmed);
    if (result?.error) setError(result.error);
    else {
      const renamed = (result.views || []).find((v) => v.id === view.id);
      setNotice(`Renamed to "${renamed?.name || trimmed}".`);
      setEditingId(null);
      setDraft('');
    }
  }

  function load(view) {
    setNotice(`Loaded "${view.name}".`);
    onApply(view);
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Saved Views"
      subtitle="Filter + sort configurations for this account"
      width="narrow"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {error && (
          <p role="alert" style={{ fontSize: 12.5, color: 'var(--loss)', margin: 0 }}>
            {error}
          </p>
        )}
        {notice && (
          <p role="status" style={{ fontSize: 12.5, color: 'var(--win)', margin: 0 }}>
            {notice}
          </p>
        )}

        {/* Create from the current selection */}
        <section aria-label="Create saved view">
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
            Save current filters &amp; sort
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
              placeholder="e.g. London GBPJPY Losses"
              aria-label="Name this view"
              style={{ ...inputStyle, flex: '1 1 200px', maxWidth: 260 }}
            />
            <button className="btn btn-accent btn-sm" onClick={submitCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Save size={13} /> Save view
            </button>
          </div>
          {accountId && (
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '8px 0 0' }}>
              Saved for account: <strong>{accountLabel || accountId}</strong>
            </p>
          )}
        </section>

        {/* Existing views for this account */}
        <section aria-label="Saved views list">
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
            Views · {scoped.length}
          </div>
          {scoped.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: 0 }}>
              No saved views for this account yet. Save the current selection above.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scoped.map((view) => (
                <li
                  key={view.id}
                  className="card"
                  style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, margin: 0 }}
                >
                  {editingId === view.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitRename(view)}
                        aria-label="Rename view"
                        style={{ ...inputStyle, flex: '1 1 160px' }}
                      />
                      <button className="btn btn-ghost btn-sm" onClick={() => submitRename(view)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Save size={12} /> Save
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingId(null);
                          setDraft('');
                          setError('');
                        }}
                        aria-label="Cancel rename"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <Pin size={12} color="var(--text-faint)" aria-hidden />
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{view.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => load(view)}
                          aria-label={`Load ${view.name}`}
                          title="Apply this view"
                        >
                          <Play size={13} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => startRename(view)} aria-label={`Rename ${view.name}`} title="Rename">
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => onDelete(view.id)}
                          aria-label={`Delete ${view.name}`}
                          title="Delete"
                        >
                          <Trash2 size={13} color="var(--loss)" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    {SORT_LABEL[view.sortKey] || view.sortKey} · {view.sortDir === 'asc' ? 'Ascending' : 'Descending'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SidePanel>
  );
}