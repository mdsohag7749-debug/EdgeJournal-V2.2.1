// Centralized route configuration.
//
// This is the single source of truth for navigation: each entry maps a
// stable page `id` (the same ids already used by Sidebar/QuickActions/
// TodaysObjectives/RecentActivity via `onNavigate`) to a URL `path`, the
// page component to render, and the header meta shown at the top of the
// page. Adding a new page later only requires adding one entry here.

import { lazy } from 'react';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const PreMarketPlan = lazy(() => import('../pages/PreMarketPlan'));
const TradingJournal = lazy(() => import('../pages/TradingJournal'));
const Reflections = lazy(() => import('../pages/Reflections'));
const Study = lazy(() => import('../pages/Study'));
const Goals = lazy(() => import('../pages/Goals'));
const Analytics = lazy(() => import('../pages/Analytics'));
const System = lazy(() => import('../pages/System'));
const Profile = lazy(() => import('../pages/Profile'));

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
    id: 'analytics',
    path: '/analytics',
    Component: Analytics,
    title: 'Advanced Analytics',
    subtitle: 'Deep-dive performance breakdowns across every trade',
  },
  {
    id: 'system',
    path: '/system',
    Component: System,
    title: 'System',
  },
  {
    id: 'profile',
    path: '/profile',
    Component: Profile,
    title: 'Profile',
    subtitle: 'Manage how your account appears across EdgeJournal',
  },
];

export const defaultRoute = routes[0];
