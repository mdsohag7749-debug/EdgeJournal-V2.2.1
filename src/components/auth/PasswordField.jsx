import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Eye, EyeOff } from 'lucide-react';

// Reusable password field: lock icon on the left, a show/hide toggle on
// the right. Purely a UI affordance — no validation or backend logic.
// The show/hide toggle animates between the eye icons for a premium feel.

export default function PasswordField({ id, label = 'Password', error, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`field${error ? ' field-invalid auth-shake-once' : ''}`}
      initial={false}
      animate={error && !reduceMotion ? { x: [0, -9, 8, -6, 5, -3, 0] } : undefined}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {label && <label htmlFor={id}>{label}</label>}
      <div className="auth-input-wrap has-toggle">
        <span className="auth-input-icon">
          <Lock size={16} />
        </span>
        <input id={id} type={visible ? 'text' : 'password'} aria-invalid={error ? 'true' : undefined} {...inputProps} />
        <button
          type="button"
          className="auth-input-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          <motion.span
            key={visible ? 'hide' : 'show'}
            initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 20 }}
            style={{ display: 'flex' }}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </motion.span>
        </button>
      </div>
      {error && <span className="auth-error-text">{error}</span>}
    </motion.div>
  );
}