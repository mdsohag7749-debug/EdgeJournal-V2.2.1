import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import AuthButton from '../../components/auth/AuthButton';
import { useAuth } from '../../context/AuthContext';

// Forgot Password wired to real Supabase auth
// (supabase.auth.resetPasswordForEmail via AuthContext). Supabase itself
// intentionally does not reveal whether the address exists, so the
// "if an account exists..." copy below is accurate, not just cautious UI.

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Unable to send a reset link right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        eyebrow="Check your email"
        title="Reset link sent"
        subtitle={`If an account exists for ${email || 'that address'}, a reset link is on its way.`}
        footer={
          <p className="auth-footer-note">
            <Link to="/login">Back to sign in</Link>
          </p>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0 4px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(22, 163, 74, 0.1)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={26} color="var(--win)" />
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center' }}>
            Didn&apos;t get the email? Check your spam folder, or try again with a different address.
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => setSent(false)} style={{ width: '100%' }}>
            <ArrowLeft size={16} /> Try a different email
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="Enter the email tied to your account and we'll send you a reset link."
      footer={
        <p className="auth-footer-note">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField
          id="forgot-email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {error && <span className="auth-error-text">{error}</span>}

        <AuthButton loading={loading}>
          Send Reset Link <ArrowRight size={16} />
        </AuthButton>
      </form>
    </AuthLayout>
  );
}
