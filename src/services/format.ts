export function asNullableNumber(input: unknown): number | null {
  if (input === undefined || input === null || input === '') {
    return null;
  }
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

export function asBoolean(input: unknown): boolean {
  if (typeof input === 'boolean') {
    return input;
  }
  if (typeof input === 'string') {
    return ['1', 'true', 'on', 'yes', 'da'].includes(input.toLowerCase());
  }
  return input === 1;
}

export function parseRateLimitOverride(input: unknown): number | null | undefined {
  if (input === null || (typeof input === 'string' && input.trim() === '')) return null;
  if (typeof input !== 'number' && typeof input !== 'string') return undefined;
  const value = Number(input);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  const clean = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return clean.length > 0 && clean !== '.' && clean !== '..' ? clean : 'fajl';
}

export function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
