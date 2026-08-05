const TEXT_FIELDS = {
  name: 'name',
  propFirm: 'prop_firm',
  challengeType: 'challenge_type',
  status: 'status',
};

const NUMERIC_FIELDS = {
  startingBalance: 'starting_balance',
  profitTarget: 'profit_target',
  dailyDrawdown: 'daily_drawdown',
  maximumDrawdown: 'maximum_drawdown',
};

const INTEGER_FIELDS = {
  minTradingDays: 'min_trading_days',
};

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function toChallengeRow(challenge, userId, { partial = false } = {}) {
  const row = {};
  if (userId) row.user_id = userId;

  for (const [jsKey, dbKey] of Object.entries(TEXT_FIELDS)) {
    if (!partial || jsKey in challenge) {
      row[dbKey] = challenge[jsKey] ?? null;
    }
  }

  for (const [jsKey, dbKey] of Object.entries(NUMERIC_FIELDS)) {
    if (!partial || jsKey in challenge) {
      row[dbKey] = toNumberOrNull(challenge[jsKey]);
    }
  }

  for (const [jsKey, dbKey] of Object.entries(INTEGER_FIELDS)) {
    if (!partial || jsKey in challenge) {
      row[dbKey] = challenge[jsKey] ?? null;
    }
  }

  if (!partial || 'accountId' in challenge) row.account_id = challenge.accountId || null;
  if (!partial || 'startDate' in challenge) row.start_date = challenge.startDate || null;
  if (!partial || 'endDate' in challenge) row.end_date = challenge.endDate || null;

  return row;
}

export function fromChallengeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || '',
    propFirm: row.prop_firm || '',
    accountId: row.account_id || '',
    challengeType: row.challenge_type || 'Custom',
    startingBalance: row.starting_balance ?? 0,
    profitTarget: row.profit_target ?? 0,
    dailyDrawdown: row.daily_drawdown ?? 0,
    maximumDrawdown: row.maximum_drawdown ?? 0,
    minTradingDays: row.min_trading_days ?? 0,
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    status: row.status || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}