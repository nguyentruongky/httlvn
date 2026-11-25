import { jwtVerify, SignJWT } from 'jose';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'change-me-in-production';

if (process.env.NODE_ENV !== 'production' && JWT_SECRET === 'change-me-in-production') {
  console.warn('[Auth] Using default JWT secret. Set ADMIN_JWT_SECRET in production.');
}

interface JWTPayload {
  sub: number;
  email: string;
  role: string;
}

export function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    if (!db) {
      return c.json({ error: 'Database not available' }, 503);
    }

    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.sub));

    if (!user || user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    (c as Context & { vars: { user: AuthUser } }).set('user', {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await next();
  };
}
