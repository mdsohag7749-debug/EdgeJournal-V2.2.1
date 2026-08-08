// Trade Replay / Review Mode — a dedicated, READ-ONLY deep view of a single
// real trade, opened from the journal via the "Review Trade" action.
//
// Contract:
//   - The component is purely presentational: it renders the trade object it
//     is given and NEVER mutates it. There is no input, no checkbox, no form.
//     Any permanent change goes through the existing "Open Full Trade" flow
//     (TradingJournal's TradeFormPanel) outside this panel.
//   - Every metric shown is a stored trade value or derived by reusing the
//     existing canonical utilities (computeDerived/duration, formatMoney,
//     reviewScoreForTrade / reviewStatusForTrade from src/lib/calculations).
//     No replacement formulas are registered here.
//   - Missing data is shown as "Not recorded" / "No chart evidence recorded."
//     Nothing is fabricated — no fake timestamps, no invented reflection text.
//   - Account isolation is inherited: the trade is already scoped to the
//     selected account by DataContext before it is ever passed in.
//
// Represents the production consumer contract of Task 8.5: TradingJournal
// routes a row-level "Review Trade" button into this panel, so the feature is
// reachable from the real journal UI (not just unit-testable in isolation).

import { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CalendarDays,
  TrendingUp,
  BookOpen,
  Search,
  ImageIcon,
} from 'lucide-react';
import SidePanel from '../SidePanel';
import { isClosedTrade, reviewScoreForTrade, reviewStatusForTrade } from '../../lib/calculations';
import { computeDerived } from '../../lib/tradeCalc';
import { formatDate, formatMoney } from '../../lib/utils';
import { TradeScreenshotGallery } from '../TradeScreenshots';

// Psychology scores (the same 1–5 emotion ratings the trade form records).
const PSYCH_KEYS = ['Confidence', 'Patience', 'Focus', 'Fear', 'Greed', 'FOMO', 'Revenge', 'Stress'];
const PSYCH_POSITIVE = ['Confidence', 'Patience', 'Focus'];

const has = (v) => v !== undefined && v !== null && v !== '';

function Section({ title, icon: Icon, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h4
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          margin: '0 0 8px',
        }}
      >
        {Icon && <Icon size={14} aria-hidden />}
        {title}
      </h4>
      {children}
    </section>
  );
}

const Row = ({ label, value, mono }) => {
  const present = has(value);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ fontSize: 13, fontWeight: 600, color: present ? 'var(--text)' : 'var(--text-faint)', textAlign: 'right' }}>
        {present ? value : 'Not recorded'}
      </span>
    </div>
  );
};

const NotRecorded = ({ children }) => (
  <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: 0 }}>{children}</p>
);

const Chips = ({ tone, children }) => (
  <span
    className="tag"
    style={{
      background: tone === 'ok' ? 'rgba(47,214,110,0.12)' : 'rgba(245,158,11,0.10)',
      color: tone === 'ok' ? 'var(--win)' : '#f59e0b',
      borderColor: 'transparent',
    }}
  >
    {children}
  </span>
);

function TimelineStage({ title, recorded, detail }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          marginTop: 5,
          flexShrink: 0,
          background: recorded ? 'var(--win)' : 'var(--text-faint)',
        }}
        aria-hidden
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: recorded ? 'var(--text)' : 'var(--text-muted)' }}>{title}</span>
        {detail ? (
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{detail}</span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{recorded ? 'Recorded' : 'Not recorded'}</span>
        )}
      </div>
    </li>
  );
}

// -------------------------------------------------------------------------
// MAIN COMPONENT
// -------------------------------------------------------------------------

