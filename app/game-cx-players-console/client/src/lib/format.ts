// Formatting helpers. Postgres NUMERIC/BIGINT and some warehouse DECIMALs arrive as strings,
// so every helper coerces with Number() first.

export const toNumber = (v: unknown): number => (v === null || v === undefined || v === '' ? NaN : Number(v));

export const formatUsd = (v: unknown, compact = false): string => {
  const n = toNumber(v);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n);
};

export const formatPct = (v: unknown, digits = 2): string => {
  const n = toNumber(v);
  return Number.isNaN(n) ? '—' : `${(n * 100).toFixed(digits)}%`;
};

export const formatScore = (v: unknown): string => {
  const n = toNumber(v);
  return Number.isNaN(n) ? '—' : n.toFixed(3);
};

export const formatInt = (v: unknown): string => {
  const n = toNumber(v);
  return Number.isNaN(n) ? '—' : new Intl.NumberFormat('en-US').format(n);
};

export const formatDate = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

export const formatDateTime = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
};

export const AS_OF_DATE = '2026-12-31';
