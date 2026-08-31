// Number, Currency, and Date Formatters

export function formatCurrency(value: number, currency: string = 'USD'): string {
  const num = Number(value) || 0;
  const prefix = num < 0 ? '-$' : '$';
  return `${prefix}${Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number): string {
  const num = Number(value) || 0;
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(1)}%`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(Number(year), month, day);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateString;
  } catch {
    return dateString;
  }
}
