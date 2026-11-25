import postgres from 'postgres';
import { execSync } from 'child_process';

const LOCAL_URL = "postgresql://postgres:@localhost:5432/app_local_db";
const PROD_URL = process.env.PRODUCTION_DATABASE_URL!;

if (!PROD_URL) {
  console.error("PRODUCTION_DATABASE_URL not set in environment");
  process.exit(1);
}

const TABLES_IN_ORDER = [
  'regions',
  'departments',
  'organizations',
  'administrative_wards',
  'pastors',
  'churches',
  'church_departments',
  'church_personnel',
  'pastoral_assignments',
  'pastor_nhu_danh',
  'assembly_delegates',
];

async function truncateAll(sqlProd: any) {
  await sqlProd.unsafe('SET session_replication_role = \'replica\';');
  for (const table of TABLES_IN_ORDER.reverse()) {
    await sqlProd.unsafe(
      'TRUNCATE TABLE public.' + table + ' RESTART IDENTITY CASCADE;'
    );
  }
  await sqlProd.unsafe('SET session_replication_role = \'origin\';');
  console.log('✓ All production tables truncated');
}

async function copyTable(tableName: string, sqlLocal: any, sqlProd: any) {
  const rows: Record<string, unknown>[] = await sqlLocal.unsafe(
    'SELECT * FROM public.' + tableName + ';'
  );

  if (rows.length === 0) {
    console.log('  ⚠ ' + tableName + ': 0 rows (skipped)');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.join(', ');
  const batchSize = 100;

  console.log('  → ' + tableName + ': ' + rows.length + ' rows to copy');

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const allValues: unknown[] = [];
    const valuePlaceholders: string[] = [];

    for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
      const row = batch[rowIdx];
      const rowPlaceholders: string[] = [];
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const paramIdx = rowIdx * columns.length + colIdx + 1;
        rowPlaceholders.push('$' + paramIdx);
      }
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        allValues.push(row[columns[colIdx]]);
      }
      valuePlaceholders.push('(' + rowPlaceholders.join(', ') + ')');
    }

    const insertSql =
      'INSERT INTO public.' +
      tableName +
      ' (' +
      colList +
      ') VALUES ' +
      valuePlaceholders.join(', ') +
      ';';
    await sqlProd.unsafe(insertSql, allValues);
  }

  console.log('  ✓ ' + tableName + ': ' + rows.length + ' rows');
}

async function main() {
  console.log('🚀 Starting seed: LOCAL → PRODUCTION\n');
  console.log('  Local:  app_local_db\n');
  console.log(
    '  Prod:   ' + PROD_URL.split('@')[1]?.split('/')[0] + '\n'
  );

  try {
    // Step 1: Push schema to production using drizzle-kit
    console.log('📋 Pushing schema to production...');
    try {
      execSync(
        "printf 'Yes\n' | bunx drizzle-kit push --force --dialect postgresql --schema ./src/db/schema.ts --url '" + PROD_URL + "'",
        { stdio: 'inherit', cwd: process.cwd() }
      );
      console.log('✓ Schema pushed\n');
    } catch (err) {
      console.error('❌ Schema push failed:', err);
      process.exit(1);
    }

    // Step 2: Connect and seed data
    const sqlLocal = postgres(LOCAL_URL, { max: 3 });
    const sqlProd = postgres(PROD_URL, { max: 3 });

    try {
      await truncateAll(sqlProd);

      for (const table of TABLES_IN_ORDER) {
        await copyTable(table, sqlLocal, sqlProd);
      }

      console.log('\n✅ Seed complete!');
    } finally {
      await sqlLocal.end();
      await sqlProd.end();
    }
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

main();
