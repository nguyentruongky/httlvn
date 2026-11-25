import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import lessonsData from '../../lessons.json';
import { removeVietnameseDiacritics } from '../lib/vietnamese';

async function seedLessons() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL or DIRECT_URL in .env');
    process.exit(1);
  }

  console.log('🌱 Connecting to PostgreSQL and seeding lessons...');
  const client = postgres(connectionString, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  const lessons = lessonsData as Array<{
    id: string;
    title: string;
    content: string;
    source_url: string;
    tags: string[];
    questions: string;
    contact: string;
  }>;

  let inserted = 0;
  for (const lesson of lessons) {
    const searchText = removeVietnameseDiacritics(
      `${lesson.title} ${lesson.questions} ${lesson.tags.join(' ')}`
    ).toLowerCase();

    await db
      .insert(schema.lessons)
      .values({
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        sourceUrl: lesson.source_url,
        tags: lesson.tags,
        questions: lesson.questions,
        contact: lesson.contact,
        searchText,
      })
      .onConflictDoUpdate({
        target: schema.lessons.id,
        set: {
          title: lesson.title,
          content: lesson.content,
          sourceUrl: lesson.source_url,
          tags: lesson.tags,
          questions: lesson.questions,
          contact: lesson.contact,
          searchText,
        },
      });
    inserted++;
  }

  console.log(`✅ Seeded ${inserted} lessons`);
  await client.end();
}

seedLessons().catch((err) => {
  console.error('❌ Seed lessons failed:', err);
  process.exit(1);
});
