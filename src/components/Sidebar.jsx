import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Sunrise,
  BookOpen,
  MessageSquareText,
  GraduationCap,
  Target,
  Activity,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  Trophy,
  Brain,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'premarket', label: 'Pre-Market Plan', icon: Sunrise },
  { id: 'journal', label: 'Trading Journal', icon: BookOpen },
  { id: 'edge-ai', label: 'Edge AI', icon: Sparkles, badge: 'Beta' },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'psychology', label: 'Psychology', icon: Brain },
  { id: 'reflections', label: 'Reflections', icon: MessageSquareText },
  { id: 'study', label: 'Study', icon: GraduationCap },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ active, onNavigate, collapsed, onToggleCollapsed }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    ...NAV,
    ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: ShieldCheck, isAdminBadge: true }] : []),
  ];

  return (
    <motion.aside
      aria-label="Main sidebar"
      animate={{ width: collapsed ? 72 : 218 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      style={{
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'rgba(10, 16, 29, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 25,
        overflow: 'hidden',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: collapsed ? '22px 0' : '22px 20px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <motion.div
          whileHover={{ scale: 1.06, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #42d9ff 0%, #36e0c0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 18px rgba(66, 217, 255, 0.38)',
          }}
        >
          <TrendingUp size={18} color="#080d18" strokeWidth={2.5} />
        </motion.div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16.5,
                letterSpacing: '-0.02em',
                color: '#f8fafc',
                whiteSpace: 'nowrap',
              }}
            >
              EdgeJournal
            </span>
          </motion.div>
        )}
      </div>

      {/* Navigation List */}
      <nav
        aria-label="Main navigation"
        className="scroll-thin"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '12px 10px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {navItems.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={() => {
                if (item.id === 'admin') {
                  navigate('/admin');
                } else {
                  onNavigate(item.id);
                }
              }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              whileHover={{ x: isActive ? 0 : 2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '11px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 11,
                border: isActive ? '1px solid rgba(66, 217, 255, 0.28)' : '1px solid transparent',
                cursor: 'pointer',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(66, 217, 255, 0.16) 0%, rgba(54, 224, 192, 0.08) 100%)'
                  : 'transparent',
                color: isActive ? '#42d9ff' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13.5,
                fontFamily: 'var(--font-body)',
                position: 'relative',
                boxShadow: isActive ? '0 0 16px rgba(66, 217, 255, 0.12)' : 'none',
                transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <Icon
                size={17}
                strokeWidth={isActive ? 2.3 : 1.9}
                style={{
                  flexShrink: 0,
                  position: 'relative',
                  color: isActive ? '#42d9ff' : 'currentColor',
                }}
              />
              {!collapsed && (
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                    flex: 1,
                    textAlign: 'left',
                  }}
                >
                  {item.label}
                </span>
              )}
              {!collapsed && item.badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: 'rgba(66, 217, 255, 0.14)',
                    color: '#42d9ff',
                    border: '1px solid rgba(66, 217, 255, 0.3)',
                  }}
                >
                  {item.badge}
                </span>
              )}
              {!collapsed && item.isAdminBadge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: 'rgba(245, 158, 11, 0.14)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  Admin
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Collapse Toggle & Status Footer */}
      <div
        style={{
          padding: '10px 10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          onClick={onToggleCollapsed}
          className="btn btn-ghost"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: '8px 10px',
            fontSize: 12,
            borderRadius: 9,
          }}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!collapsed && <span>Collapse</span>}
        </button>

        {!collapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '2px 4px',
              fontSize: 10.5,
              color: 'var(--text-faint)',
            }}
          >
            <span>v2.3.0</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#36e0c0' }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#36e0c0',
                  boxShadow: '0 0 8px #36e0c0',
                }}
              />
              Market Open
            </span>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
