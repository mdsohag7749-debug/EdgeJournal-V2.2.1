import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Globe,
  Mail,
  Clock,
  Coins,
  UserCheck,
  AlertOctagon,
  Lock,
  Info,
} from 'lucide-react';
import { fetchSystemSettings, updateSystemSetting } from '../../lib/adminApi';

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Frankfurt',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'UTC',
];

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];

export default function AdminSettings() {
  const [settings, setSettings] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [initialValues, setInitialValues] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Dangerous confirmation modal state for maintenance mode
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [pendingMaintenanceToggle, setPendingMaintenanceToggle] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSystemSettings();
      setSettings(data);

      const map = {};
      data.forEach((s) => {
        map[s.key] = s.value;
      });

      // Ensure fallbacks for known settings if not yet in database
      const mergedValues = {
        public_app_name: map.public_app_name ?? 'EdgeJournal',
        public_support_email: map.public_support_email ?? 'support@edgejournal.com',
        default_timezone: map.default_timezone ?? 'America/New_York',
        default_currency: map.default_currency ?? 'USD',
        registration_enabled: map.registration_enabled ?? true,
        maintenance_mode: map.maintenance_mode ?? false,
        session_idle_timeout_minutes: map.session_idle_timeout_minutes ?? 60,
        ...map,
      };

      setFormValues(mergedValues);
      setInitialValues(mergedValues);
    } catch (err) {
      setError(err?.message || 'Failed to load system settings from database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Dirty detection
  const dirtyKeys = useMemo(() => {
    const dirty = [];
    Object.keys(formValues).forEach((key) => {
      if (JSON.stringify(formValues[key]) !== JSON.stringify(initialValues[key])) {
        dirty.push(key);
      }
    });
    return dirty;
  }, [formValues, initialValues]);

  const isDirty = dirtyKeys.length > 0;

  function updateField(key, value) {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSuccessMessage(null);
  }

  // Handle Maintenance Mode Toggle safely with confirmation
  function handleMaintenanceToggle(checked) {
    if (checked) {
      // Enabling maintenance mode requires explicit confirmation
      setPendingMaintenanceToggle(true);
      setShowMaintenanceModal(true);
    } else {
      // Disabling maintenance mode can proceed directly
      updateField('maintenance_mode', false);
    }
  }

  function confirmMaintenanceEnable() {
    updateField('maintenance_mode', true);
    setShowMaintenanceModal(false);
    setPendingMaintenanceToggle(false);
  }

  function cancelMaintenanceEnable() {
    setShowMaintenanceModal(false);
    setPendingMaintenanceToggle(false);
  }

  // Validation
  const validationError = useMemo(() => {
    if (!formValues.public_app_name || !String(formValues.public_app_name).trim()) {
      return 'Application display name cannot be blank.';
    }
    const email = String(formValues.public_support_email || '').trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
      return 'Support email must be a valid email address.';
    }
    const timeout = Number(formValues.session_idle_timeout_minutes);
    if (isNaN(timeout) || timeout < 5 || timeout > 1440) {
      return 'Session idle timeout must be between 5 and 1440 minutes.';
    }
    return null;
  }, [formValues]);

  async function handleSave(e) {
    if (e) e.preventDefault();
    if (!isDirty || validationError) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      for (const key of dirtyKeys) {
        await updateSystemSetting(key, formValues[key]);
      }
      setInitialValues({ ...formValues });
      setSuccessMessage(`Successfully saved ${dirtyKeys.length} system setting${dirtyKeys.length > 1 ? 's' : ''}.`);
      await loadSettings();
    } catch (err) {
      setError(err?.message || 'Failed to save system settings.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setFormValues({ ...initialValues });
    setError(null);
    setSuccessMessage(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Telemetry / Status Banner */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 20px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(193, 18, 31, 0.15), rgba(193, 18, 31, 0.05))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(193, 18, 31, 0.25)',
              color: 'var(--red)',
            }}
          >
            <Sliders size={20} />
          </div>
          <div>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                color: 'var(--text)',
                fontFamily: 'var(--font-display)',
              }}
            >
              System Settings & Platform Hardening
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Enforced by database RLS, Security Definer guards, and append-only audit logging.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="tag tag-green"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
          >
            <Shield size={13} />
            RLS ENFORCED
          </span>
          <button
            onClick={loadSettings}
            disabled={isLoading || isSaving}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            aria-label="Refresh system settings"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 18px',
              background: 'rgba(22, 163, 74, 0.1)',
              border: '1px solid rgba(22, 163, 74, 0.3)',
              borderRadius: 10,
              color: 'var(--win)',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 18px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              color: 'var(--loss)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13.5 }}>{error}</span>
            </div>
            <button
              onClick={loadSettings}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--loss)', textDecoration: 'underline', padding: 0 }}
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Warning */}
      {validationError && isDirty && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: 8,
            color: 'var(--yellow)',
            fontSize: 13,
          }}
        >
          <Info size={16} />
          <span>{validationError}</span>
        </div>
      )}

      {/* Main Form Content */}
      {isLoading ? (
        <div
          className="card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            color: 'var(--text-muted)',
          }}
        >
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--red)' }} />
          <p style={{ margin: 0, fontSize: 14 }}>Loading system configuration parameters…</p>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* SECTION 1: GENERAL SETTINGS */}
          <div
            className="card"
            style={{
              padding: '24px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Globe size={18} color="var(--red)" />
                General Platform Settings
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Public application identity and regional operational defaults.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {/* App Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="setting-app-name"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}
                >
                  Application Display Name
                </label>
                <input
                  id="setting-app-name"
                  type="text"
                  className="input"
                  value={formValues.public_app_name || ''}
                  onChange={(e) => updateField('public_app_name', e.target.value)}
                  placeholder="e.g. EdgeJournal"
                  required
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13.5,
                    color: 'var(--text)',
                  }}
                />
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  Visible across public headers, title tags, and brand badges.
                </span>
              </div>

              {/* Support Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="setting-support-email"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}
                >
                  Public Support Email
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="setting-support-email"
                    type="email"
                    className="input"
                    value={formValues.public_support_email || ''}
                    onChange={(e) => updateField('public_support_email', e.target.value)}
                    placeholder="support@edgejournal.com"
                    required
                    style={{
                      width: '100%',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '9px 12px 9px 34px',
                      fontSize: 13.5,
                      color: 'var(--text)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <Mail
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  Official support contact shown in documentation and system footers.
                </span>
              </div>

              {/* Default Timezone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="setting-default-timezone"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}
                >
                  Default Trading Timezone
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    id="setting-default-timezone"
                    className="input"
                    value={formValues.default_timezone || 'America/New_York'}
                    onChange={(e) => updateField('default_timezone', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '9px 12px 9px 34px',
                      fontSize: 13.5,
                      color: 'var(--text)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <Clock
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  Default reference timezone for new accounts and session breakdowns.
                </span>
              </div>

              {/* Default Currency */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="setting-default-currency"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}
                >
                  Default Base Currency
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    id="setting-default-currency"
                    className="input"
                    value={formValues.default_currency || 'USD'}
                    onChange={(e) => updateField('default_currency', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '9px 12px 9px 34px',
                      fontSize: 13.5,
                      color: 'var(--text)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {COMMON_CURRENCIES.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                  <Coins
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  Standard base currency applied when initializing new accounts.
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: PLATFORM CONTROLS */}
          <div
            className="card"
            style={{
              padding: '24px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Sliders size={18} color="var(--red)" />
                Platform Operational Controls
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Control registration access and platform-wide maintenance mode status.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Registration Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: formValues.registration_enabled
                        ? 'rgba(22, 163, 74, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      color: formValues.registration_enabled ? 'var(--win)' : 'var(--loss)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        User Registration
                      </span>
                      <span
                        className={formValues.registration_enabled ? 'tag tag-green' : 'tag tag-red'}
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        {formValues.registration_enabled ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                      {formValues.registration_enabled
                        ? 'New visitors may register and create accounts freely.'
                        : 'New registration is paused. Existing traders and administrators can still sign in.'}
                    </p>
                  </div>
                </div>

                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: 48,
                    height: 26,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    id="toggle-registration-enabled"
                    type="checkbox"
                    checked={Boolean(formValues.registration_enabled)}
                    onChange={(e) => updateField('registration_enabled', e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                    aria-label="Toggle user registration"
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: formValues.registration_enabled ? 'var(--win)' : 'var(--border)',
                      borderRadius: 26,
                      transition: 'all 0.2s ease',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: formValues.registration_enabled ? 25 : 3,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </label>
              </div>

              {/* Maintenance Mode Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: formValues.maintenance_mode ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg)',
                  border: formValues.maintenance_mode
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid var(--border)',
                  borderRadius: 10,
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: formValues.maintenance_mode
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)',
                      color: formValues.maintenance_mode ? 'var(--red)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AlertOctagon size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        Maintenance Mode
                      </span>
                      <span
                        className={formValues.maintenance_mode ? 'tag tag-red' : 'tag'}
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        {formValues.maintenance_mode ? 'MAINTENANCE ACTIVE' : 'NORMAL OPERATION'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                      {formValues.maintenance_mode
                        ? 'Platform maintenance banner shown to traders. Administrator access remains completely active.'
                        : 'Platform is operating normally for all authorized users.'}
                    </p>
                  </div>
                </div>

                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: 48,
                    height: 26,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    id="toggle-maintenance-mode"
                    type="checkbox"
                    checked={Boolean(formValues.maintenance_mode)}
                    onChange={(e) => handleMaintenanceToggle(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                    aria-label="Toggle maintenance mode"
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: formValues.maintenance_mode ? 'var(--red)' : 'var(--border)',
                      borderRadius: 26,
                      transition: 'all 0.2s ease',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: formValues.maintenance_mode ? 25 : 3,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 3: ADMINISTRATIVE CONTROLS (ADMIN ONLY) */}
          <div
            className="card"
            style={{
              padding: '24px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Lock size={18} color="var(--red)" />
                  Administrative Controls (Admin-Only)
                </h3>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(193, 18, 31, 0.1)',
                    border: '1px solid rgba(193, 18, 31, 0.25)',
                    color: 'var(--red)',
                  }}
                >
                  NOT EXPOSED TO TRADERS
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Private system parameters protected by Row Level Security (never accessible to non-administrators).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="setting-session-idle-timeout"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}
                >
                  Session Idle Timeout (Minutes)
                </label>
                <input
                  id="setting-session-idle-timeout"
                  type="number"
                  min="5"
                  max="1440"
                  className="input"
                  value={formValues.session_idle_timeout_minutes ?? 60}
                  onChange={(e) => updateField('session_idle_timeout_minutes', Number(e.target.value))}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13.5,
                    color: 'var(--text)',
                  }}
                />
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  Inactivity threshold before administrative sessions require re-verification.
                </span>
              </div>
            </div>
          </div>

          {/* Form Action Buttons Bar */}
          <div
            style={{
              position: 'sticky',
              bottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-lifted)',
              zIndex: 10,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isDirty ? (
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--yellow)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertTriangle size={15} />
                  {dirtyKeys.length} unsaved setting change{dirtyKeys.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <CheckCircle2 size={15} color="var(--win)" />
                  All system settings synchronized with database
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || isSaving}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>

              <button
                type="submit"
                disabled={!isDirty || !!validationError || isSaving}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--red)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Saving Changes…</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Dangerous Confirmation Modal for Maintenance Mode */}
      <AnimatePresence>
        {showMaintenanceModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card"
              style={{
                maxWidth: 480,
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 14,
                padding: '24px',
                boxShadow: 'var(--shadow-lifted)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="maintenance-modal-title"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--red)',
                    flexShrink: 0,
                  }}
                >
                  <AlertOctagon size={24} />
                </div>
                <div>
                  <h3
                    id="maintenance-modal-title"
                    style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}
                  >
                    Enable Platform Maintenance Mode?
                  </h3>
                  <span style={{ fontSize: 12.5, color: 'var(--loss)', fontWeight: 600 }}>
                    Operational Impact Confirmation Required
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                Enabling Maintenance Mode will display a maintenance status notice to all standard
                traders. New journal actions and account sync operations will be paused.
                <br />
                <br />
                <strong>Administrator access is preserved:</strong> You and other platform administrators
                will continue to have full access to the Admin Panel and settings.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={cancelMaintenanceEnable}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMaintenanceEnable}
                  className="btn btn-primary btn-sm"
                  style={{
                    background: 'var(--red)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  Confirm & Enable Maintenance
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
