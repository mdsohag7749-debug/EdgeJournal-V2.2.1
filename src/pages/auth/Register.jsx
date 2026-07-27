import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, User, ArrowRight } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import SocialButtons from '../../components/auth/SocialButtons';

// Register UI only. No backend/Supabase call is made — submitting
// simulates a brief loading state after a quick client-side sanity check
// (fields present, passwords match) purely for form-UX polish.

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agree: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e) {
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
    // Placeholder only — no backend call. Swapped for a real
    // Supabase sign-up call once auth is connected.
    setTimeout(() => setLoading(false), 900);
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
