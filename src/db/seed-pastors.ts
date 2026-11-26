import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import pastorsData from '../../pastors.json';

async function seedPastors() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL or DIRECT_URL in .env');
    process.exit(1);
  }

  console.log('🌱 Connecting to PostgreSQL and seeding pastors...');
  const client = postgres(connectionString, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  // Clear existing data
  console.log('🗑️  Clearing existing pastors and assignments...');
  await db.delete(schema.pastoralAssignments);
  await db.delete(schema.pastorNhuDanh);
  await db.delete(schema.pastors);

  const pastors = pastorsData as Array<{
    full_name: string;
    title: string;
    phone: string | null;
    status: string;
    email: string | null;
    chuc_vu: string | null;
    nam_sinh: number | null;
    ten_nhiem_so: string | null;
    dia_chi: string | null;
    region_id: number | null;
    search_text: string;
  }>;

  // Filter out invalid entries
  const validPastors = pastors.filter(p => p.full_name && p.full_name.trim() !== '');
  console.log(`📊 Total: ${pastors.length}, Valid: ${validPastors.length}`);

  let inserted = 0;
  for (const pastor of validPastors) {
    const [insertedPastor] = await db
      .insert(schema.pastors)
      .values({
        fullName: pastor.full_name,
        title: pastor.title,
        phone: pastor.phone,
        status: pastor.status,
        email: pastor.email,
        chucVu: pastor.chuc_vu,
        namSih: pastor.nam_sinh,
        tenNhiemSo: pastor.ten_nhiem_so,
        diaChi: pastor.dia_chi,
        regionId: pastor.region_id,
        searchText: pastor.search_text,
      })
      .returning();
    inserted++;
  }

  console.log(`✅ Seeded ${inserted} pastors`);
  await client.end();
}

seedPastors().catch((err) => {
  console.error('❌ Seed pastors failed:', err);
  process.exit(1);
});