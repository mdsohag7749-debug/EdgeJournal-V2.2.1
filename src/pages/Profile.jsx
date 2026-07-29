import { useEffect, useState } from 'react';
import { Loader2, User, AtSign, Clock, Camera, Save, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchProfile, updateProfile } from '../lib/profileApi';

// Common IANA timezones, falling back to whatever the browser
// supports if the environment exposes the full list. Kept short and
// curated (rather than dumping all ~400 IANA zones) so the dropdown
// stays usable.
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Lagos',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

function initials(name, email) {
  const source = (name || '').trim() || (email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const BLANK = { fullName: '', username: '', bio: '', timezone: '' };

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchProfile(user.id)
      .then((p) => {
        if (!isMounted) return;
        setProfile(p);
        setForm(p ? { fullName: p.fullName, username: p.username, bio: p.bio, timezone: p.timezone } : BLANK);
      })
      .catch((err) => {
        if (!isMounted) return;
        setMessage({ type: 'error', text: err.message || 'Could not load your profile.' });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!user?.id) return;

    const cleanUsername = form.username.trim();
    if (cleanUsername && !/^[a-zA-Z0-9_.]{3,30}$/.test(cleanUsername)) {
      setMessage({ type: 'error', text: 'Username must be 3–30 characters: letters, numbers, "_" or "." only.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile(user.id, {
        fullName: form.fullName,
        username: cleanUsername,
        bio: form.bio,
        timezone: form.timezone,
      });
      setProfile(updated);
      setForm({ fullName: updated.fullName, username: updated.username, bio: updated.bio, timezone: updated.timezone });
      setMessage({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      const isUniqueViolation = err?.code === '23505';
      setMessage({
        type: 'error',
        text: isUniqueViolation ? 'That username is already taken.' : err.message || 'Could not save your profile.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', padding: '40px 0' }}>
        <Loader2 size={18} className="auth-spin" color="var(--red)" />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Loading your profile…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 780 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Profile</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
          Manage how your account appears across EdgeJournal
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              flexShrink: 0,
              background: 'linear-gradient(135deg, var(--red), var(--red-strong))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 22,
              boxShadow: '0 6px 16px rgba(193, 18, 31, 0.28)',
              overflow: 'hidden',
            }}
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials(form.fullName, profile?.email)
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="section-title" style={{ marginBottom: 4 }}>
              {form.fullName || 'Unnamed Trader'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <Mail size={13} />
              <span>{profile?.email || '—'}</span>
            </div>
          </div>
          {/* Avatar upload is not implemented yet — placeholder only,
              per the spec for this module. */}
          <button type="button" className="btn btn-ghost btn-sm" disabled title="Avatar upload is coming soon">
            <Camera size={14} /> Change Photo
          </button>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h3 className="section-title">
            <User size={16} /> Personal Information
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, marginBottom: 16 }}>
            This information is private to your account and is never shared with other users.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field-row cols-2">
              <div className="field">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  placeholder="Jane Trader"
                  maxLength={80}
                />
              </div>
              <div className="field">
                <label htmlFor="username">
                  <AtSign size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  placeholder="janetrader"
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="A short line about your trading style, focus, or goals…"
                style={{ minHeight: 100 }}
                maxLength={300}
              />
            </div>

            <div className="field" style={{ maxWidth: 320 }}>
              <label htmlFor="timezone">
                <Clock size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
                Timezone
              </label>
              <select id="timezone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                <option value="">Not set</option>
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {message && (
          <p style={{ fontSize: 13, color: message.type === 'success' ? 'var(--win)' : 'var(--loss)' }}>{message.text}</p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn btn-accent" disabled={saving}>
            {saving ? <Loader2 size={15} className="auth-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
