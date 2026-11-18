import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { db, redis } from '../db/client.ts';
import { folders, type ApiKey, type FileRow } from '../db/schema.ts';
import { readSettings } from './settings.ts';

type RateLimitInput = {
  file?: Pick<FileRow, 'id' | 'folderId' | 'rateLimitOverride'>;
  folderId?: number;
  apiKey?: Pick<ApiKey, 'id' | 'rateLimitOverride'>;
};

export type TrafficStats = {
  totalRequests: number;
  minuteRequests: number;
  publicTotalRequests: number;
  publicMinuteRequests: number;
  publicWindows: {
    d1: number;
    m1: number;
    m3: number;
    m6: number;
    m12: number;
  };
  apiKeyStats: Array<{
    apiKeyId: number;
    totalRequests: number;
    minuteRequests: number;
    windows: {
      d1: number;
      m1: number;
      m3: number;
      m6: number;
      m12: number;
    };
  }>;
};

const TRAFFIC_KEY = {
  total: 'traffic:total',
  minute: (minute: number) => `traffic:minute:${minute}`,
  publicTotal: 'traffic:public:total',
  publicMinute: (minute: number) => `traffic:public:minute:${minute}`,
  publicDay: (stamp: string) => `traffic:public:day:${stamp}`,
  apiTotal: (apiKeyId: number) => `traffic:api:${apiKeyId}:total`,
  apiMinute: (apiKeyId: number, minute: number) => `traffic:api:${apiKeyId}:minute:${minute}`,
  apiDay: (apiKeyId: number, stamp: string) => `traffic:api:${apiKeyId}:day:${stamp}`
};

const TRAFFIC_MINUTE_TTL = 60 * 60 * 2;
const TRAFFIC_DAY_TTL = 60 * 60 * 24 * 410;
const WINDOW_DAYS = {
  d1: 1,
  m1: 30,
  m3: 90,
  m6: 180,
  m12: 365
} as const;
const MAX_WINDOW_DAYS = 365;

function currentMinuteStamp() {
  return Math.floor(Date.now() / 60_000);
}

function utcDayStamp(offsetDays = 0) {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - offsetDays);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function windowSums(dayValues: number[]) {
  const sumFirst = (count: number) => {
    let sum = 0;
    for (let i = 0; i < count && i < dayValues.length; i += 1) {
      sum += dayValues[i] ?? 0;
    }
    return sum;
  };

  return {
    d1: sumFirst(WINDOW_DAYS.d1),
    m1: sumFirst(WINDOW_DAYS.m1),
    m3: sumFirst(WINDOW_DAYS.m3),
    m6: sumFirst(WINDOW_DAYS.m6),
    m12: sumFirst(WINDOW_DAYS.m12)
  };
}

function clientAddress(c: Context) {
  const forwarded = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip');
  if (!forwarded) {
    return 'unknown';
  }
  return forwarded.split(',')[0]?.trim() || 'unknown';
}

async function resolveLimit({ file, folderId, apiKey }: RateLimitInput) {
  if (file && file.rateLimitOverride !== null) {
    return { limit: file.rateLimitOverride, scope: `file:${file.id}` };
  }

  const targetFolderId = file?.folderId ?? folderId;
  if (targetFolderId !== undefined) {
    const folder = await db.query.folders.findFirst({ where: eq(folders.id, targetFolderId) });
    if (folder && folder.rateLimitOverride !== null) {
      return { limit: folder.rateLimitOverride, scope: `folder:${folder.id}` };
    }
  }

  if (apiKey && apiKey.rateLimitOverride !== null) {
    return { limit: apiKey.rateLimitOverride, scope: `api:${apiKey.id}` };
  }

  const global = await readSettings();
  return { limit: global.globalRateLimit, scope: 'global' };
}

