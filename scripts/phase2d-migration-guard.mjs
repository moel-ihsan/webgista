import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const approvedHashes = new Map([
  ['20261104000300', '8e96c132b87491d8d9f503289779487ab5096222bf99da4705f5caaaa54c09df'],
  ['20261104000400', '2b7d2fd75db77009fcb6625b013fb7078c679740ac34a29629afa8577405f594'],
  ['20261105000100', 'cc3ee6456022f67c9169469bc5a15bab4505fb816b81d3766e52c22547d2381c'],
  ['20261105000200', 'e3ea8d7c5fc9f72ee45566bb4aadbddeab4a74133af29daf09fb4f5bfa101d99'],
  ['20261105000400', '3a53ae34079d7352f520fe8ee94e9420f3bf495cf8fff98c55e96289237465d3'],
  ['20261105000500', '374cecda12bd657cc4be45590b0bb07a98091501e9a8a6c959bc4c0772c4a982'],
  ['20261106000100', 'b3adb0e3fd76134a388c045b3a37b97b6d1acc335bfe37306c7c8223643c0f18'],
  ['20261106000200', '00b9c031eafd4c7dce5f94930c20fb3285df3bbb1a0955c1ddeb5f4c4217add6'],
]);

const approvedVersions = [...approvedHashes.keys()];
export const developmentWaiver003004 = 'accept-dev-data-loss-for-003-004';
export const developmentWaiver005 = 'accept-dev-data-loss-for-005';
export const developmentWaiver006 = 'accept-dev-data-loss-for-006';
export const developmentWaiver008 = 'accept-dev-data-loss-for-008';
export const developmentWaiver009 = 'accept-dev-data-loss-for-009';
export const developmentWaiver010 = 'accept-dev-data-loss-for-010';
export const developmentWaiver011 = 'accept-dev-data-loss-for-011';

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
  for (let index = 1; index < approvedVersions.length; index += 1) {
    if (remote.has(approvedVersions[index]) && !remote.has(approvedVersions[index - 1])) {
      throw new Error(`Migration history is inconsistent: ${approvedVersions[index]} is applied while ${approvedVersions[index - 1]} is not.`);
    }
  }
  const pendingStart = approvedVersions.indexOf(pending[0]);
  if (pending.length && (pendingStart < 0 || pending.join(',') !== approvedVersions.slice(pendingStart).join(','))) {
    throw new Error('Pending migrations are not a supported chronological suffix of the reviewed migration set.');
  }
  return pending;
}

