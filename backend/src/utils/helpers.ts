// Shared utility helpers

export function parseNumber(value: unknown, defaultValue: number): number {
  if (value == null || value === '') return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

const MIN_LIMIT = 1;
const MAX_LIMIT = 200;

/** Parse and clamp limit for list endpoints (messages, etc.). */
export function parseLimit(value: unknown, defaultLimit: number): number {
  const n = parseNumber(value, defaultLimit);
  if (n < MIN_LIMIT) return MIN_LIMIT;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

/** Parse and clamp offset (non-negative). */
export function parseOffset(value: unknown, defaultOffset: number): number {
  const n = parseNumber(value, defaultOffset);
  return n < 0 ? 0 : n;
}
