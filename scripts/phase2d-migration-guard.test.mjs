import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  approvedHashes,
  assessMigrationHistory,
  assertDryRunMatches,
  parseMigrationList,
  verifyContext,
  verifyMigrationHashes,
} from './phase2d-migration-guard.mjs';

const versions = ['20261103000100', '20261103000200', '20261104000100', '20261104000200', ...approvedHashes.keys()];
const listing = (localVersions, remoteVersions) => [
  'LOCAL          │ REMOTE         │ TIME (UTC)',
  '───────────────┼────────────────┼──────────────────────',
  ...Array.from({ length: Math.max(localVersions.length, remoteVersions.length) }, (_, index) =>
    `${localVersions[index] ?? ''} │ ${remoteVersions[index] ?? ''} │ ${remoteVersions[index] ? '2026-11-04 10:00:00' : ''}`),
].join('\n');

test('accepts the protected branch and configured 20-character development reference only', () => {
  assert.doesNotThrow(() => verifyContext({
    githubRef: 'refs/heads/feat/webgista-v2', projectRef: 'abcdefghijklmnopqrst', expectedProjectRef: 'abcdefghijklmnopqrst',
  }));
  assert.throws(() => verifyContext({ githubRef: 'refs/heads/main', projectRef: 'abcdefghijklmnopqrst', expectedProjectRef: 'abcdefghijklmnopqrst' }), /restricted/);
  assert.throws(() => verifyContext({ githubRef: 'refs/heads/feat/webgista-v2', projectRef: 'abcdefghijklmnopqrst', expectedProjectRef: 'ponmlkjihgfedcbaqrst' }), /target/);
});

test('migration hashes match the exact CI-approved files', async () => {
  await verifyMigrationHashes(path.resolve('supabase/migrations'));
  const temp = await mkdtemp(path.join(os.tmpdir(), 'webgista-migration-guard-'));
  try {
    await writeFile(path.join(temp, '20261104000300_profile.sql'), 'alter table profiles;');
    await assert.rejects(verifyMigrationHashes(temp), /SHA-256/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('rejects a migration 004 hash mismatch', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'webgista-migration-guard-'));
  try {
    const expected = new Map([['20261104000400', '0'.repeat(64)]]);
    await writeFile(path.join(temp, '20261104000400_settings.sql'), 'create table settings;');
    await assert.rejects(verifyMigrationHashes(temp, expected), /SHA-256/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('parses complete migration-list output and fails closed for inspection errors or unknown formats', () => {
  const parsed = parseMigrationList(listing(versions, versions.slice(0, 4)));
  assert.deepEqual(parsed.local, versions);
  assert.deepEqual(parsed.remote, versions.slice(0, 4));
  assert.deepEqual(parseMigrationList(`Target: custom Postgres (db.example.invalid:5432)\n${listing(versions, versions.slice(0, 4))}`), parsed);
  assert.throws(() => parseMigrationList('connection refused'), /Could not parse/);
  assert.throws(() => parseMigrationList(`warning\n${listing(versions, versions.slice(0, 4))}`), /Unexpected text/);
  assert.throws(() => parseMigrationList(listing(versions, versions.slice(0, 4)).replace('20261103000100', 'broken')), /Invalid local/);
});

test('accepts only chronological pending subsets of the two reviewed migrations', () => {
  assert.deepEqual(assessMigrationHistory({ localVersions: versions, remoteVersions: versions.slice(0, 4) }), ['20261104000300', '20261104000400']);
  assert.deepEqual(assessMigrationHistory({ localVersions: versions, remoteVersions: versions.slice(0, 5) }), ['20261104000400']);
  assert.deepEqual(assessMigrationHistory({ localVersions: versions, remoteVersions: versions }), []);
  assert.throws(() => assessMigrationHistory({ localVersions: [...versions, '20261105000100'], remoteVersions: versions.slice(0, 4) }), /Unapproved pending/);
  assert.throws(() => assessMigrationHistory({ localVersions: versions, remoteVersions: [...versions.slice(0, 5), '20261105000100'] }), /absent locally/);
  assert.throws(() => assessMigrationHistory({ localVersions: versions, remoteVersions: [...versions.slice(0, 4), '20261104000400'] }), /inconsistent/);
});

test('requires the dry-run migration set to exactly match the reviewed pending set', () => {
  assert.doesNotThrow(() => assertDryRunMatches('Would push these migrations:\n • 20261104000300\n • 20261104000400', approvedHashes.keys()));
  assert.throws(() => assertDryRunMatches('Would push these migrations:\n • 20261104000300\n • 20261104000400\n • 20261105000100', approvedHashes.keys()), /differs/);
  assert.doesNotThrow(() => assertDryRunMatches('Remote database is up to date.', []));
  assert.throws(() => assertDryRunMatches('No migration IDs returned', []), /did not confirm/);
  assert.throws(() => assertDryRunMatches('Would push these migrations:\n • 20261104000400', ['20261104000300', '20261104000400']), /differs/);
});
