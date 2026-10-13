// Centralized route configuration.
//
// This is the single source of truth for navigation: each entry maps a
// stable page `id` (the same ids already used by Sidebar/QuickActions/
// TodaysObjectives/RecentActivity via `onNavigate`) to a URL `path`, the
// page component to render, and the header meta shown at the top of the
// page. Adding a new page later only requires adding one entry here.

import { lazy } from 'react';
import { LOW_GRAPHICS_LOADER_FINISH_MS, TRADING_LOADER_FINISH_MS } from '../components/LoadingScreen';

let hasDelayedInitialPageLoad = false;

function lazyPage(loadPage) {
  let pagePromise;
  const preload = () => {
    if (pagePromise) return pagePromise;

    const startedAt = performance.now();
    const shouldFinishLoader = !hasDelayedInitialPageLoad;
    hasDelayedInitialPageLoad = true;
    let lowGraphics = document.documentElement.dataset.graphicsMode === 'low';
    if (!document.documentElement.dataset.graphicsMode) {
      try {
        lowGraphics = window.localStorage.getItem('edgejournal-graphics-mode') === 'low';
      } catch {
        lowGraphics = false;
      }
    }

    pagePromise = loadPage().then((pageModule) => {
      if (!shouldFinishLoader) return pageModule;
      const finishAfter = lowGraphics ? LOW_GRAPHICS_LOADER_FINISH_MS : TRADING_LOADER_FINISH_MS;
      const remaining = finishAfter - (performance.now() - startedAt);
      if (remaining <= 0) return pageModule;
      return new Promise((resolve) => setTimeout(resolve, remaining)).then(() => pageModule);
    });
    return pagePromise;
  };

  const Component = lazy(preload);
  Component.preload = preload;
  return Component;
}

const Dashboard = lazyPage(() => import('../pages/Dashboard'));
const PreMarketPlan = lazyPage(() => import('../pages/PreMarketPlan'));
const TradingJournal = lazyPage(() => import('../pages/TradingJournal'));
const Reflections = lazyPage(() => import('../pages/Reflections'));
const Study = lazyPage(() => import('../pages/Study'));
const Goals = lazyPage(() => import('../pages/Goals'));
const Challenges = lazyPage(() => import('../pages/Challenges'));
const Analytics = lazyPage(() => import('../pages/Analytics'));
const Psychology = lazyPage(() => import('../pages/Psychology'));
const System = lazyPage(() => import('../pages/System'));
const Profile = lazyPage(() => import('../pages/Profile'));
const Settings = lazyPage(() => import('../pages/Settings'));
const Subscription = lazyPage(() => import('../pages/Subscription'));
const EdgeAI = lazyPage(() => import('../pages/EdgeAI'));

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
    id: 'challenges',
    path: '/challenges',
    Component: Challenges,
    title: 'Challenges',
    subtitle: 'Track prop firm challenge progress from real trades',
  },
  {
    id: 'analytics',
    path: '/analytics',
    Component: Analytics,
    title: 'Advanced Analytics',
    subtitle: 'Deep-dive performance breakdowns across every trade',
  },
  {
    id: 'edge-ai',
    path: '/edge-ai',
    Component: EdgeAI,
    title: 'Edge AI Command Center',
    subtitle: 'AI-assisted trading intelligence and journal analytics',
  },
  {
    id: 'psychology',
    path: '/psychology',
    Component: Psychology,
    title: 'Psychology',
    subtitle: 'Your trading mind — emotions, mistakes, compliance and discipline',
  },
  {
    id: 'system',
    path: '/system',
    Component: System,
    title: 'System',
  },
  {
    id: 'settings',
    path: '/settings',
    Component: Settings,
    title: 'Settings',
    subtitle: 'Manage your accounts and app configuration',
  },
  {
    id: 'subscription',
    path: '/subscription',
    Component: Subscription,
    title: 'Subscription & Plans',
    subtitle: 'View your active plan, manage entitlements, and inspect tier limits',
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
