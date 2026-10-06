import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Check,
  X,
  ShieldCheck,
  Zap,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchActivePlans } from '../lib/subscriptionApi';
import {
  DEFAULT_FREE_PLAN,
  KNOWN_FEATURES,
  formatPlanPrice,
} from '../lib/entitlements';

function formatDate(isoString) {
  if (!isoString) return 'Standard / Ongoing';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function Subscription() {
  const {
    currentPlan,
    subscription,
    subscriptionStatus,
    entitlements,
    planLimits,
    isSubscriptionActive,
  } = useAuth();

  const [availablePlans, setAvailablePlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchActivePlans()
      .then((data) => {
        if (mounted) setAvailablePlans(data);
      })
      .catch((err) => {
        console.warn('Could not load plan list:', err);
      })
      .finally(() => {
        if (mounted) setLoadingPlans(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const activePlanName = currentPlan?.name || 'Free';
  const isFreePlan = currentPlan?.slug === 'free';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1100, margin: '0 auto' }}>
      {/* Scope Disclaimer / Notice */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'var(--bg-elevated)',
          borderLeft: '4px solid var(--accent)',
        }}
      >
        <Info size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)' }}>Subscription & Entitlement Notice: </strong>
          Upgrade options are currently managed by the platform administrator. EdgeJournal uses entitlement-based feature gating to determine account capabilities and volume thresholds.
        </div>
      </div>

      {/* Current Plan Overview Card */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2
                data-testid="current-plan-title"
                style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text)' }}
              >
                {`${activePlanName} Plan`}
              </h2>
              <span
                className={`tag ${
                  isSubscriptionActive || isFreePlan
                    ? 'tag-green'
                    : subscriptionStatus === 'expired'
                    ? 'tag-amber'
                    : 'tag-gray'
                }`}
                style={{ fontSize: 11, padding: '3px 10px', textTransform: 'capitalize' }}
                id="current-plan-status-badge"
                data-testid="current-plan-status-badge"
              >
                {isFreePlan ? 'Active' : subscriptionStatus}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              {currentPlan?.description || 'Your current journal entitlement tier.'}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>
              {formatPlanPrice(currentPlan?.price, currentPlan?.currency, currentPlan?.billingInterval)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
              Current Billing Tier
            </div>
          </div>
        </div>

        {/* Subscription Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 18,
            marginTop: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} />
              <span>Started / Member Since</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--text)' }}>
              {formatDate(subscription?.startedAt || subscription?.createdAt)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} />
              <span>Expiry / Renewal Date</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--text)' }}>
              {formatDate(subscription?.expiresAt)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} />
              <span>Trading Accounts Limit</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--text)' }}>
              Up to {planLimits?.accounts ?? 1} {planLimits?.accounts === 1 ? 'account' : 'accounts'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} />
              <span>Trade Logging Limit</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--text)' }}>
              Up to {(planLimits?.trades ?? 500).toLocaleString()} trades
            </div>
          </div>
        </div>
      </div>

      {/* Feature Entitlements Checklist */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0', color: 'var(--text)' }}>
          Included Feature Entitlements
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {KNOWN_FEATURES.map((feature) => {
            const hasAccess = entitlements.includes(feature.id);
            return (
              <div
                key={feature.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: hasAccess ? 'rgba(74, 222, 128, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${hasAccess ? 'rgba(74, 222, 128, 0.2)' : 'var(--border)'}`,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: hasAccess ? 'var(--green-muted)' : 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {hasAccess ? (
                    <Check size={14} color="var(--green)" />
                  ) : (
                    <X size={14} color="var(--text-faint)" />
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: hasAccess ? 'var(--text)' : 'var(--text-faint)',
                    }}
                  >
                    {feature.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {feature.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Plans Comparison */}
      <div>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Available Platform Tiers
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Compare capabilities across EdgeJournal subscription tiers.
          </p>
        </div>

        {loadingPlans ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading available plans…
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 20,
            }}
          >
            {(availablePlans.length > 0 ? availablePlans : [DEFAULT_FREE_PLAN]).map((plan) => {
              const isCurrent = currentPlan?.slug === plan.slug;

              return (
                <div
                  key={plan.id || plan.slug}
                  className="card"
                  style={{
                    padding: '24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    borderColor: isCurrent ? 'var(--accent)' : 'var(--border)',
                    boxShadow: isCurrent ? '0 0 0 1px var(--accent)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{plan.name}</h4>
                      {isCurrent && (
                        <span className="tag tag-accent" style={{ fontSize: 11, padding: '2px 8px' }}>
                          Current Plan
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 16px' }}>
                      {plan.description}
                    </div>

                    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
                      {formatPlanPrice(plan.price, plan.currency, plan.billingInterval)}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Tier Capabilities:
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Check size={14} color="var(--green)" />
                          <span>Up to {plan.limits?.accounts ?? 1} Trading Accounts</span>
                        </li>
                        <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Check size={14} color="var(--green)" />
                          <span>Up to {(plan.limits?.trades ?? 500).toLocaleString()} Trades</span>
                        </li>
                        {(plan.features || []).map((featId) => {
                          const meta = KNOWN_FEATURES.find((f) => f.id === featId);
                          return (
                            <li key={featId} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Check size={14} color="var(--green)" />
                              <span>{meta ? meta.label : featId}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    {isCurrent ? (
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', cursor: 'default' }}
                        disabled
                      >
                        Your Active Plan
                      </button>
                    ) : (
                      <div
                        style={{
                          textAlign: 'center',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          padding: '10px 12px',
                          background: 'var(--bg-elevated)',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                        }}
                      >
                        Managed by Administrator
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
