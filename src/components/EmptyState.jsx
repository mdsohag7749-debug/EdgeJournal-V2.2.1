import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        border: '1.5px dashed var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {Icon && (
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: 'var(--red-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}
        >
          <Icon size={20} color="var(--red)" />
        </span>
      )}
      {title && <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700 }}>{title}</h3>}
      {message && <p style={{ fontSize: 13.5, maxWidth: 320 }}>{message}</p>}
      {actionLabel && onAction && (
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="btn btn-primary btn-sm"
          onClick={onAction}
          style={{ marginTop: 6 }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
