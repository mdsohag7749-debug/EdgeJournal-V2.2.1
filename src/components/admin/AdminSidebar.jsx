import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Wallet,
  CandlestickChart,
  Activity,
  Brain,
  FileText,
  CreditCard,
  ScrollText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin', phase: null, functional: true },
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users', phase: null, functional: true },
  { id: 'accounts', label: 'Trading Accounts', icon: Wallet, path: '/admin/accounts', phase: null, functional: true },
  { id: 'trades', label: 'Trades', icon: CandlestickChart, path: '/admin/trades', phase: null, functional: true },
  { id: 'analytics', label: 'Analytics', icon: Activity, path: '/admin/analytics', phase: null, functional: true },
  { id: 'edge-ai', label: 'Edge AI', icon: Brain, path: '/admin/edge-ai', phase: 'Future', functional: false },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/admin/reports', phase: null, functional: true },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, path: '/admin/subscriptions', phase: null, functional: true },
  { id: 'audit-logs', label: 'Audit Logs', icon: ScrollText, path: '/admin/audit-logs', phase: null, functional: true },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings', phase: 'Future', functional: false },
];

export default function AdminSidebar({
  active = 'overview',
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onCloseMobile,
}) {
  const navigate = useNavigate();

  const sidebarContent = (isMobile = false) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-elevated)',
        borderRight: isMobile ? 'none' : '1px solid var(--border)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: (!isMobile && collapsed) ? '20px 0' : '20px 16px',
          justifyContent: (!isMobile && collapsed) ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: 'linear-gradient(135deg, var(--red), var(--red-strong))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(193, 18, 31, 0.35)',
            }}
          >
            <TrendingUp size={16} color="#fff" />
          </motion.div>

          {(isMobile || !collapsed) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                }}
              >
                EdgeJournal
              </span>
              <span
                className="tag tag-red"
                style={{ fontSize: 10, padding: '2px 6px', letterSpacing: '0.04em' }}
              >
                ADMIN
              </span>
            </div>
          )}
        </div>

        {isMobile && (
          <button
            onClick={onCloseMobile}
            className="btn btn-ghost btn-sm"
            aria-label="Close admin menu"
            style={{ padding: 6 }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav
        aria-label="Admin Navigation"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: (!isMobile && collapsed) ? '12px 6px' : '12px 10px',
        }}
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          const isFunctional = item.functional;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (isFunctional) {
                  navigate(item.path);
                  if (isMobile && onCloseMobile) onCloseMobile();
                }
              }}
              title={
                !isMobile && collapsed
                  ? `${item.label}${item.phase ? ` (${item.phase})` : ''}`
                  : item.phase
                  ? `${item.label} (Scheduled for ${item.phase})`
                  : item.label
              }
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={!isFunctional}
              disabled={!isFunctional}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: (!isMobile && collapsed) ? '10px 0' : '9px 12px',
                justifyContent: (!isMobile && collapsed) ? 'center' : 'flex-start',
                borderRadius: 10,
                border: 'none',
                cursor: isFunctional ? 'pointer' : 'not-allowed',
                background: isActive ? 'var(--red-glow)' : 'transparent',
                color: isActive
                  ? 'var(--red)'
                  : isFunctional
                  ? 'var(--text)'
                  : 'var(--text-faint)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                position: 'relative',
                transition: 'all 0.15s ease',
                opacity: isFunctional ? 1 : 0.6,
                textAlign: 'left',
                width: '100%',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: 3,
                    borderRadius: 4,
                    background: 'var(--red)',
                  }}
                />
              )}
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
              {(isMobile || !collapsed) && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </span>
                  {item.phase && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-faint)',
                        marginLeft: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.phase}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Return to Trader App Shortcut & Collapse */}
      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm"
          title="Return to Trader Application"
          style={{
            width: '100%',
            justifyContent: (!isMobile && collapsed) ? 'center' : 'flex-start',
            padding: '8px 10px',
            fontSize: 12.5,
            color: 'var(--text-muted)',
          }}
        >
          <ArrowLeft size={15} />
          {(isMobile || !collapsed) && <span>Trader App</span>}
        </button>

        {!isMobile && onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="btn btn-ghost btn-sm"
            aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            style={{
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: '8px 10px',
              fontSize: 12.5,
              color: 'var(--text-faint)',
            }}
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 30,
          flexShrink: 0,
        }}
        className="admin-sidebar-desktop"
      >
        <motion.div
          animate={{ width: collapsed ? 72 : 220 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{ height: '100%', overflow: 'hidden' }}
        >
          {sidebarContent(false)}
        </motion.div>
      </aside>

      {/* Mobile Off-canvas Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(3px)',
                zIndex: 90,
              }}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                width: 260,
                zIndex: 100,
                boxShadow: 'var(--shadow-lifted)',
              }}
              aria-label="Mobile Admin Navigation"
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
