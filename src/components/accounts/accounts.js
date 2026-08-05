// Shared constants + small helpers for the Account Management UI.
// Keeps the account cards, forms, and switcher consistent in what
// options they offer and how balances/status are displayed.

export const ACCOUNT_TYPES = ['Cash', 'Margin', 'Futures', 'Prop Firm', 'Forex', 'Crypto', 'Retirement', 'Demo'];

export const BROKERS = [
  'Interactive Brokers',
  'Charles Schwab',
  'TD Ameritrade',
  'OANDA',
  'Forex.com',
  'NinjaTrader',
  'TradeStation',
  'MetaTrader',
  'Binance',
  'Coinbase',
  'Other',
];

export const PLATFORMS = [
  'MetaTrader 4',
  'MetaTrader 5',
  'TradingView',
  'ThinkOrSwim',
  'NinjaTrader',
  'Tradovate',
  'cTrader',
  'Other',
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'BTC'];

// Sentinel used to represent "every account combined" in the global
// account selection (never collides with a real uuid). When selected,
// trades from ALL accounts are shown and aggregated together.
export const ALL_ACCOUNTS = '__all__';

export const ACCOUNT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

export const STATUS_META = {
  active: { label: 'Active', color: 'var(--win)' },
  inactive: { label: 'Inactive', color: 'var(--be)' },
  archived: { label: 'Archived', color: 'var(--text-faint)' },
};

const SYMBOLS = {
  USD: '$',
  GBP: '\u00a3',
  EUR: '\u20ac',
  JPY: '\u00a5',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  NZD: 'NZ$',
  BTC: 'BTC ',
};

// Renders a currency-aware balance. Returns '' for null/undefined so
// blank cards can render a placeholder instead of "$0".
export function formatBalance(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  const neg = n < 0;
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = SYMBOLS[currency] || `${currency} `;
  return `${neg ? '-' : ''}${sym}${abs}`;
}

// Which accounts should be offered as a destination when logging a NEW
// trade: default-first ordering, excluding archived ones.
export function sortTradeAccounts(accounts) {
  return [...accounts]
    .filter((a) => a.status !== 'archived')
    .sort((a, b) => {
      if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}