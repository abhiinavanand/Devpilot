export const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export const formatPercent = (value) =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);
