// Centralized route configuration.
//
// This is the single source of truth for navigation: each entry maps a
// stable page `id` (the same ids already used by Sidebar/QuickActions/
// TodaysObjectives/RecentActivity via `onNavigate`) to a URL `path`, the
// page component to render, and the header meta shown at the top of the
// page. Adding a new page later only requires adding one entry here.

import Dashboard from '../pages/Dashboard';
import PreMarketPlan from '../pages/PreMarketPlan';
import TradingJournal from '../pages/TradingJournal';
import Reflections from '../pages/Reflections';
import Study from '../pages/Study';
import Goals from '../pages/Goals';
import System from '../pages/System';

export const routes = [
  {
    id: 'dashboard',
    path: '/',
    Component: Dashboard,
    title: 'Dashboard',
    subtitle: 'Your trading performance at a glance',
    hideHeader: true,
  },
  {
    id: 'premarket',
    path: '/pre-market',
    Component: PreMarketPlan,
    title: 'Pre-Market Plan',
  },
  {
    id: 'journal',
    path: '/journal',
    Component: TradingJournal,
    title: 'Trading Journal',
  },
  {
    id: 'reflections',
    path: '/reflections',
    Component: Reflections,
    title: 'Reflections',
  },
  {
    id: 'study',
    path: '/study',
    Component: Study,
    title: 'Study',
  },
  {
    id: 'goals',
    path: '/goals',
    Component: Goals,
    title: 'Goals',
    subtitle: 'Set targets and track your progress toward them',
  },
  {
    id: 'system',
    path: '/system',
    Component: System,
    title: 'System',
  },
];

export const defaultRoute = routes[0];
