import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

// Reusable password field: lock icon on the left, a show/hide toggle on
// the right. Purely a UI affordance — no validation or backend logic.

export default function PasswordField({ id, label = 'Password', error, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="auth-input-wrap has-toggle">
        <span className="auth-input-icon">
          <Lock size={16} />
        </span>
        <input id={id} type={visible ? 'text' : 'password'} {...inputProps} />
        <button
          type="button"
          className="auth-input-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <span className="auth-error-text">{error}</span>}
    </div>
  );
}