export function validateDevelopmentBackupWaiver({ applyMigrations, waiver, githubRef, projectRef, expectedProjectRef, pendingVersions }) {
  verifyContext({ githubRef, projectRef, expectedProjectRef });
  if (applyMigrations !== 'apply' || ![developmentWaiver003004, developmentWaiver005, developmentWaiver006, developmentWaiver008, developmentWaiver009, developmentWaiver010, developmentWaiver011].includes(waiver)) {
    throw new Error('The one-time data-loss waiver is valid only for an explicit apply run.');
  }
  if (!Array.isArray(pendingVersions) || !pendingVersions.length) {
    throw new Error('The one-time waiver requires its exact approved pending migration set.');
  }
  const legacyVersions = approvedVersions.slice(0, 2);
  const allowed = waiver === developmentWaiver005
    ? pendingVersions.length === 1 && pendingVersions[0] === '20261105000100'
    : waiver === developmentWaiver006
      ? pendingVersions.length === 1 && pendingVersions[0] === '20261105000200'
      : waiver === developmentWaiver008
        ? pendingVersions.length === 1 && pendingVersions[0] === '20261105000400'
        : waiver === developmentWaiver009
          ? pendingVersions.length === 1 && pendingVersions[0] === '20261105000500'
          : waiver === developmentWaiver010
            ? pendingVersions.length === 1 && pendingVersions[0] === '20261106000100'
            : waiver === developmentWaiver011
              ? pendingVersions.length === 1 && pendingVersions[0] === '20261106000200'
            : pendingVersions.every((version) => legacyVersions.includes(version))
              && pendingVersions.join(',') === legacyVersions.slice(legacyVersions.indexOf(pendingVersions[0])).join(',');
  if (!allowed) {
    throw new Error('The selected one-time waiver does not match the exact approved pending migration set.');
  }
  return [...pendingVersions].sort();
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

export function assertPhase2eOnlyPending(pendingVersions) {
  if (pendingVersions.length !== 1 || pendingVersions[0] !== '20261105000100') {
    throw new Error('This deployment is authorized only for migration 20261105000100; refusing any other pending set.');
  }
}

export function assertPhase2eAclFixOnlyPending(pendingVersions) {
  if (pendingVersions.length !== 1 || pendingVersions[0] !== '20261105000200') {
    throw new Error('This deployment is authorized only for migration 20261105000200; refusing any other pending set.');
  }
}

export function assertPhase3dCctvCleanupOnlyPending(pendingVersions) {
  if (pendingVersions.length !== 1 || pendingVersions[0] !== '20261105000400') {
    throw new Error('This deployment is authorized only for CCTV image cleanup migration 20261105000400; refusing any other pending set.');
  }
}

export function assertPhase3d1CctvDeleteOnlyPending(pendingVersions) {
  if (pendingVersions.length !== 1 || pendingVersions[0] !== '20261105000500') {
    throw new Error('This deployment is authorized only for CCTV permanent-delete migration 20261105000500; refusing any other pending set.');
  }
}

export function assertPhase3eRoiDensityOnlyPending(pendingVersions) {
  if (pendingVersions.length !== 1 || pendingVersions[0] !== '20261106000100') {
    throw new Error('This deployment is authorized only for ROI density configuration migration 20261106000100; refusing any other pending set.');
  }
}

export function assertPhase3fRoiAnalysisOnlyPending(pendingVersions) {
  if (pendingVersions.length !== 1 || pendingVersions[0] !== '20261106000200') {
    throw new Error('This deployment is authorized only for ROI analysis migration 20261106000200; refusing any other pending set.');
  }
}

export function assertRecoveryAvailable(payload, now = Date.now()) {
  if (!Array.isArray(payload?.backups)) throw new Error('Supabase backup API returned an invalid response.');
  const available = payload.backups.filter((backup) =>
    backup?.status === 'COMPLETED' && Number.isFinite(Date.parse(backup.inserted_at)) && Date.parse(backup.inserted_at) <= now,
  );
  if (!available.length) throw new Error('No completed, available database backup was reported for recovery.');
  return available.length;
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
      console.log('All local migrations, including approved Phase 2D and 2E migrations, are present in remote history.');
    } else if (command === 'phase2e' && first) {
      const pending = await inspectHistory(first);
      assertPhase2eOnlyPending(pending);
      console.log('The only pending migration is the approved Phase 2E migration 20261105000100.');
    } else if (command === 'phase2e-acl-fix' && first) {
      const pending = await inspectHistory(first);
      assertPhase2eAclFixOnlyPending(pending);
      console.log('The only pending migration is the approved Phase 2E ACL fix 20261105000200.');
    } else if (command === 'phase3d-cctv-cleanup' && first) {
      const pending = await inspectHistory(first);
      assertPhase3dCctvCleanupOnlyPending(pending);
      console.log('The only pending migration is the approved CCTV image cleanup migration 20261105000400.');
    } else if (command === 'phase3d1-cctv-delete' && first) {
      const pending = await inspectHistory(first);
      assertPhase3d1CctvDeleteOnlyPending(pending);
      console.log('The only pending migration is the approved CCTV permanent-delete RPC migration 20261105000500.');
    } else if (command === 'phase3e-roi-density' && first) {
      const pending = await inspectHistory(first);
      if (pending.length) assertPhase3eRoiDensityOnlyPending(pending);
      console.log(pending.includes('20261106000100')
        ? 'The only pending migration is the ROI density configuration migration 20261106000100.'
        : 'ROI density configuration migration 20261106000100 is not pending.');
    } else if (command === 'phase3f-roi-analysis' && first) {
      const pending = await inspectHistory(first);
      assertPhase3fRoiAnalysisOnlyPending(pending);
      console.log('The only pending migration is ROI analysis results migration 20261106000200.');
    } else if (command === 'dry-run' && first && second) {
      const pending = await inspectHistory(first);
      const dryRun = await readFile(second, 'utf8');
      assertDryRunMatches(dryRun, pending);
      console.log(`Dry-run matches the approved migration set: ${pending.join(', ') || 'none'}`);
    } else if (command === 'backup' && first) {
      const count = assertRecoveryAvailable(JSON.parse(await readFile(first, 'utf8')));
      console.log(`Confirmed ${count} completed recovery backup(s); backup identifiers withheld.`);
    } else if (command === 'waiver' && first) {
      const pendingVersions = await inspectHistory(first);
      const waivedVersions = validateDevelopmentBackupWaiver({
        applyMigrations: process.env.APPLY_MIGRATIONS,
        waiver: process.env.DEVELOPMENT_DATA_LOSS_WAIVER,
        githubRef: process.env.GITHUB_REF,
        projectRef: process.env.SUPABASE_PROJECT_REF,
        expectedProjectRef: process.env.EXPECTED_DEV_PROJECT_REF,
        pendingVersions,
      });
      console.log(`Explicit development data-loss waiver accepted for approved pending migrations: ${waivedVersions.join(', ')}.`);
    } else {
      throw new Error('Usage: snapshot | history <migration-list-output> | applied <migration-list-output> | phase2e <migration-list-output> | phase2e-acl-fix <migration-list-output> | phase3d-cctv-cleanup <migration-list-output> | phase3d1-cctv-delete <migration-list-output> | phase3e-roi-density <migration-list-output> | phase3f-roi-analysis <migration-list-output> | dry-run <migration-list-output> <dry-run-output> | backup <backup-api-json> | waiver <migration-list-output>');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
