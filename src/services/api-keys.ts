import { createHash } from 'node:crypto';

const API_KEY_HASH_PREFIX = 'sha256:';
const API_KEY_HASH_REGEX = /^sha256:[a-f0-9]{64}$/;

export function hashApiKey(raw: string) {
  const digest = createHash('sha256').update(raw).digest('hex');
  return `${API_KEY_HASH_PREFIX}${digest}`;
}

export function isHashedApiKey(value: string) {
  return API_KEY_HASH_REGEX.test(value);
}

export function apiKeyFingerprint(storedKey: string) {
  const normalized = storedKey.startsWith(API_KEY_HASH_PREFIX)
    ? storedKey.slice(API_KEY_HASH_PREFIX.length)
    : storedKey;

  if (normalized.length <= 14) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-6)}`;
}