export default function TradeReviewPanel({
  trade,
  plan,
  index,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
  onOpenFull,
  getAccountName,
}) {
  // Canonical reuse: computeDerived() yields the duration string from the
  // stored times exactly as the trade form would have shown it. PnL% requires
  // the account balance at time of the trade, which is not persisted per trade,
  // so it is reported as "Not recorded" rather than guessed.
  const duration = useMemo(() => {
    if (!trade) return '';
    const d = computeDerived({ entryTime: trade.entryTime, exitTime: trade.exitTime });
    return d.duration || '';
  }, [trade]);

  const reviewScore = trade ? reviewScoreForTrade(trade) : 0;
  const reviewStatus = trade ? reviewStatusForTrade(trade) : '';
  const psychScores = (trade?.psychology && trade.psychology) || {};
  const psychEntries = PSYCH_KEYS.filter((k) => {
    const v = Number(psychScores[k]);
    return v >= 1 && v <= 5;
  });
  const mistakeList = Object.keys(trade?.mistakes || {}).filter((k) => trade.mistakes[k]);
  const reviewKeys = Object.keys(trade?.review || {});
  const planRecorded = !!(plan && plan.bias && plan.bias !== 'Neutral');

  const hasEntry = has(trade?.entryPrice);
  const hasExit = has(trade?.exitPrice);
  const hasSluice = has(trade?.stopLoss) || has(trade?.takeProfit);

  return (
    <SidePanel
      open={!!trade}
      onClose={onClose}
      title="Review Trade"
      subtitle={`${trade ? formatDate(trade.date) : ''} ${trade?.instrument ? `· ${trade.instrument}` : ''}${total > 1 ? ` · ${index} of ${total}` : ''}`}
      width="wide"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onPrev} disabled={!canPrev} aria-label="Previous trade" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onNext} disabled={!canNext} aria-label="Next trade" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-accent btn-sm" onClick={onOpenFull} aria-label="Open full trade in edit mode" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ExternalLink size={14} />
            Open Full Trade
          </button>
        </div>
      }
    >
      {!trade ? (
        <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Select a trade to review.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Review completion, derived purely from the stored review state. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Chips tone={reviewScore === 100 ? 'ok' : 'warn'}>{reviewStatus}</Chips>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {reviewScore}% complete — {isClosedTrade(trade) ? (reviewScore === 100 ? 'fully reviewed' : 'pending review') : 'this trade is still open'}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${reviewScore}%`, height: '100%', background: reviewScore === 100 ? 'var(--win)' : '#f59e0b', borderRadius: 999, transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* SECTION A — TRADE CONTEXT */}
          <Section title="Trade Context" icon={CalendarDays}>
            <Row label="Date" value={formatDate(trade.date)} />
            <Row label="Account" value={getAccountName?.(trade.accountId) || trade.accountId} />
            <Row label="Pair" value={trade.instrument} />
            <Row label="Direction" value={trade.direction} />
            <Row label="Session" value={trade.session} />
            <Row label="Timeframe" value={trade.timeframe} />
            <Row label="Setup / Model" value={trade.model} />
            <Row label="Trade Grade" value={trade.tradeGrade} />
          </Section>

          {/* SECTION B — PLAN */}
          <Section title="Plan" icon={BookOpen}>
            {planRecorded ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Row label="Bias" value={plan.bias} />
                {has(plan.targets) && <Row label="Targets" value={plan.targets} />}
                {has(plan.gamePlan) && <Row label="Game Plan" value={plan.gamePlan} />}
                {has(plan.notes) && <Row label="Plan Notes" value={plan.notes} />}
                {!has(plan.gamePlan) && !has(plan.targets) && !has(plan.notes) && <NotRecorded>Bias recorded; no further plan detail.</NotRecorded>}
              </div>
            ) : (
              <NotRecorded>No pre-market plan is linked to this trade. If a plan exists for this date and account, open the trade and attach it.</NotRecorded>
            )}
          </Section>

          {/* SECTION C — EXECUTION (read-only) */}
          <Section title="Execution" icon={TrendingUp}>
            <Row label="Entry" value={trade.entryPrice} mono />
            <Row label="Stop Loss" value={trade.stopLoss} mono />
            <Row label="Take Profit" value={trade.takeProfit} mono />
            <Row label="Exit" value={trade.exitPrice} mono />
            <Row label="Duration" value={duration} />
            <Row label="Outcome" value={trade.result} />
            <Row label="PnL" value={has(trade.netPnl) ? formatMoney(trade.netPnl) : ''} mono />
            <Row label="PnL %" value={''} />
            <Row label="R:R" value={trade.rr} mono />
            <Row label="Risk %" value={has(trade.riskPercent) ? `${trade.riskPercent}%` : ''} />
            <Row label="Position Size" value={trade.positionSize} mono />
          </Section>

          {/* SECTION D — CHART EVIDENCE */}
          <Section title="Chart Evidence" icon={ImageIcon}>
            {trade.screenshot ? (
              <>
                <img
                  src={trade.screenshot}
                  alt={`${trade.instrument} execution screenshot`}
                  loading="lazy"
                  style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <div style={{ marginTop: 16 }}>
                  <TradeScreenshotGallery tradeId={trade.id} />
                </div>
              </>
            ) : (
              <NotRecorded>No chart evidence recorded.</NotRecorded>
            )}
          </Section>

          {/* SECTION E — PSYCHOLOGY */}
          <Section title="Psychology" icon={Search}>
            {has(trade.emotion) || psychEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {has(trade.emotion) && <Row label="Emotion" value={trade.emotion} />}
                {psychEntries.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                    {psychEntries.map((k) => {
                      const v = Number(psychScores[k]);
                      return (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)' }}>
                            <span>{k}</span>
                            <span className="mono" style={{ fontWeight: 700, color: PSYCH_POSITIVE.includes(k) ? 'var(--win)' : 'var(--loss)' }}>
                              {v}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} style={{ flex: 1, height: 5, borderRadius: 3, background: n <= v ? 'var(--border-strong)' : 'var(--border)' }} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <NotRecorded>No psychology data recorded.</NotRecorded>
            )}
          </Section>

          {/* SECTION F — MISTAKES */}
          <Section title="Mistakes">
            {mistakeList.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {mistakeList.map((m) => (
                  <span key={m} className="tag tag-neutral">{m}</span>
                ))}
              </div>
            ) : (
              <NotRecorded>No mistakes recorded.</NotRecorded>
            )}
          </Section>

          {/* SECTION G — REFLECTION */}
          <Section title="Reflection">
            {has(trade.notes) || has(trade.lessonsLearned) || has(trade.tradeManagement) || reviewKeys.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {has(trade.notes) && <Row label="Summary" value={trade.notes} />}
                {has(trade.lessonsLearned) && <Row label="Lesson Learned" value={trade.lessonsLearned} />}
                {has(trade.tradeManagement) && <Row label="Trade Management" value={trade.tradeManagement} />}
                {has(trade.review?.reviewSummary) && <Row label="Review Summary" value={trade.review.reviewSummary} />}
                {has(trade.review?.lessonLearned) && <Row label="Lesson (review)" value={trade.review.lessonLearned} />}
              </div>
            ) : (
              <NotRecorded>No reflection recorded.</NotRecorded>
            )}
          </Section>

          {/* SECTION H — REVIEW TIMELINE */}
          <Section title="Timeline">
            <ol style={{ margin: 0, padding: '2px 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TimelineStage
                title="PLAN"
                recorded={planRecorded}
                detail={planRecorded ? `${plan.bias} bias` : undefined}
              />
              <TimelineStage
                title="ENTRY"
                recorded={hasEntry}
                detail={hasEntry ? `recorded${has(trade.entryTime) ? ` · ${trade.entryTime}` : ''}` : undefined}
              />
              <TimelineStage
                title="MANAGEMENT"
                recorded={hasSluice || has(trade.tradeManagement)}
                detail={hasSluice ? 'stop · target' : undefined}
              />
              <TimelineStage title="EXIT" recorded={hasExit} detail={hasExit ? `exit${has(trade.exitTime) ? ` · ${trade.exitTime}` : ''}` : undefined} />
              <TimelineStage
                title="REFLECTION"
                recorded={has(trade.notes) || has(trade.lessonsLearned) || reviewKeys.length > 0}
              />
            </ol>
          </Section>
        </div>
      )}
    </SidePanel>
  );
}