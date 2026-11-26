import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema';

async function refactorChurches() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL');
    process.exit(1);
  }

  const client = postgres(connectionString, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  console.log('🔄 Starting church table refactor...');

  // 1. Create church_branches table
  console.log('📋 Creating church_branches table...');
  await client`
    CREATE TABLE IF NOT EXISTS church_branches (
      id SERIAL PRIMARY KEY,
      parent_church_id INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      child_church_id INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      branch_name TEXT, -- name of the branch (e.g., "Xuân Thới Thượng")
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS church_branches_parent_idx ON church_branches(parent_church_id)`;
  await client`CREATE INDEX IF NOT EXISTS church_branches_child_idx ON church_branches(child_church_id)`;
  await client`CREATE UNIQUE INDEX IF NOT EXISTS church_branches_unique ON church_branches(parent_church_id, child_church_id)`;

  // 2. Add province column to churches
  console.log('📋 Adding province column...');
  await client`ALTER TABLE churches ADD COLUMN IF NOT EXISTS province TEXT`;

  // 3. Update province = 'TP. HCM' where region_id is not null
  console.log('📋 Updating province...');
  await client`UPDATE churches SET province = 'TP. HCM' WHERE region_id IS NOT NULL`;

  // 4. Extract parent from name for churches that don't have parent_church_id but name has (...)
  console.log('📋 Extracting parent from name...');
  const churches = await db.select().from(schema.churches);
  
  for (const church of churches) {
    // Skip if already has parent_church_id
    if (church.parentChurchId) continue;

    // Extract parent from name like "Xuân Thới Thượng (Trương Minh Giảng)"
    const match = church.name.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (match) {
      const cleanName = match[1].trim();
      const parentName = match[2].trim();

      // Find parent church by short_name or name
      const parent = await db
        .select()
        .from(schema.churches)
        .where(
          sql`upper(short_name) = upper(${parentName}) OR upper(name) = upper(${parentName})`
        )
        .limit(1);

      if (parent.length > 0) {
        // Update child: clean name, set parent_church_id
        await db
          .update(schema.churches)
          .set({ name: cleanName, parentChurchId: parent[0].id })
          .where(eq(schema.churches.id, church.id));

        // Create branch record
        await client`
          INSERT INTO church_branches (parent_church_id, child_church_id, branch_name)
          VALUES (${parent[0].id}, ${church.id}, ${cleanName})
          ON CONFLICT (parent_church_id, child_church_id) DO NOTHING
        `;
        console.log(`  ✓ ${church.name} → ${cleanName} (parent: ${parent[0].shortName})`);
      }
    }
  }

  // 5. Also create branch records for existing parent_church_id relationships
  console.log('📋 Creating branch records for existing relationships...');
  const existingRelationships = await db
    .select()
    .from(schema.churches)
    .where(sql`parent_church_id IS NOT NULL`);

  for (const church of existingRelationships) {
    await client`
      INSERT INTO church_branches (parent_church_id, child_church_id, branch_name)
      VALUES (${church.parentChurchId}, ${church.id}, ${church.name})
      ON CONFLICT (parent_church_id, child_church_id) DO NOTHING
    `;
  }

  // 6. Remove columns: short_name, parent_church_name, parent_church_id, is_in_hcm, ward_id, old_district, old_ward, old_address
  console.log('📋 Dropping old columns...');
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS short_name`;
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS parent_church_name`;
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS parent_church_id`;
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS is_in_hcm`;
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS ward_id`;
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS old_district`;
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS old_ward`;
  await client`ALTER TABLE churches DROP COLUMN IF EXISTS old_address`;

  console.log('✅ Church refactor completed!');

  // Verify
  const verify = await client`SELECT COUNT(*) as total FROM churches`;
  const branches = await client`SELECT COUNT(*) as total FROM church_branches`;
  console.log(`Churches: ${verify[0].total}, Branches: ${branches[0].total}`);

  await client.end();
}

refactorChurches().catch((err) => {
  console.error('❌ Refactor failed:', err);
  process.exit(1);
});