async function trackTraffic(minute: number, apiKeyId?: number) {
  const day = utcDayStamp();
  const pipeline = redis.pipeline();

  pipeline.incr(TRAFFIC_KEY.total);
  pipeline.incr(TRAFFIC_KEY.minute(minute));
  pipeline.expire(TRAFFIC_KEY.minute(minute), TRAFFIC_MINUTE_TTL);

  if (apiKeyId !== undefined) {
    pipeline.incr(TRAFFIC_KEY.apiTotal(apiKeyId));
    pipeline.incr(TRAFFIC_KEY.apiMinute(apiKeyId, minute));
    pipeline.expire(TRAFFIC_KEY.apiMinute(apiKeyId, minute), TRAFFIC_MINUTE_TTL);
    pipeline.incr(TRAFFIC_KEY.apiDay(apiKeyId, day));
    pipeline.expire(TRAFFIC_KEY.apiDay(apiKeyId, day), TRAFFIC_DAY_TTL);
  } else {
    pipeline.incr(TRAFFIC_KEY.publicTotal);
    pipeline.incr(TRAFFIC_KEY.publicMinute(minute));
    pipeline.expire(TRAFFIC_KEY.publicMinute(minute), TRAFFIC_MINUTE_TTL);
    pipeline.incr(TRAFFIC_KEY.publicDay(day));
    pipeline.expire(TRAFFIC_KEY.publicDay(day), TRAFFIC_DAY_TTL);
  }

  await pipeline.exec();
}

function asCounter(raw: unknown) {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export async function readTrafficStats(apiKeyIds: number[]): Promise<TrafficStats> {
  const minute = currentMinuteStamp();
  const dayStamps = Array.from({ length: MAX_WINDOW_DAYS }, (_, idx) => utcDayStamp(idx));

  const pipeline = redis.pipeline();
  pipeline.get(TRAFFIC_KEY.total);
  pipeline.get(TRAFFIC_KEY.minute(minute));
  pipeline.get(TRAFFIC_KEY.publicTotal);
  pipeline.get(TRAFFIC_KEY.publicMinute(minute));
  for (const stamp of dayStamps) {
    pipeline.get(TRAFFIC_KEY.publicDay(stamp));
  }

  for (const apiKeyId of apiKeyIds) {
    pipeline.get(TRAFFIC_KEY.apiTotal(apiKeyId));
    pipeline.get(TRAFFIC_KEY.apiMinute(apiKeyId, minute));
    for (const stamp of dayStamps) {
      pipeline.get(TRAFFIC_KEY.apiDay(apiKeyId, stamp));
    }
  }

  const output = await pipeline.exec();
  const rows = output ?? [];

  let idx = 0;
  const totalRequests = asCounter(rows[idx++]?.[1]);
  const minuteRequests = asCounter(rows[idx++]?.[1]);
  const publicTotalRequests = asCounter(rows[idx++]?.[1]);
  const publicMinuteRequests = asCounter(rows[idx++]?.[1]);
  const publicDailyValues = dayStamps.map(() => asCounter(rows[idx++]?.[1]));
  const publicWindows = windowSums(publicDailyValues);

  const apiKeyStats = apiKeyIds.map((apiKeyId) => {
    const total = asCounter(rows[idx++]?.[1]);
    const minuteValue = asCounter(rows[idx++]?.[1]);
    const dayValues = dayStamps.map(() => asCounter(rows[idx++]?.[1]));
    return {
      apiKeyId,
      totalRequests: total,
      minuteRequests: minuteValue,
      windows: windowSums(dayValues)
    };
  });

  return {
    totalRequests,
    minuteRequests,
    publicTotalRequests,
    publicMinuteRequests,
    publicWindows,
    apiKeyStats
  };
}

export async function enforceRateLimit(c: Context, input: RateLimitInput) {
  const { limit, scope } = await resolveLimit(input);
  const apiKeyId = input.apiKey?.id;
  const now = Date.now();
  const minute = Math.floor(now / 60_000);

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Scope', scope.split(':')[0]);

  if (limit <= 0) {
    await trackTraffic(minute, apiKeyId);
    c.header('X-RateLimit-Remaining', '0');
    c.header('Cache-Control', 'no-store');
    return c.json({ greska: 'Лимит захтева је постављен на 0.' }, 429);
  }

  const actor = apiKeyId !== undefined ? `api:${apiKeyId}` : `ip:${clientAddress(c)}`;
  const key = `rl:${scope}:${actor}:${minute}`;

  const counter = await redis.incr(key);
  if (counter === 1) {
    await redis.expire(key, 61);
  }

  await trackTraffic(minute, apiKeyId);

  c.header('X-RateLimit-Remaining', String(Math.max(limit - counter, 0)));

  if (counter > limit) {
    c.header('Cache-Control', 'no-store');
    c.header('Retry-After', String(Math.ceil(((minute + 1) * 60_000 - now) / 1000)));
    return c.json({ greska: 'Прекорачен лимит захтева.' }, 429);
  }
}
