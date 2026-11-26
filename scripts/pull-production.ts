import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import postgres from 'postgres';

const localUrl = process.env.LOCAL_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
const productionUrl = process.env.PRODUCTION_DATABASE_URL;
if (!localUrl || !productionUrl) {
  throw new Error('Local database URL and PRODUCTION_DATABASE_URL are required');
}
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname)) {
  throw new Error('Destination must be a local database');
}
if (localUrl === productionUrl) throw new Error('Source and destination must differ');

const postgresBin = '/Applications/Postgres.app/Contents/Versions/18/bin';
const executable = (name: string) => existsSync(join(postgresBin, name)) ? join(postgresBin, name) : name;
const directory = await mkdtemp(join(tmpdir(), 'httlvn-production-pull-'));
await chmod(directory, 0o700);
const backup = join(directory, 'local-before-pull.dump');
const snapshot = join(directory, 'production-public.dump');

async function run(name: string, args: string[], url: string) {
  const connection = new URL(url);
  const child = Bun.spawn([executable(name), ...args], {
    env: {
      ...process.env,
      PGHOST: connection.hostname,
      PGPORT: connection.port || '5432',
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
      PGSSLMODE: connection.searchParams.get('sslmode') || 'prefer',
      PGCONNECT_TIMEOUT: '15',
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(`${name} failed with exit code ${code}`);
}

console.log('Saving local public schema and data backup...');
await run('pg_dump', ['--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--file', backup], localUrl);
console.log(`Local backup: ${backup}`);

console.log('Reading all production application tables and sequences...');
await run('pg_dump', ['--format=custom', '--data-only', '--schema=public', '--no-owner', '--no-privileges', '--file', snapshot], productionUrl);

console.log('Replacing local application tables in one transaction...');
const restoreFile = join(directory, 'restore.sql');
await run('pg_restore', ['--data-only', '--disable-triggers', '--no-owner', '--no-privileges', '--file', restoreFile, snapshot], localUrl);
const restoreSql = await Bun.file(restoreFile).text();
const production = postgres(productionUrl, { prepare: false, max: 1, connect_timeout: 15 });
let tableNames: string[];
try {
  const tables = await production<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  tableNames = tables.map((table) => 'public."' + table.tablename.replaceAll('"', '""') + '"');
} finally {
  await production.end();
}
if (tableNames.length === 0) throw new Error('Production contains no application tables');
await Bun.write(restoreFile, `TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY;\n` + restoreSql);
await run('psql', ['--no-psqlrc', '--quiet', '--single-transaction', '--set', 'ON_ERROR_STOP=1', '--file', restoreFile], localUrl);
await rm(snapshot);
await rm(restoreFile);
console.log(`Committed production data for ${tableNames.length} application tables to local.`);
console.log(`Previous local data retained at: ${backup}`);
