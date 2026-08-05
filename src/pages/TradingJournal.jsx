import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useData } from '../context/DataContext';
import { useAccounts } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import TradeFormPanel from './panels/TradeFormPanel';
import Lightbox from '../components/Lightbox';
import { TradeScreenshotGallery } from '../components/TradeScreenshots';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import SidePanel from '../components/SidePanel';
import { loadJSON, saveJSON, downloadJSONFile } from '../lib/storage';
import { uid, todayISO, formatDate, formatMoney, pnlClass, resultTagClass, directionTagClass } from '../lib/utils';
import {
  Plus,
  ChevronDown,
  Pencil,
  Trash2,
  BookOpen,
  Star,
  Search,
  X,
  FilterX,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Download,
  Layers,
  Save,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

const RESULT_ORDER = { Win: 0, BE: 1, Loss: 2 };
const RESULTS = ['All', 'Win', 'Loss', 'BE'];
const DIRECTIONS = ['All', 'Buy', 'Sell'];
const BLANK_FILTERS = {
  account: 'All',
  pair: 'All',
  direction: 'All',
  session: 'All',
  timeframe: 'All',
  result: 'All',
  emotion: 'All',
  model: 'All',
  dateFrom: '',
  dateTo: '',
  rrMin: '',
  rrMax: '',
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

const selectStyle = { ...inputStyle };

function TagInput({ value, onChange, placeholder = 'Add tag and press Enter…' }) {
  const [text, setText] = useState('');

  function add() {
    const parts = text
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setText('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          style={inputStyle}
        />
        <button className="btn btn-ghost btn-sm" onClick={add} type="button">
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((tag) => (
            <span key={tag} className="tag tag-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}>
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== tag))}
                aria-label={`Remove ${tag}`}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectBox({ checked }) {
  return checked ? <CheckSquare size={18} color="var(--red)" /> : <Square size={18} color="var(--text-faint)" />;
}

const TradeRow = memo(function TradeRow({ t, isOpen, isSelected, selectionMode, plan, onToggle, onEdit, onDelete, onQuickEdit, onToggleFavorite, onToggleSelect, onLightbox }) {
  const tags = Array.isArray(t.tags) ? t.tags : [];
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        onClick={() => (selectionMode ? onToggleSelect(t.id) : onToggle(t.id))}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          cursor: 'pointer',
          gap: 14,
          flexWrap: 'wrap',
          borderBottom: isOpen ? '1px solid var(--border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {selectionMode && <SelectBox checked={isSelected} />}
          {t.isFavorite && <Star size={14} fill="var(--red)" color="var(--red)" aria-hidden />}
          <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 84 }}>{formatDate(t.date)}</span>
          <span style={{ fontWeight: 700, fontSize: 14, minWidth: 44 }}>{t.instrument}</span>
          {t.direction && <span className={`tag ${directionTagClass(t.direction)}`}>{t.direction}</span>}
          <span className={`mono ${pnlClass(t.netPnl)}`} style={{ fontWeight: 700, fontSize: 14, minWidth: 90 }}>
            {formatMoney(t.netPnl)}
          </span>
          <span className={`tag ${resultTagClass(t.result)}`}>{t.result}</span>
          {t.model && <span className="tag tag-neutral">{t.model}</span>}
          {t.protocol && <span className="tag tag-neutral">{t.protocol}</span>}
          {tags.length > 0 && (
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.slice(0, 2).map((tag) => (
                <span key={tag} className="tag tag-neutral">
                  {tag}
                </span>
              ))}
              {tags.length > 2 && <span className="tag tag-neutral">+{tags.length - 2}</span>}
            </span>
          )}
          {t.rating && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <Star size={12} fill="var(--red)" color="var(--red)" /> {t.rating}/10
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onToggleFavorite(t)} aria-label={t.isFavorite ? 'Remove favorite' : 'Mark as favorite'} title={t.isFavorite ? 'Favorite' : 'Mark as favorite'}>
            <Star size={14} fill={t.isFavorite ? 'var(--red)' : 'none'} color={t.isFavorite ? 'var(--red)' : 'var(--text-muted)'} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onQuickEdit(t)} aria-label="Quick edit" title="Quick edit">
            <SlidersHorizontal size={14} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(t)} aria-label="Edit trade">
            <Pencil size={14} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDelete(t.id)} aria-label="Delete trade">
            <Trash2 size={14} color="var(--loss)" />
          </button>
          <ChevronDown
            size={16}
            onClick={() => onToggle(t.id)}
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
            {tags.length > 0 && <Field label="Tags" value={tags.join(' · ')} />}
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
                  onClick={() => onLightbox(t.screenshot)}
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
});

