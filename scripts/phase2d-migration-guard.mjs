import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const approvedHashes = new Map([
  ['20261104000300', '8e96c132b87491d8d9f503289779487ab5096222bf99da4705f5caaaa54c09df'],
  ['20261104000400', '2b7d2fd75db77009fcb6625b013fb7078c679740ac34a29629afa8577405f594'],
]);

const approvedVersions = [...approvedHashes.keys()];

export function verifyContext({ githubRef, projectRef, expectedProjectRef }) {
  if (githubRef !== 'refs/heads/feat/webgista-v2') throw new Error('Deployment is restricted to feat/webgista-v2.');
  if (!expectedProjectRef || projectRef !== expectedProjectRef || !/^[a-z]{20}$/.test(projectRef ?? '')) {
    throw new Error('Supabase target does not match the configured webgista-dev project reference.');
  }
}

export async function readLocalMigrations(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const versions = [];
  for (const file of files) {
    const match = /^(\d{14})_[a-z0-9_-]+\.sql$/i.exec(file);
    if (!match) throw new Error(`Unexpected migration filename: ${file}`);
    versions.push(match[1]);
  }
  if (new Set(versions).size !== versions.length) throw new Error('Duplicate local migration versions found.');
  return versions;
}

export async function verifyMigrationHashes(directory, expected = approvedHashes) {
  for (const [version, expectedHash] of expected) {
    const names = (await readdir(directory)).filter((file) => file.startsWith(`${version}_`) && file.endsWith('.sql'));
    if (names.length !== 1) throw new Error(`Expected exactly one migration file for ${version}.`);
    const body = await readFile(path.join(directory, names[0]));
    const actual = createHash('sha256').update(body).digest('hex');
    if (actual !== expectedHash) throw new Error(`Migration ${version} SHA-256 does not match the CI-verified file.`);
  }
}

export function parseMigrationList(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const lines = clean.split(/\r?\n/);
  const header = lines.findIndex((line) =>
    line.split(/[│|]/).map((cell) => cell.trim().toLowerCase()).join('|') === 'local|remote|time (utc)',
  );
  if (header < 0) throw new Error('Could not parse the Supabase migration-list table; refusing deployment.');
  if (lines.slice(0, header).some((line) => line.trim() && !/^Target: custom Postgres \(.+:\d+\)$/.test(line.trim()))) {
    throw new Error('Unexpected text before the migration-list table; refusing deployment.');
  }

  const local = [];
  const remote = [];
  for (const line of lines.slice(header + 1)) {
    const trimmed = line.trim();
    if (!trimmed || /^[─┼├┤┬┴|\-\s]+$/u.test(trimmed)) continue;
    const cells = line.split(/[│|]/);
    if (cells.length !== 3) throw new Error('Unexpected Supabase migration-list output; refusing deployment.');
    const [localVersion, remoteVersion] = cells.slice(0, 2).map((cell) => cell.trim().replace(/^`(.*)`$/, '$1').trim());
    if (!localVersion && !remoteVersion) throw new Error('Empty migration row in Supabase output; refusing deployment.');
    for (const [side, version] of [['local', localVersion], ['remote', remoteVersion]]) {
      if (version && !/^\d{14}$/.test(version)) throw new Error(`Invalid ${side} migration version in Supabase output.`);
    }
    if (localVersion) local.push(localVersion);
    if (remoteVersion) remote.push(remoteVersion);
  }
  if (!local.length && !remote.length) throw new Error('Supabase returned no migration rows; refusing deployment.');
  if (new Set(local).size !== local.length || new Set(remote).size !== remote.length) {
    throw new Error('Duplicate migration versions in Supabase output; refusing deployment.');
  }
  return { local, remote };
}

