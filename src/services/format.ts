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
  return false;
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  const clean = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return clean.length > 0 ? clean : 'fajl';
}

export function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
