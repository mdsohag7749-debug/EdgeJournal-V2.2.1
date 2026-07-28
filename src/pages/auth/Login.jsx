import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import SocialButtons from '../../components/auth/SocialButtons';
import { useAuth } from '../../context/AuthContext';

// Login wired to real Supabase auth (supabase.auth.signInWithPassword
// via AuthContext). On success, AuthContext's session/isAuthenticated
// update from the auth-state listener; we also navigate explicitly so
// the redirect to /dashboard happens immediately.

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to sign in. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to EdgeJournal"
      subtitle="Log in to keep your trading journal up to date."
      footer={
        <p className="auth-footer-note">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField
          id="login-email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
        />

        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          required
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label className="auth-check-row">
            <input type="checkbox" checked={form.remember} onChange={(e) => set('remember', e.target.checked)} />
            Remember me
          </label>
          <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>

        {error && <span className="auth-error-text">{error}</span>}

        <AuthButton loading={loading}>
          Sign In <ArrowRight size={16} />
        </AuthButton>

        <div className="auth-divider">Or continue with</div>
        <SocialButtons />
      </form>
    </AuthLayout>
  );
}
