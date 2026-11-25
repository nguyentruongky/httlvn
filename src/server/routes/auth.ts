import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { signToken, verifyToken } from '../middleware/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoute = new Hono()
  .post('/login', zValidator('json', loginSchema), async (c) => {
    if (!db) {
      return c.json({ error: 'Database not available' }, 503);
    }

    const { email, password } = c.req.valid('json');

    const [user] = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, role: users.role })
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const valid = await Bun.password.verify(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return c.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  })
  .get('/me', async (c) => {
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

    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    return c.json({ user: { id: user.id, email: user.email, role: user.role } });
  })
  .post('/logout', async (c) => {
    return c.json({ ok: true });
  });
