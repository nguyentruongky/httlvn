import { Hono } from 'hono';
import { db } from '../../db';
import { lessons } from '../../db/schema';
import { eq, or, ilike, desc, count } from 'drizzle-orm';
import { removeVietnameseDiacritics } from '../../lib/vietnamese';

export const lessonsRoute = new Hono()
  .get('/', async (c) => {
    const q = (c.req.query('q') || '').trim();
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '15', 10), 50);
    const offset = (page - 1) * limit;

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    const whereClause = q
      ? or(
          ilike(lessons.searchText, `%${removeVietnameseDiacritics(q).toLowerCase()}%`),
        )
      : undefined;

    const [results, totalResult] = await Promise.all([
      db
        .select()
        .from(lessons)
        .where(whereClause)
        .orderBy(desc(lessons.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(lessons)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count || 0;
    return c.json({ lessons: results, total, page, limit, totalPages: Math.ceil(total / limit) });
  })
  .get('/:id', async (c) => {
    const { id } = c.req.param();

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    const [lesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id));

    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    return c.json({ lesson });
  });
