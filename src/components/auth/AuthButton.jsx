import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// Reusable submit button for auth forms. `loading` is purely a local UI
// state the pages simulate on submit — there is no backend call behind it.
// Adds a premium hover lift, a springy press scale and a material-style
// ripple while preserving the same submit semantics (type="submit").
function spawnRipple(container, e) {
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const d = Math.max(rect.width, rect.height);
  const span = document.createElement('span');
  span.className = 'auth-ripple';
  span.style.width = span.style.height = `${d}px`;
  span.style.left = `${e.clientX - rect.left - d / 2}px`;
  span.style.top = `${e.clientY - rect.top - d / 2}px`;
  container.appendChild(span);
  span.addEventListener('animationend', () => span.remove());
}

export default function AuthButton({ children, loading, className = '', ...props }) {
  const reduceMotion = useReducedMotion();
  const rippleLayerRef = useRef(null);

  const handlePointerDown = (e) => {
    if (!loading && !reduceMotion) spawnRipple(rippleLayerRef.current, e);
    props.onPointerDown?.(e);
  };

  return (
    <motion.button
      type="submit"
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      transition={reduceMotion ? undefined : { type: 'spring', stiffness: 420, damping: 22 }}
      className={`btn btn-accent auth-submit-btn ${className}`}
      disabled={loading}
      style={{ width: '100%', padding: '12px 16px', fontSize: 14 }}
      aria-busy={loading ? 'true' : undefined}
      {...props}
      onPointerDown={handlePointerDown}
    >
      <span className="auth-ripple-layer" ref={rippleLayerRef} aria-hidden="true" />
      {loading ? <Loader2 size={16} className="auth-spin" /> : children}
    </motion.button>
  );
}