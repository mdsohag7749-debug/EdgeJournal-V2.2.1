import { motion, useReducedMotion } from 'framer-motion';

// Reusable labeled input for auth forms. Wraps the existing `.field`
// styling (see src/index.css) already used across the app's other forms,
// with an optional leading icon and inline error message. When `error` is
// passed the field gets an invalid state (red glow + shake) — purely visual,
// no validation or backend logic.

export default function FormField({ id, label, icon: Icon, error, ...inputProps }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`field${error ? ' field-invalid auth-shake-once' : ''}`}
      initial={false}
      animate={error && !reduceMotion ? { x: [0, -9, 8, -6, 5, -3, 0] } : undefined}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {label && <label htmlFor={id}>{label}</label>}
      <div className={Icon ? 'auth-input-wrap' : undefined}>
        {Icon && (
          <span className="auth-input-icon">
            <Icon size={16} />
          </span>
        )}
        <input id={id} aria-invalid={error ? 'true' : undefined} {...inputProps} />
      </div>
      {error && <span className="auth-error-text">{error}</span>}
    </motion.div>
  );
}