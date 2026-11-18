import type { ErrorHandler } from 'hono';
import { RedisUnavailableError } from '../db/client.ts';

export const handleServerError: ErrorHandler = (error, c) => {
  if (error instanceof RedisUnavailableError) {
    c.header('Cache-Control', 'no-store');
    c.header('Retry-After', '2');
    return c.json({ greska: 'Сервис је привремено недоступан. Покушајте поново.' }, 503);
  }

  console.error(error);
  return c.json({ greska: 'Интерна грешка сервера.' }, 500);
};
