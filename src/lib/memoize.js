// A tiny shared memoizer for the Analytics intelligence engines. Each of these
// engines is a pure function of `(trades, period)` — if a call conflicts with
// the time-relative `week`/`month`/`30` filters, that staleness already exists
// in the widgets' own useMemo, so sharing the result here never introduces NEW
// staleness; it only collapses duplicate work. The cache is keyed on the *array
// reference* (WeakMap) so it auto-invalidates whenever DataContext hands out a
// fresh `trades.items`, and results for no-longer-referenced arrays are GC'd.

export function memoizeByArgs(compute) {
  const byArray = new WeakMap();
  return function (array, ...rest) {
    if (!array || typeof array !== 'object') return compute(array, ...rest);
    const key = rest
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join('\u0001');
    let map = byArray.get(array);
    if (!map) {
      map = new Map();
      byArray.set(array, map);
    } else if (map.has(key)) {
      return map.get(key);
    }
    const result = compute(array, ...rest);
    map.set(key, result);
    return result;
  };
}