import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import TradeFormPanel from './panels/TradeFormPanel';
import Lightbox from '../components/Lightbox';
import { TradeScreenshotGallery } from '../components/TradeScreenshots';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate, formatMoney, pnlClass, resultTagClass, directionTagClass } from '../lib/utils';
import { Plus, ChevronDown, Pencil, Trash2, BookOpen, Star, Search, X, Filter } from 'lucide-react';

export default function TradingJournal() {
  const { trades, plans } = useData();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  // Search + filters (Task 7 polish)
  const [query, setQuery] = useState('');
  const [dirFilter, setDirFilter] = useState('All');
  const [resultFilter, setResultFilter] = useState('All');
  const [modelFilter, setModelFilter] = useState('All');

  const models = useMemo(() => {
    const set = new Set();
    trades.items.forEach((t) => t.model && set.add(t.model));
    return ['All', ...Array.from(set).sort()];
  }, [trades.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trades.items
      .filter((t) => (dirFilter === 'All' ? true : t.direction === dirFilter))
      .filter((t) => (resultFilter === 'All' ? true : t.result === resultFilter))
      .filter((t) => (modelFilter === 'All' ? true : t.model === modelFilter))
      .filter((t) => {
        if (!q) return true;
        return [
          t.instrument,
          t.direction,
          t.result,
          t.model,
          t.protocol,
          t.session,
          t.tradeGrade,
          t.emotion,
          t.notes,
          t.confluences,
          t.lessonsLearned,
          t.tradeManagement,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => (b.date + (b.entryTime || '')).localeCompare(a.date + (a.entryTime || '')));
  }, [trades.items, query, dirFilter, resultFilter, modelFilter]);

  const hasFilters = query.trim() !== '' || dirFilter !== 'All' || resultFilter !== 'All' || modelFilter !== 'All';
  const total = trades.items.length;

  function clearFilters() {
    setQuery('');
    setDirFilter('All');
    setResultFilter('All');
    setModelFilter('All');
  }

  function openNew() {
    setEditing(null);
    setPanelOpen(true);
  }
  function openEdit(trade) {
    setEditing(trade);
    setPanelOpen(true);
  }
  function handleSave(form) {
    if (editing) trades.update(editing.id, form);
    else trades.add(form);
    setPanelOpen(false);
  }
  function toggleExpand(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }
  function planLabel(planId) {
    const p = plans.items.find((pl) => pl.id === planId);
    return p ? `${formatDate(p.date)} · ${p.bias}` : null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Every trade, logged and reviewable · <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> of {total} trades
          </p>
        </div>
        <button className="btn btn-accent" onClick={openNew}>
          <Plus size={16} /> Log Trade
        </button>
      </div>

      {/* Search + filter toolbar */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pair, notes, model, grade, emotion…"
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                padding: '9px 12px 9px 34px',
                fontSize: 13.5,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-faint)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={dirFilter}
            onChange={(e) => setDirFilter(e.target.value)}
            style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '9px 12px', fontSize: 13.5 }}
          >
            <option value="All">Direction: All</option>
            <option value="Buy">Direction: Buy</option>
            <option value="Sell">Direction: Sell</option>
          </select>

          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '9px 12px', fontSize: 13.5 }}
          >
            <option value="All">Result: All</option>
            <option value="Win">Result: Win</option>
            <option value="Loss">Result: Loss</option>
            <option value="BE">Result: BE</option>
          </select>

          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '9px 12px', fontSize: 13.5, maxWidth: 220 }}
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m === 'All' ? 'Model: All' : m}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Filter size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <BookOpen size={26} style={{ marginBottom: 10, color: 'var(--text-faint)' }} />
          <h3>No trades logged yet</h3>
          <p>Log your first trade to start building your track record.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Search size={26} style={{ marginBottom: 10, color: 'var(--text-faint)' }} />
          <h3>No trades match your filters</h3>
          <p>Try adjusting the search or clearing the filters.</p>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginTop: 14 }}>
            <X size={14} /> Clear Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((t) => {
            const isOpen = !!expanded[t.id];
            const plan = planLabel(t.planId);
            return (
              <div key={t.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => toggleExpand(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    gap: 14,
                    flexWrap: 'wrap',
                    borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 84 }}>{formatDate(t.date)}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 44 }}>{t.instrument}</span>
                    {t.direction && (
                      <span className={`tag ${directionTagClass(t.direction)}`}>{t.direction}</span>
                    )}
                    <span className={`mono ${pnlClass(t.netPnl)}`} style={{ fontWeight: 700, fontSize: 14, minWidth: 90 }}>
                      {formatMoney(t.netPnl)}
                    </span>
                    <span className={`tag ${resultTagClass(t.result)}`}>{t.result}</span>
                    {t.model && <span className="tag tag-neutral">{t.model}</span>}
                    {t.protocol && <span className="tag tag-neutral">{t.protocol}</span>}
                    {t.rating && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--text-muted)' }}>
                        <Star size={12} fill="var(--red)" color="var(--red)" /> {t.rating}/10
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(t)} aria-label="Edit trade">
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmId(t.id)} aria-label="Delete trade">
                      <Trash2 size={14} color="var(--loss)" />
                    </button>
                    <ChevronDown
                      size={16}
                      onClick={() => toggleExpand(t.id)}
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }}
                    />
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '4px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <MiniStat label="Direction" value={t.direction} />
                        <MiniStat label="Entry" value={t.entryPrice} />
                        <MiniStat label="Exit" value={t.exitPrice} />
                        <MiniStat label="Contracts" value={t.contracts} />
                        <MiniStat label="Stop Loss" value={t.stopLoss} />
                        <MiniStat label="Take Profit" value={t.takeProfit} />
                        <MiniStat label="Risk %" value={t.riskPercent ? `${t.riskPercent}%` : ''} />
                        <MiniStat label="R:R" value={t.rr} />
                        <MiniStat label="Position Size" value={t.positionSize} />
                        <MiniStat label="Grade" value={t.tradeGrade} />
                        <MiniStat label="Emotion" value={t.emotion} />
                        <MiniStat label="Entry Time" value={t.entryTime} />
                        <MiniStat label="Exit Time" value={t.exitTime} />
                        <MiniStat label="Commission" value={t.commission ? formatMoney(-Math.abs(t.commission)) : '—'} />
                      </div>
                      {plan && <Field label="Linked Pre-Market Plan" value={plan} />}
                      <Field label="Confluences" value={t.confluences} />
                      <Field label="Trade Management" value={t.tradeManagement} />
                      <Field label="Trade Notes" value={t.notes} />
                      <Field label="Lessons Learned" value={t.lessonsLearned} />
                      <ChecklistSummary title="Risk Management" values={t.riskChecklist} />
                      <ChecklistSummary title="Trade Checklist" values={t.tradeChecklist} />
                      <ChecklistSummary title="Mistakes" values={t.mistakes} />
                    </div>
                    <div style={{ paddingTop: 14 }}>
                      {t.screenshot ? (
                        <>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
                            Execution Screenshot
                          </div>
                          <img
                            src={t.screenshot}
                            alt="Execution"
                            onClick={() => setLightbox(t.screenshot)}
                            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                          />
                        </>
                      ) : (
                        <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No screenshot attached.</div>
                      )}
                      <div style={{ marginTop: t.screenshot ? 16 : 0 }}>
                        <TradeScreenshotGallery tradeId={t.id} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TradeFormPanel open={panelOpen} onClose={() => setPanelOpen(false)} onSave={handleSave} initial={editing} />
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      <ConfirmDialog
        open={!!confirmId}
        title="Delete trade?"
        message="This will permanently remove this trade from your journal."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          trades.remove(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
        {value || value === 0 ? value : '—'}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
        {label}
      </div>
      <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  );
}

function ChecklistSummary({ title, values }) {
  const entries = Object.entries(values || {});
  if (!entries.length) return null;
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, color: v ? 'var(--text)' : 'var(--text-faint)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: v ? 'var(--win)' : 'var(--text-faint)', flexShrink: 0 }} />
            {k}
          </div>
        ))}
      </div>
    </div>
  );
}
