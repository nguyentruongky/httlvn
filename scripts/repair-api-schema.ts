import postgres from 'postgres';
import { removeVietnameseDiacritics } from '../src/lib/vietnamese';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DIRECT_URL or DATABASE_URL');
}

const client = postgres(connectionString, { prepare: false, max: 1 });

try {
  await client.begin(async (sql) => {
    await sql`ALTER TABLE pastors ADD COLUMN IF NOT EXISTS search_text text`;
    await sql.unsafe(await Bun.file(new URL('../drizzle/0003_clear_the_order.sql', import.meta.url)).text());

    const pastors = await sql<{ id: number; full_name: string; phone: string | null }[]>`
      SELECT id, full_name, phone FROM pastors WHERE search_text IS NULL
    `;
    for (const pastor of pastors) {
      const searchText = removeVietnameseDiacritics(
        `${pastor.full_name} ${pastor.phone ?? ''}`,
      ).toLowerCase();
      await sql`UPDATE pastors SET search_text = ${searchText} WHERE id = ${pastor.id}`;
    }
  });
  console.log('API schema repaired: pastor search column and lessons table are available.');
} finally {
  await client.end();
}
