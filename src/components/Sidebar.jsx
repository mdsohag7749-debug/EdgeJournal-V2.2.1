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
  User,
  Trophy,
  Brain,
} from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'premarket', label: 'Pre-Market Plan', icon: Sunrise },
  { id: 'journal', label: 'Trading Journal', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'psychology', label: 'Psychology', icon: Brain },
  { id: 'reflections', label: 'Reflections', icon: MessageSquareText },
  { id: 'study', label: 'Study', icon: GraduationCap },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function Sidebar({ active, onNavigate, collapsed, onToggleCollapsed }) {
  return (
    <motion.div
      animate={{ width: collapsed ? 72 : 190 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      style={{
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '22px 0' : '22px 18px',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <motion.div
          whileHover={{ scale: 1.06, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'linear-gradient(135deg, var(--red), var(--red-strong))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 6px 16px rgba(193, 18, 31, 0.28)',
          }}
        >
          <TrendingUp size={16} color="#fff" />
        </motion.div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15.5, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}
          >
            EdgeJournal
          </motion.span>
        )}
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 10px' }}>
        {NAV.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              whileHover={{ x: isActive ? 0 : 2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '11px 0' : '11px 13px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: isActive ? 'var(--red)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13.5,
                fontFamily: 'var(--font-body)',
                position: 'relative',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.035)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-bg"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 12,
                    background: 'var(--red-glow)',
                  }}
                />
              )}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '22%',
                    bottom: '22%',
                    width: 3,
                    borderRadius: 4,
                    background: 'var(--red)',
                  }}
                />
              )}
              <Icon size={17} strokeWidth={2} style={{ flexShrink: 0, position: 'relative' }} />
              {!collapsed && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}>
                  {item.label}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onToggleCollapsed}
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', padding: '9px 12px' }}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.div>
  );
}
