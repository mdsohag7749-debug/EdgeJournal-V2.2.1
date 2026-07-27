import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DataProvider } from './context/DataContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import PreMarketPlan from './pages/PreMarketPlan';
import TradingJournal from './pages/TradingJournal';
import Reflections from './pages/Reflections';
import Study from './pages/Study';
import Goals from './pages/Goals';
import System from './pages/System';

const PAGES = {
  dashboard: Dashboard,
  premarket: PreMarketPlan,
  journal: TradingJournal,
  reflections: Reflections,
  study: Study,
  goals: Goals,
  system: System,
};

const PAGE_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Your trading performance at a glance' },
  premarket: { title: 'Pre-Market Plan' },
  journal: { title: 'Trading Journal' },
  reflections: { title: 'Reflections' },
  study: { title: 'Study' },
  goals: { title: 'Goals', subtitle: 'Set targets and track your progress toward them' },
  system: { title: 'System' },
};

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const Page = PAGES[active] || Dashboard;
  const meta = PAGE_META[active] || {};

  return (
    <DataProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active={active} onNavigate={setActive} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
        <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 60px' }}>
          {active === 'dashboard' ? null : <Header title={meta.title} subtitle={meta.subtitle} />}
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Page onNavigate={setActive} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </DataProvider>
  );
}
