// Motivational trading quotes shown in the Dashboard hero.
// Original lines written for EdgeJournal — not sourced from any external work.
export const TRADING_QUOTES = [
  'Discipline is the bridge between your plan and your P&L.',
  'Every green day is built on a hundred boring, well-managed ones.',
  'Protect your capital first. The gains take care of themselves.',
  'A good trader is judged by process, not by any single trade.',
  'Patience is a position too — and often the most profitable one.',
  'The market rewards consistency far more than it rewards conviction.',
  'Cut losses fast, let winners breathe, and journal everything in between.',
  'Your edge is only as strong as your willingness to follow it.',
  'Risk management is not the boring part of trading — it is the trading.',
  'Small, repeatable wins compound into results big talkers never reach.',
  'The best trade you make today might be the one you decide to skip.',
  'Confidence comes from preparation, not from yesterday\'s results.',
  'A journal turns random outcomes into a repeatable process.',
  'You don\'t need to predict the market — you need to react well to it.',
  'Every setup you skip on principle is a rule you\'re strengthening.',
  'Consistency is quiet. It rarely feels exciting in the moment.',
  'Losses are tuition. Make sure you actually learn the lesson.',
  'Plan the trade, trade the plan, then review it without ego.',
  'The scoreboard is the byproduct. Discipline is the game.',
  'Great traders are made in the drawdowns, not in the rallies.',
];

// Deterministic pick so the quote stays stable for the whole day
// instead of changing on every re-render.
export function getDailyQuote(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const index = dayOfYear % TRADING_QUOTES.length;
  return TRADING_QUOTES[index];
}
