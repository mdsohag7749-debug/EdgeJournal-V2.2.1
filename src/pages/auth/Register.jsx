import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import SocialButtons from '../../components/auth/SocialButtons';
import { useAuth } from '../../context/AuthContext';

// Register wired to real Supabase auth (supabase.auth.signUp via
// AuthContext). Depending on the Supabase project's email-confirmation
// setting, signUp either returns a live session (confirmation off ->
// go straight to the dashboard) or requires the visitor to confirm via
// email first (confirmation on -> show a "check your email" view).

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agree: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.agree) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const data = await register(form.name, form.email, form.password);
      if (data?.session) {
        // Email confirmation is off for this project: signUp already
        // returned a live session, so the auth-state listener will pick
        // it up — send the visitor straight in.
        navigate('/dashboard', { replace: true });
      } else {
        // Email confirmation is required: no session yet.
        setRegistered(true);
      }
    } catch (err) {
      setError(err?.message || 'Unable to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <AuthLayout
        eyebrow="Almost there"
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${form.email || 'your inbox'}.`}
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
            Click the link in that email to activate your account, then come back and sign in.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      subtitle="Start journaling your trades and building your edge."
      footer={
        <p className="auth-footer-note">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField
          id="register-name"
          label="Full name"
          icon={User}
          type="text"
          autoComplete="name"
          placeholder="Jane Trader"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />

        <FormField
          id="register-email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
        />

        <div className="field-row cols-2">
          <PasswordField
            id="register-password"
            label="Password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required
          />
          <PasswordField
            id="register-confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            required
          />
        </div>

        <label className="auth-check-row">
          <input type="checkbox" checked={form.agree} onChange={(e) => set('agree', e.target.checked)} />
          I agree to the Terms of Service and Privacy Policy
        </label>

        {error && <span className="auth-error-text">{error}</span>}

        <AuthButton loading={loading}>
          Create Account <ArrowRight size={16} />
        </AuthButton>

        <div className="auth-divider">Or continue with</div>
        <SocialButtons />
      </form>
    </AuthLayout>
  );
}
