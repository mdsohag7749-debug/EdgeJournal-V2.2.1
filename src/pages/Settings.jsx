import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Palette,
  Wallet,
  Bell,
  ShieldCheck,
  SlidersHorizontal,
  Database,
  Info,
  Loader2,
  Camera,
  Mail,
  Send,
  Plus,
  X,
  Download,
  Upload,
  Check,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../context/AccountContext';
import { useTheme } from '../context/ThemeContext';
import AccountsManager from '../components/accounts/AccountsManager';
import { exportAllData, downloadJSONFile, importAllData, estimateStorageBytes, validateBackupData } from '../lib/storage';
import { restoreAccounts } from '../lib/accountsApi';
import { updateProfile } from '../lib/profileApi';
import { uploadAvatar } from '../lib/avatarApi';

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

const PREFS_KEY = 'njh_notifications';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'accounts', label: 'Accounts', icon: Wallet },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'system', label: 'System', icon: SlidersHorizontal },
  { key: 'backup', label: 'Backup', icon: Database },
  { key: 'about', label: 'About', icon: Info },
];

export default function Settings({ defaultSection = 'accounts' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section');
  const [active, setActive] = useState(defaultSection);

  useEffect(() => {
    if (SECTIONS.some((s) => s.key === sectionFromUrl)) {
      setActive(sectionFromUrl);
    } else if (SECTIONS.some((s) => s.key === defaultSection)) {
      setActive(defaultSection);
    }
  }, [defaultSection, sectionFromUrl]);

  function selectSection(key) {
    setActive(key);
    const next = new URLSearchParams(searchParams);
    if (SECTIONS.some((s) => s.key === key)) {
      next.set('section', key);
    } else {
      next.delete('section');
    }
    setSearchParams(next, { replace: true });
  }

  const activeSection = SECTIONS.find((s) => s.key === active) || SECTIONS[2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Settings</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
          Manage your profile, appearance, accounts, system and more
        </p>
      </div>

      <div className="settings-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Section rail */}
        <div className="settings-rail" style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = sec.key === active;
            return (
              <button
                key={sec.key}
                onClick={() => selectSection(sec.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 13px',
                  borderRadius: 12,
                  border: '1px solid transparent',
                  background: isActive ? 'var(--red-glow)' : 'transparent',
                  borderColor: isActive ? 'rgba(193,18,31,0.3)' : 'var(--border)',
                  color: isActive ? 'var(--red)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                <span style={{ flex: 1 }}>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 1200 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {activeSection.key === 'profile' && <SectionProfile />}
              {activeSection.key === 'appearance' && <SectionAppearance />}
              {activeSection.key === 'accounts' && <AccountsManager />}
              {activeSection.key === 'notifications' && <SectionNotifications />}
              {activeSection.key === 'security' && <SectionSecurity />}
              {activeSection.key === 'system' && <SectionSystem />}
              {activeSection.key === 'backup' && <SectionBackup />}
              {activeSection.key === 'about' && <SectionAbout />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ScrollCard({ children }) {
  return <div className="card" style={{ padding: 22 }}>{children}</div>;
}

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={16} />} {title}
      </h3>
      {description && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>{description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Appearance
function SectionAppearance() {
  const { theme, accent, setTheme, setAccent, THEME_PRESETS, ACCENT_PRESETS } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ScrollCard>
        <SectionTitle icon={Palette} title="Appearance" description="Choose the overall look and accent color of EdgeJournal." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>Theme</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
              {Object.values(THEME_PRESETS).map((t) => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{
                      borderRadius: 14,
                      border: isActive ? '1.5px solid var(--red)' : '1px solid var(--border)',
                      padding: 12,
                      background: 'var(--bg-elevated)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ width: 34, height: 26, borderRadius: 6, background: t.previewBg, border: '1px solid rgba(0,0,0,0.2)' }} />
                      <div style={{ width: 34, height: 26, borderRadius: 6, background: t.previewCard, border: '1px solid rgba(0,0,0,0.2)' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                      {isActive && <Check size={15} color="var(--red)" />}
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{t.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>Accent Color</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.values(ACCENT_PRESETS).map((a) => {
                const isActive = accent === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAccent(a.id)}
                    title={a.name}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: a.color,
                      cursor: 'pointer',
                      border: isActive ? '2px solid var(--text)' : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    {isActive && <Check size={18} color="#fff" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollCard>
    </div>
  );
}

// ---------------------------------------------------------------- Profile
function SectionProfile() {
  const { user, profile, profileLoading, setProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({ fullName: '', username: '', bio: '', timezone: '' });
  const [message, setMessage] = useState(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({ fullName: profile.fullName, username: profile.username, bio: profile.bio, timezone: profile.timezone });
    }
  }, [profile]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage(null);
  }

  async function handleSave() {
    if (!user?.id) return;
    const cleanUsername = form.username.trim();
    if (cleanUsername && !/^[a-zA-Z0-9_.]{3,30}$/.test(cleanUsername)) {
      setMessage({ type: 'error', text: 'Username must be 3-30 characters: letters, numbers, "_" or "." only.' });
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
      setMessage({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      const isUniqueViolation = err?.code === '23505';
      setMessage({ type: 'error', text: isUniqueViolation ? 'That username is already taken.' : err.message || 'Could not save your profile.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id) return;
    setUploadingAvatar(true);
    setMessage(null);
    try {
      const updated = await uploadAvatar(user.id, file);
      setProfile(updated);
      setMessage({ type: 'success', text: 'Profile photo updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not upload your photo.' });
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (profileLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', padding: '20px 0' }}>
        <Loader2 size={18} className="auth-spin" color="var(--red)" />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Loading your profile…</span>
      </div>
    );
  }

  return (
    <ScrollCard>
      <SectionTitle icon={User} title="Profile" description="How your account appears across EdgeJournal." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              position: 'relative',
              width: 64,
              height: 64,
              borderRadius: '50%',
              flexShrink: 0,
              background: 'linear-gradient(135deg, var(--red), var(--red-strong))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 20,
              overflow: 'hidden',
            }}
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (form.fullName || user?.email || 'T')[0].toUpperCase()
            )}
            {uploadingAvatar && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,12,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={18} className="auth-spin" color="#fff" />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>Account</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <Mail size={13} />
              <span>{user?.email || '—'}</span>
            </div>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
          <button type="button" className="btn btn-ghost btn-sm" disabled={uploadingAvatar} onClick={() => avatarInputRef.current?.click()}>
            {uploadingAvatar ? <Loader2 size={14} className="auth-spin" /> : <Camera size={14} />}
            {uploadingAvatar ? 'Uploading…' : 'Change Photo'}
          </button>
        </div>

        <div className="field-row cols-2">
          <div className="field">
            <label htmlFor="settings-full-name">Full Name</label>
            <input id="settings-full-name" type="text" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Jane Trader" maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="settings-username">Username</label>
            <input id="settings-username" type="text" value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="janetrader" maxLength={30} autoCapitalize="none" autoCorrect="off" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="settings-bio">Bio</label>
          <textarea id="settings-bio" value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="A short line about your trading style, focus, or goals…" style={{ minHeight: 100 }} maxLength={300} />
        </div>

        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="settings-timezone">Timezone</label>
          <select id="settings-timezone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
            <option value="">Not set</option>
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {message && <p role="status" style={{ fontSize: 13, color: message.type === 'success' ? 'var(--win)' : 'var(--loss)' }}>{message.text}</p>}

        <div>
          <button className="btn btn-accent" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={15} className="auth-spin" /> : <Check size={15} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </ScrollCard>
  );
}

// ---------------------------------------------------------------- Notifications
function SectionNotifications() {
  const [prefs, setPrefs] = useState(loadPrefs);

  const toggles = [
    { key: 'syncAlerts', label: 'Sync Alerts', description: 'Show a notification when offline changes are synced to your account.' },
    { key: 'summaryDigest', label: 'Daily Summary Digest', description: 'Receive a friendly reminder about your trading day.' },
  ];

  function toggle(key) {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch (e) {
        // ignore storage errors
      }
      return next;
    });
  }

  return (
    <ScrollCard>
      <SectionTitle icon={Bell} title="Notifications" description="Control which push-style alerts EdgeJournal shows on this device." />
      {toggles.map((t) => (
        <label
          key={t.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '14px 0',
            borderTop: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{t.label}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>
          </div>
          <input type="checkbox" checked={!!prefs[t.key]} onChange={() => toggle(t.key)} style={{ accentColor: 'var(--red)', width: 18, height: 18 }} />
        </label>
      ))}
    </ScrollCard>
  );
}

// ---------------------------------------------------------------- Security
function SectionSecurity() {
  const { user, requestPasswordReset } = useAuth();
  const [message, setMessage] = useState(null);
  const [sending, setSending] = useState(false);

  async function handleReset() {
    if (!user?.email) return;
    setSending(true);
    setMessage(null);
    try {
      await requestPasswordReset(user.email);
      setMessage({ type: 'success', text: `Password reset link sent to ${user.email}.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not send a reset link.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ScrollCard>
        <SectionTitle icon={ShieldCheck} title="Security" description="Account security settings. Authentication is managed securely by Supabase." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 18 }}>
          <Mail size={14} />
          <span>
            Signed in as <strong style={{ color: 'var(--text)' }}>{user?.email || '—'}</strong>
          </span>
        </div>
        <button className="btn btn-ghost" onClick={handleReset} disabled={sending}>
          {sending ? <Loader2 size={15} className="auth-spin" /> : <Send size={15} />}
          {sending ? 'Sending…' : 'Send Password Reset Email'}
        </button>
        {message && <p style={{ fontSize: 13, marginTop: 12, color: message.type === 'success' ? 'var(--win)' : 'var(--loss)' }}>{message.text}</p>}
      </ScrollCard>
    </div>
  );
}

// ---------------------------------------------------------------- System
function EditableList({ title, description, items, onChange }) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft('');
  }
  function remove(item) {
    onChange(items.filter((i) => i !== item));
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 className="section-title">{title}</h3>
      {description && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>{description}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {items.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Nothing added yet.</p>}
        {items.map((item) => (
          <div
            key={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13.5,
            }}
          >
            <span>{item}</span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(item)} aria-label={`Remove ${item}`}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add new..."
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '9px 12px',
            color: 'var(--text)',
            fontSize: 13.5,
          }}
        />
        <button className="btn btn-accent btn-sm" onClick={add}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

function SectionSystem() {
  const { models, setModels, riskCriteria, setRiskCriteria, checklistCriteria, setChecklistCriteria } = useData();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ScrollCard>
        <SectionTitle icon={SlidersHorizontal} title="System" description="Configure the trading models and checklists used throughout your journal." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 16 }}>
          <EditableList title="Trading Models" description="Used in the Trade Log dropdown." items={models} onChange={setModels} />
          <EditableList title="Risk Management Checklist" description="Criteria shown in the trade log's risk checklist." items={riskCriteria} onChange={setRiskCriteria} />
          <EditableList title="Trade Checklist" description="Criteria shown in the trade log's execution checklist." items={checklistCriteria} onChange={setChecklistCriteria} />
        </div>
      </ScrollCard>
    </div>
  );
}

// ---------------------------------------------------------------- Backup
function SectionBackup() {
  const { trades, goals, plans, reflections, study, challenges, reloadAllFromStorage } = useData();
  const { accounts, refetch: refetchAccounts, reloadLedger } = useAccounts();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null);
  const [importing, setImporting] = useState(false);

  const kb = (estimateStorageBytes() / 1024).toFixed(1);

  function handleExport() {
    // Accounts travel as the stable, restorable fields only — the derived
    // balance stats (currentBalance, drawdown, ...) are recomputed from real
    // trades on restore, never stored in the backup.
    const accountsData = (accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      broker: a.broker,
      accountType: a.accountType,
      platform: a.platform,
      startingBalance: a.startingBalance,
      currency: a.currency,
      status: a.status,
      isDefault: a.isDefault,
    }));
    const data = exportAllData(
      trades.items,
      goals.items,
      plans.items,
      reflections.items,
      study.items,
      { accounts: accountsData, challenges: challenges.items }
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSONFile(data, `edgejournal-backup-${stamp}.json`);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Validate the whole backup BEFORE committing anything, so a bad
      // file is rejected cleanly and can never cause a partial restore or
      // a misleading "imported successfully" message.
      validateBackupData(data);
      importAllData(data);
      // Accounts must be restored BEFORE trades/challenges (which point at
      // them by id), but never wipe existing accounts — restore is a merge.
      if (user?.id && Array.isArray(data.accounts) && data.accounts.length) {
        await restoreAccounts(user.id, data.accounts);
      }
      if (Array.isArray(data.challenges) && data.challenges.length) await challenges.importMany(data.challenges);
      if (Array.isArray(data.trades) && data.trades.length) await trades.importMany(data.trades);
      if (Array.isArray(data.goals) && data.goals.length) await goals.importMany(data.goals);
      if (Array.isArray(data.plans) && data.plans.length) await plans.importMany(data.plans);
      if (Array.isArray(data.reflections) && data.reflections.length) await reflections.importMany(data.reflections);
      if (Array.isArray(data.study) && data.study.length) await study.importMany(data.study);
      // Refresh authoritative state (accounts + recompute balances from the
      // now-imported trade history) plus the local collections.
      reloadAllFromStorage();
      await refetchAccounts();
      reloadLedger();
      setImportMsg({ type: 'success', text: 'Backup imported successfully.' });
    } catch (err) {
      setImportMsg({
        type: 'error',
        text: err?.message && err.message !== 'Invalid backup file'
          ? `Could not import this file: ${err.message}`
          : 'Could not import this file. Make sure it is a valid EdgeJournal backup JSON.',
      });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <ScrollCard>
      <SectionTitle icon={Database} title="Backup" description="Export a safety-net backup or restore from a previous JSON file." />
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
        Trades, goals, pre-market plans, reflections, and study notes all sync to your Supabase account automatically. Export a backup regularly as an extra safety net.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={15} /> Export JSON Backup
        </button>
        <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload size={15} /> {importing ? 'Importing…' : 'Import JSON Backup'}
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />
      </div>
      {importMsg && (
        <p style={{ fontSize: 13, marginTop: 12, color: importMsg.type === 'success' ? 'var(--win)' : 'var(--loss)' }}>{importMsg.text}</p>
      )}

      <div style={{ marginTop: 24, padding: 18, borderRadius: 12, border: '1px solid rgba(255,59,78,0.25)', background: 'linear-gradient(180deg, rgba(255,59,78,0.06), transparent)' }}>
        <h4 style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red)', marginBottom: 8 }}>
          <ShieldCheck size={15} /> Data Safety Notice
        </h4>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p>
            Trades, goals, pre-market plans, reflections, and study notes are stored in your Supabase account, protected by row-level security. Your trading models and checklists are stored only in this browser's local storage.
          </p>
          <p>Clearing browser data, using a different browser, or switching devices won't affect your synced data, but will reset your models and checklists to the defaults unless you've exported a backup.</p>
          <p>
            Current local storage usage: <span className="mono" style={{ color: 'var(--text)' }}>{kb} KB</span>
          </p>
        </div>
      </div>
    </ScrollCard>
  );
}

// ---------------------------------------------------------------- About
function SectionAbout() {
  return (
    <ScrollCard>
      <SectionTitle icon={Info} title="About" description="EdgeJournal — your whole trading edge in one journal." />
      <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--red), var(--red-strong))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            EJ
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>EdgeJournal</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>v2.2.3 Stable Beta</div>
          </div>
        </div>
        <p>
          A forex / futures trading journal app. Log trades, set goals, build pre-market plans, reflect on your sessions, review the market, and track performance — all backed by Supabase with full offline support.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['React 18', 'Vite', 'Supabase', 'Recharts', 'Framer Motion'].map((t) => (
            <span key={t} className="tag tag-neutral">{t}</span>
          ))}
        </div>
      </div>
    </ScrollCard>
  );
}