export function assessMigrationHistory({ localVersions, remoteVersions }) {
  const local = new Set(localVersions);
  const remote = new Set(remoteVersions);
  if (local.size !== localVersions.length || remote.size !== remoteVersions.length) throw new Error('Duplicate migration versions found.');
  const missingLocal = [...remote].filter((version) => !local.has(version));
  if (missingLocal.length) throw new Error(`Remote migration history contains versions absent locally: ${missingLocal.join(', ')}.`);

  const pending = localVersions.filter((version) => !remote.has(version));
  const unexpected = pending.filter((version) => !approvedVersions.includes(version));
  if (unexpected.length) throw new Error(`Unapproved pending migrations: ${unexpected.join(', ')}.`);
  if (remote.has('20261104000400') && !remote.has('20261104000300')) {
    throw new Error('Migration history is inconsistent: 004 is applied while 003 is not.');
  }
  if (pending.length > 2 || (pending.length === 2 && pending.join(',') !== approvedVersions.join(','))) {
    throw new Error('Pending migrations are not a supported chronological subset of 003 and 004.');
  }
  return pending;
}

export function assertDryRunMatches(output, pendingVersions) {
  const migrationList = output.match(/Would push these migrations:\s*\r?\n([\s\S]*?)(?:\r?\nFinished supabase db push\.|$)/i);
  const proposed = [];
  if (migrationList) {
    for (const line of migrationList[1].split(/\r?\n/).filter((value) => value.trim())) {
      const match = /^\s*[•*-]\s*(\d{14})_[a-z0-9_-]+\.sql\s*$/i.exec(line);
      if (!match) throw new Error('Unexpected migration entry in Supabase dry-run; refusing deployment.');
      proposed.push(match[1]);
    }
  }
  const expected = [...pendingVersions].sort();
  if (new Set(proposed).size !== proposed.length) throw new Error('Duplicate migrations in Supabase dry-run; refusing deployment.');
  if (!expected.length && (!/\b(?:up to date|no pending migrations)\b/i.test(output) || proposed.length)) {
    throw new Error('Dry-run did not confirm that the remote database is up to date.');
  }
  if (JSON.stringify(proposed) !== JSON.stringify(expected)) {
    throw new Error(`Dry-run migration set differs from approved pending set (expected ${expected.join(', ') || 'none'}; saw ${proposed.join(', ') || 'none'}).`);
  }
}

async function inspectHistory(file) {
  const directory = path.resolve('supabase/migrations');
  await verifyMigrationHashes(directory);
  const localVersions = await readLocalMigrations(directory);
  const parsed = parseMigrationList(await readFile(file, 'utf8'));
  if (JSON.stringify([...parsed.local].sort()) !== JSON.stringify([...localVersions].sort())) {
    throw new Error('Remote inspection did not report the complete local migration set.');
  }
  return assessMigrationHistory({ localVersions, remoteVersions: parsed.remote });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, first, second] = process.argv.slice(2);
  try {
    if (command === 'snapshot') {
      verifyContext({
        githubRef: process.env.GITHUB_REF,
        projectRef: process.env.SUPABASE_PROJECT_REF,
        expectedProjectRef: process.env.EXPECTED_DEV_PROJECT_REF,
      });
      await verifyMigrationHashes(path.resolve('supabase/migrations'));
      console.log('Authorized branch, webgista-dev target, and CI-verified migration hashes confirmed.');
    } else if (command === 'history' && first) {
      const pending = await inspectHistory(first);
      console.log(`Approved pending migrations: ${pending.join(', ') || 'none'}`);
    } else if (command === 'applied' && first) {
      const pending = await inspectHistory(first);
      if (pending.length) throw new Error(`Migrations remain unapplied after deployment: ${pending.join(', ')}.`);
      console.log('All local migrations, including 003 and 004, are present in remote history.');
    } else if (command === 'dry-run' && first && second) {
      const pending = await inspectHistory(first);
      const dryRun = await readFile(second, 'utf8');
      assertDryRunMatches(dryRun, pending);
      console.log(`Dry-run matches the approved migration set: ${pending.join(', ') || 'none'}`);
    } else {
      throw new Error('Usage: snapshot | history <migration-list-output> | applied <migration-list-output> | dry-run <migration-list-output> <dry-run-output>');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