export default function TradingJournal() {
  const { trades, plans } = useData();
  const { accounts, getAccountName } = useAccounts();
  const { user } = useAuth();
  const presetsKey = `njh_journal_presets_${user?.id || 'anon'}`;

  // ---- Existing state (full edit panel, expand, lightbox, single delete)
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  // ---- Feature 1 & 2: search + advanced filters
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // ---- Feature 3: sorting
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // ---- Feature 4: saved filter presets
  const [presets, setPresets] = useState(() => loadJSON(presetsKey, []));
  const [presetName, setPresetName] = useState('');
  const [presetEditingId, setPresetEditingId] = useState(null);

  // ---- Feature 6 & 7: favorites + bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickDraft, setQuickDraft] = useState({});
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // ---- Feature 9: render window for large journals
  const [visibleCount, setVisibleCount] = useState(60);

  useEffect(() => {
    saveJSON(presetsKey, presets);
  }, [presets, presetsKey]);

  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setVisibleCount(60);
  }, [query, favoritesOnly, filterKey]);

  const optionList = useMemo(() => {
    const make = (fn) => {
      const set = new Set();
      trades.items.forEach((t) => {
        const v = fn(t);
        if (v) set.add(v);
      });
      return ['All', ...Array.from(set).sort()];
    };
    return {
      pairs: make((t) => t.instrument),
      sessions: make((t) => t.session),
      timeframes: make((t) => t.timeframe),
      emotions: make((t) => t.emotion),
      models: make((t) => t.model),
    };
  }, [trades.items]);

  const accountOptions = useMemo(() => [{ value: 'All', label: 'All' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))], [accounts]);

  const planById = useMemo(() => {
    const m = new Map();
    plans.items.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans.items]);

  const planLabel = useCallback(
    (planId) => {
      const p = planById.get(planId);
      return p ? `${formatDate(p.date)} · ${p.bias}` : null;
    },
    [planById]
  );

  // ---- Filtering + sorting (everything real trade data, instant updates)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && v !== '' ? n : null;
    };
    const rrMin = num(filters.rrMin);
    const rrMax = num(filters.rrMax);

    const list = trades.items.filter((t) => {
      if (favoritesOnly && !t.isFavorite) return false;
      if (filters.account !== 'All' && t.accountId !== filters.account) return false;
      if (filters.pair !== 'All' && t.instrument !== filters.pair) return false;
      if (filters.direction !== 'All' && t.direction !== filters.direction) return false;
      if (filters.session !== 'All' && t.session !== filters.session) return false;
      if (filters.timeframe !== 'All' && t.timeframe !== filters.timeframe) return false;
      if (filters.result !== 'All' && t.result !== filters.result) return false;
      if (filters.emotion !== 'All' && t.emotion !== filters.emotion) return false;
      if (filters.model !== 'All' && t.model !== filters.model) return false;
      if (filters.dateFrom && (t.date || '') < filters.dateFrom) return false;
      if (filters.dateTo && (t.date || '') > filters.dateTo) return false;
      const rr = num(t.rr);
      if (rrMin !== null && (rr === null || rr < rrMin)) return false;
      if (rrMax !== null && (rr === null || rr > rrMax)) return false;
      if (q) {
        const haystack = [
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
          ...(Array.isArray(t.tags) ? t.tags : []),
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        if (!haystack.some((v) => v.includes(q))) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let v = 0;
      switch (sortKey) {
        case 'date':
          v = (a.date + (a.entryTime || '')).localeCompare(b.date + (b.entryTime || ''));
          break;
        case 'pair':
          v = (a.instrument || '').localeCompare(b.instrument || '');
          break;
        case 'profit':
          v = (Number(a.netPnl) || 0) - (Number(b.netPnl) || 0);
          break;
        case 'rr':
          v = (Number(a.rr) || 0) - (Number(b.rr) || 0);
          break;
        case 'result':
          v = (RESULT_ORDER[a.result] ?? 3) - (RESULT_ORDER[b.result] ?? 3);
          break;
        case 'account':
          v = getAccountName(a.accountId).localeCompare(getAccountName(b.accountId));
          break;
        default:
          break;
      }
      return v * dir;
    });
  }, [trades.items, query, filters, favoritesOnly, sortKey, sortDir, getAccountName]);

  const total = trades.items.length;
  const hasFilters = query.trim() !== '' || favoritesOnly || Object.values(filters).some((v) => v !== 'All' && v !== '');
  const activeFilterCount =
    Object.values(filters).filter((v) => v !== 'All' && v !== '').length + (favoritesOnly ? 1 : 0) + (query.trim() !== '' ? 1 : 0);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setQuery('');
    setFilters(BLANK_FILTERS);
    setFavoritesOnly(false);
  }

  // ---- Feature 4: saved presets
  function savePreset() {
    const name = presetName.trim() || 'Untitled filter';
    if (presetEditingId) {
      setPresets((prev) => prev.map((p) => (p.id === presetEditingId ? { ...p, name, filters } : p)));
    } else {
      setPresets((prev) => [...prev, { id: uid(), name, filters }]);
    }
    setPresetName('');
    setPresetEditingId(null);
  }

  function startRenamePreset(p) {
    setPresetEditingId(p.id);
    setPresetName(p.name);
  }

  function applyPreset(p) {
    setFilters({ ...BLANK_FILTERS, ...p.filters });
    setFilterOpen(true);
  }

  function deletePreset(id) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  // ---- Existing trade actions
  const openNew = useCallback(() => {
    setEditing(null);
    setPanelOpen(true);
  }, []);

  const openEdit = useCallback((trade) => {
    setEditing(trade);
    setPanelOpen(true);
  }, []);

  function handleSave(form) {
    if (editing) trades.update(editing.id, form);
    else trades.add(form);
    setPanelOpen(false);
  }

  const toggleExpand = useCallback((id) => {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }, []);

  const toggleFavorite = useCallback(
    (trade) => {
      trades.update(trade.id, { isFavorite: !trade.isFavorite });
    },
    [trades.update]
  );

  // ---- Feature 5: quick edit
  const openQuickEdit = useCallback((trade) => {
    setQuickEditId(trade.id);
    setQuickDraft({
      notes: trade.notes || '',
      emotion: trade.emotion || '',
      lessonsLearned: trade.lessonsLearned || '',
      model: trade.model || '',
      tags: Array.isArray(trade.tags) ? [...trade.tags] : [],
    });
  }, []);

  function saveQuickEdit() {
    if (!quickEditId) return;
    trades.update(quickEditId, {
      notes: quickDraft.notes,
      emotion: quickDraft.emotion,
      lessonsLearned: quickDraft.lessonsLearned,
      model: quickDraft.model,
      tags: quickDraft.tags,
    });
    setQuickEditId(null);
  }

  function setQuick(key, value) {
    setQuickDraft((d) => ({ ...d, [key]: value }));
  }

  // ---- Feature 7: bulk selection + actions
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const requestDelete = useCallback((id) => setConfirmId(id), []);

  const selectedTrades = useMemo(() => trades.items.filter((t) => selected.has(t.id)), [trades.items, selected]);

  const selectionTags = useMemo(() => {
    const counts = {};
    selectedTrades.forEach((t) => (Array.isArray(t.tags) ? t.tags : []).forEach((tag) => (counts[tag] = (counts[tag] || 0) + 1)));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [selectedTrades]);

  function selectVisible() {
    setSelected(new Set(visible.map((t) => t.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function deleteSelected() {
    selected.forEach((id) => trades.remove(id));
    clearSelection();
    setConfirmBulkDelete(false);
  }

  function exportSelected() {
    downloadJSONFile(selectedTrades, `edgejournal-trades-${todayISO()}.json`);
  }

  function addTagToSelected(raw) {
    const tag = raw.trim();
    if (!tag) return;
    selectedTrades.forEach((t) => {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      if (!tags.includes(tag)) trades.update(t.id, { tags: [...tags, tag] });
    });
    setBulkTagInput('');
  }

  function removeTagFromSelected(tag) {
    selectedTrades.forEach((t) => {
      const tags = (Array.isArray(t.tags) ? t.tags : []).filter((x) => x !== tag);
      trades.update(t.id, { tags });
    });
  }

  // ---- Feature 9: rendered window
  const visible = filtered.slice(0, visibleCount);

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

      {/* Search + toolbar */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pair, notes, lessons, tags, model…"
              style={{ ...inputStyle, paddingLeft: 34 }}
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

          <button
            className={`btn btn-sm ${filterOpen ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() => setFilterOpen((o) => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <SlidersHorizontal size={13} /> Filters{hasFilters ? ` · ${activeFilterCount}` : ''}
          </button>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={{ ...selectStyle, maxWidth: 170 }}>
              <option value="date">Sort: Date</option>
              <option value="pair">Sort: Pair</option>
              <option value="profit">Sort: Profit</option>
              <option value="rr">Sort: R:R</option>
              <option value="result">Sort: Win/Loss</option>
              <option value="account">Sort: Account</option>
            </select>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} aria-label="Toggle sort direction" title={sortDir === 'asc' ? 'Ascending' : 'Descending'}>
              {sortDir === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            </button>
          </div>

          <button className={`btn btn-sm ${favoritesOnly ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setFavoritesOnly((f) => !f)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Star size={13} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favorites
          </button>

          <button
            className={`btn btn-sm ${selectionMode ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() =>
              setSelectionMode((m) => {
                const next = !m;
                if (!next) clearSelection();
                return next;
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {selectionMode ? <CheckSquare size={13} /> : <Square size={13} />} Select
          </button>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FilterX size={13} /> Clear
            </button>
          )}
        </div>

        {/* Advanced filter panel */}
        {filterOpen && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <FilterSelect label="Account" value={filters.account} options={accountOptions} onChange={(v) => setFilter('account', v)} />
              <FilterSelect label="Pair" value={filters.pair} options={optionList.pairs} onChange={(v) => setFilter('pair', v)} />
              <FilterSelect label="Direction" value={filters.direction} options={DIRECTIONS} onChange={(v) => setFilter('direction', v)} />
              <FilterSelect label="Session" value={filters.session} options={optionList.sessions} onChange={(v) => setFilter('session', v)} />
              <FilterSelect label="Timeframe" value={filters.timeframe} options={optionList.timeframes} onChange={(v) => setFilter('timeframe', v)} />
              <FilterSelect label="Result" value={filters.result} options={RESULTS} onChange={(v) => setFilter('result', v)} />
              <FilterSelect label="Emotion" value={filters.emotion} options={optionList.emotions} onChange={(v) => setFilter('emotion', v)} />
              <FilterSelect label="Strategy" value={filters.model} options={optionList.models} onChange={(v) => setFilter('model', v)} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Date From</span>
                <input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Date To</span>
                <input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Min R:R</span>
                <input type="number" min="0" step="any" value={filters.rrMin} onChange={(e) => setFilter('rrMin', e.target.value)} placeholder="e.g. 1.5" style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Max R:R</span>
                <input type="number" min="0" step="any" value={filters.rrMax} onChange={(e) => setFilter('rrMax', e.target.value)} placeholder="e.g. 5" style={inputStyle} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {filtered.length} matching trades
              </span>
            </div>

            {/* Saved filter presets */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={12} /> Saved Filters
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {presets.map((p) => (
                  <span key={p.id} className="tag tag-neutral" style={{ gap: 4, padding: '5px 8px' }}>
                    <button
                      onClick={() => applyPreset(p)}
                      title="Apply filter"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
                    >
                      {p.name}
                    </button>
                    <button onClick={() => startRenamePreset(p)} aria-label="Rename preset" title="Rename" style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => deletePreset(p.id)} aria-label="Delete preset" title="Delete" style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {presets.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No saved filters yet.</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                  placeholder={presetEditingId ? 'Rename this filter…' : 'Name this filter…'}
                  style={{ ...inputStyle, flex: '1 1 200px', maxWidth: 280 }}
                />
                <button className="btn btn-ghost btn-sm" onClick={savePreset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Save size={13} /> {presetEditingId ? 'Rename' : 'Save current'}
                </button>
                {presetEditingId && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPresetEditingId(null); setPresetName(''); }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk selection bar */}
      {selectionMode && (
        <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SelectBox checked={selected.size > 0 && selected.size === visible.length} />
            <button className="btn btn-ghost btn-sm" onClick={selectVisible} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CheckSquare size={13} /> Select {visible.length}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>{selected.size}</strong> selected
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={exportSelected} disabled={selected.size === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} /> Export
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setBulkTagOpen(true)} disabled={selected.size === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Layers size={13} /> Change Tags
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmBulkDelete(true)} disabled={selected.size === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={13} /> Delete
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty states */}
      {total === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Your journal is empty"
          message="Log your first trade to start building a professional track record — pair, result, notes, and everything in between."
          actionLabel="Log Your First Trade"
          onAction={openNew}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No trades match your filters"
          message="Try adjusting the search or clearing the filters to see more of your journal."
          actionLabel="Clear Filters"
          onAction={clearFilters}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((t) => (
            <TradeRow
              key={t.id}
              t={t}
              isOpen={!!expanded[t.id]}
              isSelected={selected.has(t.id)}
              selectionMode={selectionMode}
              plan={planLabel(t.planId)}
              onToggle={toggleExpand}
              onEdit={openEdit}
              onDelete={requestDelete}
              onQuickEdit={openQuickEdit}
              onToggleFavorite={toggleFavorite}
              onToggleSelect={toggleSelect}
              onLightbox={setLightbox}
            />
          ))}

          {filtered.length > visibleCount && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setVisibleCount((c) => c + 60)}>
                Show more ({filtered.length - visibleCount} more)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick edit panel */}
      <SidePanel
        open={!!quickEditId}
        onClose={() => setQuickEditId(null)}
        title="Quick Edit"
        subtitle="Update common fields without opening the full form."
        width="narrow"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setQuickEditId(null)}>
              Cancel
            </button>
            <button className="btn btn-accent" onClick={saveQuickEdit}>
              Save Changes
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Strategy</span>
            <select value={quickDraft.model || ''} onChange={(e) => setQuick('model', e.target.value)} style={selectStyle}>
              <option value="">None</option>
              {optionList.models.filter((m) => m !== 'All').map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Emotion</span>
            <select value={quickDraft.emotion || ''} onChange={(e) => setQuick('emotion', e.target.value)} style={selectStyle}>
              <option value="">None</option>
              {optionList.emotions.filter((m) => m !== 'All').map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Lesson</span>
            <input value={quickDraft.lessonsLearned || ''} onChange={(e) => setQuick('lessonsLearned', e.target.value)} placeholder="What did this trade teach you?" style={inputStyle} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Notes</span>
            <textarea value={quickDraft.notes || ''} onChange={(e) => setQuick('notes', e.target.value)} rows={4} placeholder="Add notes…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </label>

          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 8 }}>Tags</span>
            <TagInput value={quickDraft.tags || []} onChange={(tags) => setQuick('tags', tags)} />
          </div>
        </div>
      </SidePanel>

      {/* Bulk "Change Tags" panel */}
      <SidePanel
        open={bulkTagOpen}
        onClose={() => setBulkTagOpen(false)}
        title="Change Tags"
        subtitle={`Apply tags to ${selected.size} selected trade${selected.size === 1 ? '' : 's'}.`}
        width="narrow"
        footer={
          <button className="btn btn-accent" onClick={() => setBulkTagOpen(false)}>
            Done
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Add tag to all selected</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTagToSelected(bulkTagInput);
                }}
                placeholder="e.g. A+ setup"
                style={inputStyle}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => addTagToSelected(bulkTagInput)}>
                Add
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Remove tag from all selected</span>
            {selectionTags.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>None of the selected trades have tags yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectionTags.map(([tag, count]) => (
                  <div key={tag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="tag tag-neutral">{tag}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                        {count}/{selected.size}
                      </span>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeTagFromSelected(tag)} aria-label={`Remove ${tag}`}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SidePanel>

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
      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selected.size} trade${selected.size === 1 ? '' : 's'}?`}
        message="This will permanently remove every selected trade from your journal."
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={deleteSelected}
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
