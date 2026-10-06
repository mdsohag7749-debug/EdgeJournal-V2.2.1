import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminHeader from '../components/admin/AdminHeader';
import AdminOverview from '../pages/admin/AdminOverview';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminAccounts from '../pages/admin/AdminAccounts';
import AdminTrades from '../pages/admin/AdminTrades';
import AdminAnalytics from '../pages/admin/AdminAnalytics';
import AdminReports from '../pages/admin/AdminReports';
import AdminAuditLogs from '../pages/admin/AdminAuditLogs';
import AdminSubscriptions from '../pages/admin/AdminSubscriptions';

const HEADER_META = {
  overview: {
    title: 'Overview',
    subtitle: 'Platform operational telemetry, security health, and user metrics',
  },
  users: {
    title: 'User Management',
    subtitle: 'Directory of registered traders, account credentials, and administrative roles',
  },
  accounts: {
    title: 'Trading Accounts',
    subtitle: 'Platform-wide view of all trader accounts, balances, and account statuses',
  },
  trades: {
    title: 'Trade Management',
    subtitle: 'Platform-wide trade ledger — instruments, results, P&L, and risk across all users',
  },
  analytics: {
    title: 'Trade Analytics & Intelligence',
    subtitle: 'Platform-wide performance intelligence, equity curves, dynamic symbol rankings, and account metrics',
  },
  reports: {
    title: 'Platform Reports & Data Export',
    subtitle: 'Platform-level summaries, trading performance, user activity, and authorized CSV data export',
  },
  subscriptions: {
    title: 'Subscriptions & Plan Management',
    subtitle: 'Manage platform tier plans, feature entitlements, usage limits, and user subscriptions',
  },
  'audit-logs': {
    title: 'Audit Logs',
    subtitle: 'Append-only chronological audit trail of platform administrative actions and security events',
  },
};

export default function AdminShell() {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Responsive resize handler
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onResize() {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Determine active section and header metadata
  const currentPath = location.pathname;
  let activeSection = 'overview';
  if (currentPath.includes('/admin/users')) activeSection = 'users';
  else if (currentPath.includes('/admin/accounts')) activeSection = 'accounts';
  else if (currentPath.includes('/admin/trades')) activeSection = 'trades';
  else if (currentPath.includes('/admin/analytics')) activeSection = 'analytics';
  else if (currentPath.includes('/admin/reports')) activeSection = 'reports';
  else if (currentPath.includes('/admin/subscriptions')) activeSection = 'subscriptions';
  else if (currentPath.includes('/admin/audit-logs')) activeSection = 'audit-logs';

  const headerMeta = HEADER_META[activeSection] || HEADER_META.overview;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Keyboard accessible skip-link */}
      <a href="#admin-main-content" className="skip-link">
        Skip to admin content
      </a>

      {/* Admin Sidebar */}
      <AdminSidebar
        active={activeSection}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <main
          id="admin-main-content"
          style={{
            flex: 1,
            padding: '24px 32px 60px',
            maxWidth: 1400,
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <AdminHeader
            title={headerMeta.title}
            subtitle={headerMeta.subtitle}
            onOpenMobile={() => setMobileOpen(true)}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Routes>
                <Route index element={<AdminOverview />} />
                <Route path="overview" element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="accounts" element={<AdminAccounts />} />
                <Route path="trades" element={<AdminTrades />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="subscriptions" element={<AdminSubscriptions />} />
                <Route path="audit-logs" element={<AdminAuditLogs />} />
                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/overview" element={<AdminOverview />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/accounts" element={<AdminAccounts />} />
                <Route path="/admin/trades" element={<AdminTrades />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
