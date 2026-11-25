import { hc } from 'hono/client';
import type { AppType } from '../server/app';
import { getToken } from './auth';

export const api = hc<AppType>('/', {
  headers: (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
