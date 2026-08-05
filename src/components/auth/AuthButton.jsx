import { Loader2 } from 'lucide-react';

// Reusable submit button for auth forms. `loading` is purely a local UI
// state the pages simulate on submit — there is no backend call behind it.

export default function AuthButton({ children, loading, className = '', ...props }) {
  return (
    <button
      type="submit"
      className={`btn btn-accent auth-submit-btn ${className}`}
      disabled={loading}
      style={{ width: '100%', padding: '12px 16px', fontSize: 14 }}
      {...props}
    >
      {loading ? <Loader2 size={16} className="auth-spin" /> : children}
    </button>
  );
}
