import { motion } from 'framer-motion';
import { Star, Pencil, Copy, Archive, RotateCcw, Trash2, LayoutGrid } from 'lucide-react';
import { formatBalance, STATUS_META } from './accounts';

export default function AccountCard({ account, isSelected, onSelect, onEdit, onDuplicate, onArchive, onRestore, onSetDefault, onDelete }) {
  const meta = STATUS_META[account.status] || STATUS_META.active;
  const archived = account.status === 'archived';
  const initials = (account.name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="card card-lift"
      onClick={() => onSelect?.(account.id)}
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        cursor: onSelect ? 'pointer' : 'default',
        position: 'relative',
        opacity: archived ? 0.72 : 1,
        borderColor: isSelected ? 'rgba(193,18,31,0.45)' : 'var(--border)',
        boxShadow: isSelected ? '0 0 0 1px rgba(193,18,31,0.25), var(--shadow-lifted)' : undefined,
      }}
    >
      {isSelected && (
        <span
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--red)',
            background: 'var(--red-glow)',
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          Selected
        </span>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(193,18,31,0.22), rgba(193,18,31,0.06))',
            border: '1px solid rgba(193,18,31,0.25)',
            color: 'var(--red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{account.name}</h3>
            {account.isDefault && (
              <span className="tag tag-red" style={{ gap: 4 }}>
                <Star size={10} fill="var(--red)" /> Default
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {account.broker && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <LayoutGrid size={11} /> {account.broker}
              </span>
            )}
            {account.platform && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· {account.platform}</span>}
            <span className="tag tag-neutral" style={{ color: meta.color, borderColor: 'transparent' }}>
              {meta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Balance */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Current Balance</div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {formatBalance(account.currentBalance, account.currency) || formatBalance(0, account.currency)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
          Starting {formatBalance(account.startingBalance, account.currency) || '\u2014'} · {account.currency}
        </div>
      </div>

      {/* Meta chips */}
      {(account.accountType || account.currency) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {account.accountType && <span className="tag tag-neutral">{account.accountType}</span>}
          <span className="tag tag-neutral">{account.currency}</span>
        </div>
      )}

      {/* Actions */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 14, flexWrap: 'wrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!account.isDefault && !archived && (
          <button className="btn btn-ghost btn-icon btn-sm" title="Set as default" onClick={onSetDefault}>
            <Star size={15} />
          </button>
        )}
        <button className="btn btn-ghost btn-icon btn-sm" title="Edit account" onClick={() => onEdit(account)}>
          <Pencil size={15} />
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" title="Duplicate account" onClick={() => onDuplicate(account)}>
          <Copy size={15} />
        </button>
        {archived ? (
          <button className="btn btn-ghost btn-icon btn-sm" title="Restore account" onClick={() => onRestore(account)}>
            <RotateCcw size={15} />
          </button>
        ) : (
          <button className="btn btn-ghost btn-icon btn-sm" title="Archive account" onClick={() => onArchive(account)}>
            <Archive size={15} />
          </button>
        )}
        <button className="btn btn-ghost btn-icon btn-sm" title="Delete account" onClick={() => onDelete(account)}>
          <Trash2 size={15} color="var(--loss)" />
        </button>
      </div>
    </motion.div>
  );
}