import { useState } from 'react';
import { useData } from '../context/DataContext';
import PlanFormPanel from './panels/PlanFormPanel';
import Lightbox from '../components/Lightbox';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../lib/utils';
import { Plus, ChevronDown, Pencil, Trash2, Sunrise, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const BIAS_ICON = { Bullish: TrendingUp, Bearish: TrendingDown, Neutral: Minus };
const BIAS_CLASS = { Bullish: 'tag-win', Bearish: 'tag-loss', Neutral: 'tag-neutral' };

export default function PreMarketPlan() {
  const { plans } = useData();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const sorted = [...plans.items].sort((a, b) => b.date.localeCompare(a.date));

  function openNew() {
    setEditing(null);
    setPanelOpen(true);
  }
  function openEdit(plan) {
    setEditing(plan);
    setPanelOpen(true);
  }
  function handleSave(form) {
    if (editing) plans.update(editing.id, form);
    else plans.add(form);
    setPanelOpen(false);
  }
  function toggleExpand(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Set your bias and game plan before the bell</p>
        </div>
        <button className="btn btn-accent" onClick={openNew}>
          <Plus size={16} /> New Plan
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <Sunrise size={26} style={{ marginBottom: 10, color: 'var(--text-faint)' }} />
          <h3>No pre-market plans yet</h3>
          <p>Create your first plan to define bias, targets and game plan for the session.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((plan) => {
            const isOpen = !!expanded[plan.id];
            const BiasIcon = BIAS_ICON[plan.bias] || Minus;
            return (
              <div key={plan.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => toggleExpand(plan.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{formatDate(plan.date)}</span>
                    <span className={`tag ${BIAS_CLASS[plan.bias]}`}>
                      <BiasIcon size={12} /> {plan.bias}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(plan)} aria-label="Edit plan">
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmId(plan.id)} aria-label="Delete plan">
                      <Trash2 size={14} color="var(--loss)" />
                    </button>
                    <ChevronDown
                      size={16}
                      onClick={() => toggleExpand(plan.id)}
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }}
                    />
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Field label="Economic Calendar Events" value={plan.economicEvents} />
                    <Field label="Targets" value={plan.targets} />
                    <Field label="Game Plan" value={plan.gamePlan} />
                    <Field label="Additional Notes" value={plan.notes} />
                    {(plan.dailyChart || plan.intradayChart) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 6 }}>
                        {plan.dailyChart && (
                          <ChartThumb label="Daily Chart" src={plan.dailyChart} onClick={() => setLightbox(plan.dailyChart)} />
                        )}
                        {plan.intradayChart && (
                          <ChartThumb label="Intraday Chart" src={plan.intradayChart} onClick={() => setLightbox(plan.intradayChart)} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PlanFormPanel open={panelOpen} onClose={() => setPanelOpen(false)} onSave={handleSave} initial={editing} />
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      <ConfirmDialog
        open={!!confirmId}
        title="Delete pre-market plan?"
        message="This will permanently remove this plan and its screenshots."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          plans.remove(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5 }}>
        {label}
      </div>
      <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{value}</p>
    </div>
  );
}

function ChartThumb({ label, src, onClick }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5 }}>
        {label}
      </div>
      <img
        src={src}
        alt={label}
        onClick={onClick}
        style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }}
      />
    </div>
  );
}
