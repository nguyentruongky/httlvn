import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { lessons } from '../src/db/schema';

const localUrl = process.env.LOCAL_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
const productionUrl = process.env.PRODUCTION_DATABASE_URL;

if (!localUrl || !productionUrl) {
  throw new Error('Local database URL and PRODUCTION_DATABASE_URL are required');
}
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname)) {
  throw new Error('The lessons source must be a local database');
}
if (localUrl === productionUrl) {
  throw new Error('Source and destination must be different databases');
}

const localClient = postgres(localUrl, { prepare: false, max: 1, connect_timeout: 15 });
const productionClient = postgres(productionUrl, { prepare: false, max: 1, connect_timeout: 15 });

try {
  const source = drizzle(localClient);
  const destination = drizzle(productionClient);
  const rows = await source.select().from(lessons);
  console.log(`Copying ${rows.length} local lessons to production...`);

  await destination.transaction(async (tx) => {
    for (let offset = 0; offset < rows.length; offset += 100) {
      await tx.insert(lessons).values(rows.slice(offset, offset + 100)).onConflictDoUpdate({
        target: lessons.id,
        set: {
          title: sql`excluded.title`,
          content: sql`excluded.content`,
          sourceUrl: sql`excluded.source_url`,
          tags: sql`excluded.tags`,
          questions: sql`excluded.questions`,
          contact: sql`excluded.contact`,
          searchText: sql`excluded.search_text`,
          createdAt: sql`excluded.created_at`,
        },
      });
      console.log(`Copied ${Math.min(offset + 100, rows.length)}/${rows.length} lessons (awaiting commit)`);
    }
  });

  console.log(`Committed ${rows.length} lessons to production.`);
} finally {
  await Promise.all([localClient.end(), productionClient.end()]);
}
