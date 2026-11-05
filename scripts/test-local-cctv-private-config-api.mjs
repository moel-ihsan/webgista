import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

function localEnvironment() {
  const output = execFileSync('supabase', ['status', '--output', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  const apiUrl = values.API_URL ?? values.SUPABASE_URL;
  const anonKey = values.ANON_KEY ?? values.SUPABASE_ANON_KEY;
  const serviceKey = values.SERVICE_ROLE_KEY ?? values.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(apiUrl && anonKey && serviceKey, 'Supabase local status must provide API URL and local API keys.');
  return { apiUrl: apiUrl.replace(/\/$/, ''), anonKey, serviceKey };
}

async function request(apiUrl, path, { apiKey, token = apiKey, method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, data };
}

async function storageRequest(apiUrl, path, { apiKey, token = apiKey, method = 'GET', body, contentType } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      ...(contentType ? { 'Content-Type': contentType } : body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: contentType ? body : JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.text() };
}

function requireSuccess(result, label) {
  assert.ok(result.status >= 200 && result.status < 300, `${label} failed (HTTP ${result.status}, ${result.data?.code ?? 'no database code'}).`);
  return result.data;
}

function deniedByRls(result, label) {
  assert.ok([401, 403, 400].includes(result.status), `${label} unexpectedly succeeded (HTTP ${result.status}).`);
  assert.equal(result.data?.code, '42501', `${label} must be rejected by PostgreSQL privileges or RLS.`);
}

async function createUser(apiUrl, serviceKey, anonKey, marker) {
  const email = `ci-${marker}-${randomUUID()}@example.test`;
  const password = `C1-${randomUUID()}-Aa!`;
  const created = requireSuccess(await request(apiUrl, '/auth/v1/admin/users', {
    apiKey: serviceKey,
    body: { email, password, email_confirm: true },
    method: 'POST',
  }), `${marker} QA auth user creation`);
  const userId = created.id ?? created.user?.id;
  assert.match(userId ?? '', /^[0-9a-f-]{36}$/i, `${marker} QA auth response has no UUID id.`);
  const session = requireSuccess(await request(apiUrl, '/auth/v1/token?grant_type=password', {
    apiKey: anonKey,
    body: { email, password },
    method: 'POST',
  }), `${marker} QA user sign-in`);
  assert.ok(session.access_token, `${marker} QA sign-in response omitted an access token.`);
  return { email, userId, accessToken: session.access_token };
}

function runLocalSql(sql) {
  execFileSync('supabase', ['db', 'query', sql, '--yes', '--local'], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function sqlText(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function cleanupFixtures(cameras, agencies, users, imagePaths, apiUrl, anonKey, adminToken) {
  if (adminToken) {
    for (const imagePath of imagePaths) {
      const result = await storageRequest(apiUrl, '/storage/v1/object/cctv-images', {
        apiKey: anonKey,
        token: adminToken,
        method: 'DELETE',
        body: { prefixes: [imagePath] },
      });
      assert.ok(result.status >= 200 && result.status < 300, `local QA media cleanup failed (HTTP ${result.status}).`);
    }
  }
  const ids = (values) => values.length
    ? values.map((value) => {
      assert.match(value, /^[0-9a-f-]{36}$/i);
      return `'${value}'::uuid`;
    }).join(', ')
    : 'NULL::uuid';
  for (const sql of [
    `delete from public.cctv_locations where id in (${ids(cameras)})`,
    `delete from auth.users where id in (${ids(users.map(({ userId }) => userId))})`,
    `delete from public.agencies where id in (${ids(agencies)})`,
  ]) {
    execFileSync('supabase', ['db', 'query', sql, '--yes', '--local'], { stdio: ['ignore', 'ignore', 'pipe'] });
  }
}

const { apiUrl, anonKey, serviceKey } = localEnvironment();
const marker = randomUUID();
const users = [];
const agencies = [];
const cameras = [];
const imagePaths = [];
let adminAccessToken;

try {
  const administrator = await createUser(apiUrl, serviceKey, anonKey, 'administrator');
  adminAccessToken = administrator.accessToken;
  users.push(administrator);
  const editor = await createUser(apiUrl, serviceKey, anonKey, 'editor');
  users.push(editor);

  runLocalSql(`insert into public.user_roles (user_id, role) values
    ('${administrator.userId}'::uuid, 'administrator'),
    ('${editor.userId}'::uuid, 'agency_editor')`);

  const agencyA = randomUUID();
  agencies.push(agencyA);
  const agencyB = randomUUID();
  agencies.push(agencyB);
  runLocalSql(`insert into public.agencies (id, name, is_public) values
    ('${agencyA}'::uuid, ${sqlText(`CI Private Config A ${marker}`)}, false),
    ('${agencyB}'::uuid, ${sqlText(`CI Private Config B ${marker}`)}, false)`);
  runLocalSql(`insert into public.agency_memberships (agency_id, user_id) values ('${agencyA}'::uuid, '${editor.userId}'::uuid)`);

  const adminCamera = randomUUID();
  cameras.push(adminCamera);
  const editorCamera = randomUUID();
  cameras.push(editorCamera);
  const foreignCamera = randomUUID();
  cameras.push(foreignCamera);
  runLocalSql(`insert into public.cctv_locations (id, agency_id, name, address, category, longitude, latitude, is_active, is_public) values
    ('${adminCamera}'::uuid, '${agencyA}'::uuid, ${sqlText(`Admin camera ${marker}`)}, ${sqlText(`Disposable CI fixture ${marker}`)}, 'regular', 95.33, 5.55, false, false),
    ('${editorCamera}'::uuid, '${agencyA}'::uuid, ${sqlText(`Editor camera ${marker}`)}, ${sqlText(`Disposable CI fixture ${marker}`)}, 'regular', 95.33, 5.55, false, false),
    ('${foreignCamera}'::uuid, '${agencyB}'::uuid, ${sqlText(`Foreign camera ${marker}`)}, ${sqlText(`Disposable CI fixture ${marker}`)}, 'regular', 95.33, 5.55, false, false)`);
  runLocalSql(`insert into public.cctv_private_config (cctv_id, source_kind, source_uri, notes)
    values ('${foreignCamera}'::uuid, 'stored_clip', '/ci/foreign.mp4', 'disposable CI fixture')`);

  const adminInsert = requireSuccess(await request(apiUrl, '/rest/v1/cctv_private_config', {
    apiKey: anonKey,
    token: administrator.accessToken,
    body: { cctv_id: adminCamera, source_kind: 'stored_clip', source_uri: '/ci/admin.mp4', notes: 'disposable CI fixture' },
    method: 'POST',
    prefer: 'return=representation',
  }), 'authenticated administrator insert using only granted columns');
  assert.equal(adminInsert[0]?.created_by, administrator.userId, 'actor trigger must set the authenticated creator.');

  const adminUpdate = requireSuccess(await request(apiUrl, `/rest/v1/cctv_private_config?cctv_id=eq.${adminCamera}`, {
    apiKey: anonKey,
    token: administrator.accessToken,
    body: { source_uri: '/ci/admin-updated.mp4' },
    method: 'PATCH',
    prefer: 'return=representation',
  }), 'authenticated administrator update');
  assert.equal(adminUpdate[0]?.source_uri, '/ci/admin-updated.mp4');

  const forgedActor = await request(apiUrl, '/rest/v1/cctv_private_config', {
    apiKey: anonKey,
    token: administrator.accessToken,
    body: { cctv_id: editorCamera, source_kind: 'stored_clip', source_uri: '/ci/forged.mp4', created_by: editor.userId },
    method: 'POST',
  });
  deniedByRls(forgedActor, 'forged created_by Data API insert');

  const forgedTimestamp = await request(apiUrl, '/rest/v1/cctv_private_config', {
    apiKey: anonKey,
    token: administrator.accessToken,
    body: { cctv_id: editorCamera, source_kind: 'stored_clip', source_uri: '/ci/forged-time.mp4', created_at: '2000-01-01T00:00:00Z' },
    method: 'POST',
  });
  deniedByRls(forgedTimestamp, 'server-managed timestamp Data API insert');

  const editorInsert = requireSuccess(await request(apiUrl, '/rest/v1/cctv_private_config', {
    apiKey: anonKey,
    token: editor.accessToken,
    body: { cctv_id: editorCamera, source_kind: 'stored_clip', source_uri: '/ci/editor.mp4', notes: 'disposable CI fixture' },
    method: 'POST',
    prefer: 'return=representation',
  }), 'authorized agency editor insert');
  assert.equal(editorInsert[0]?.created_by, editor.userId, 'editor actor trigger must set the authenticated creator.');

  const editorUpdate = requireSuccess(await request(apiUrl, `/rest/v1/cctv_private_config?cctv_id=eq.${editorCamera}`, {
    apiKey: anonKey,
    token: editor.accessToken,
    body: { source_uri: '/ci/editor-updated.mp4' },
    method: 'PATCH',
    prefer: 'return=representation',
  }), 'authorized agency editor update');
  assert.equal(editorUpdate[0]?.source_uri, '/ci/editor-updated.mp4');

  const editorCrossInsert = await request(apiUrl, '/rest/v1/cctv_private_config', {
    apiKey: anonKey,
    token: editor.accessToken,
    body: { cctv_id: foreignCamera, source_kind: 'stored_clip', source_uri: '/ci/cross-agency.mp4' },
    method: 'POST',
  });
  deniedByRls(editorCrossInsert, 'cross-agency editor insert');

  const editorCrossUpdate = await request(apiUrl, `/rest/v1/cctv_private_config?cctv_id=eq.${foreignCamera}`, {
    apiKey: anonKey,
    token: editor.accessToken,
    body: { source_uri: '/ci/cross-agency-update.mp4' },
    method: 'PATCH',
    prefer: 'return=representation',
  });
  requireSuccess(editorCrossUpdate, 'cross-agency editor update response');
  assert.deepEqual(editorCrossUpdate.data, [], 'cross-agency update must affect zero rows.');

  const editorReadsOwn = requireSuccess(await request(apiUrl, `/rest/v1/cctv_private_config?select=cctv_id&cctv_id=in.(${editorCamera},${foreignCamera})`, {
    apiKey: anonKey,
    token: editor.accessToken,
  }), 'agency editor private-config read');
  assert.deepEqual(editorReadsOwn.map((row) => row.cctv_id), [editorCamera]);

  const anonymousInsert = await request(apiUrl, '/rest/v1/cctv_private_config', {
    apiKey: anonKey,
    body: { cctv_id: adminCamera, source_kind: 'stored_clip', source_uri: '/ci/anonymous.mp4' },
    method: 'POST',
  });
  deniedByRls(anonymousInsert, 'anonymous private-config insert');

  const anonymousRead = await request(apiUrl, `/rest/v1/cctv_private_config?select=cctv_id&cctv_id=eq.${adminCamera}`, {
    apiKey: anonKey,
  });
  deniedByRls(anonymousRead, 'anonymous private-config read');

  const imagePath = `${foreignCamera}/phase3d-orphan-cleanup.webp`;
  imagePaths.push(imagePath);
  const uploaded = await storageRequest(apiUrl, `/storage/v1/object/cctv-images/${imagePath}`, {
    apiKey: anonKey,
    token: administrator.accessToken,
    method: 'POST',
    contentType: 'image/webp',
    body: new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]),
  });
  assert.ok(uploaded.status >= 200 && uploaded.status < 300, `administrator camera-image upload failed (HTTP ${uploaded.status}).`);

  const privateImage = await storageRequest(apiUrl, `/storage/v1/object/authenticated/cctv-images/${imagePath}`, { apiKey: anonKey });
  assert.ok(privateImage.status >= 400, 'anonymous user cannot read a private CCTV image');
  const unrelatedEditorImage = await storageRequest(apiUrl, `/storage/v1/object/authenticated/cctv-images/${imagePath}`, {
    apiKey: anonKey,
    token: editor.accessToken,
  });
  assert.ok(unrelatedEditorImage.status >= 400, 'unrelated agency editor cannot read another agency image');

  const editorCameraDelete = await request(apiUrl, `/rest/v1/cctv_locations?id=eq.${foreignCamera}`, {
    apiKey: anonKey,
    token: editor.accessToken,
    method: 'DELETE',
    prefer: 'return=representation',
  });
  assert.ok(
    [400, 403].includes(editorCameraDelete.status)
      || (editorCameraDelete.status === 200 && editorCameraDelete.data?.length === 0),
    'unrelated agency editor cannot delete another agency camera',
  );

  const cameraDelete = await request(apiUrl, `/rest/v1/cctv_locations?id=eq.${foreignCamera}`, {
    apiKey: anonKey,
    token: administrator.accessToken,
    method: 'DELETE',
    prefer: 'return=representation',
  });
  requireSuccess(cameraDelete, 'administrator deletion of dependency-free CCTV QA fixture');
  assert.equal(cameraDelete.data?.[0]?.id, foreignCamera, 'administrator removes the requested QA camera');

  const editorOrphanDelete = await storageRequest(apiUrl, '/storage/v1/object/cctv-images', {
    apiKey: anonKey,
    token: editor.accessToken,
    method: 'DELETE',
    body: { prefixes: [imagePath] },
  });
  assert.ok([400, 403, 404].includes(editorOrphanDelete.status), 'agency editor cannot delete an orphaned camera image');
  const anonymousOrphanRead = await storageRequest(apiUrl, `/storage/v1/object/authenticated/cctv-images/${imagePath}`, { apiKey: anonKey });
  assert.ok(anonymousOrphanRead.status >= 400, 'anonymous user cannot read an orphaned private camera image');
  const adminOrphanRead = await storageRequest(apiUrl, `/storage/v1/object/authenticated/cctv-images/${imagePath}`, {
    apiKey: anonKey,
    token: administrator.accessToken,
  });
  assert.equal(adminOrphanRead.status, 200, 'administrator can read an orphan image for cleanup');
  const adminOrphanDelete = await storageRequest(apiUrl, '/storage/v1/object/cctv-images', {
    apiKey: anonKey,
    token: administrator.accessToken,
    method: 'DELETE',
    body: { prefixes: [imagePath] },
  });
  assert.ok(adminOrphanDelete.status >= 200 && adminOrphanDelete.status < 300, `administrator orphan cleanup failed (HTTP ${adminOrphanDelete.status}).`);
  imagePaths.splice(imagePaths.indexOf(imagePath), 1);

  console.log('Local Data API checks passed: private-config least privilege, cross-agency denials, admin-only CCTV image orphan cleanup, and safe camera deletion.');
} finally {
  await cleanupFixtures(cameras, agencies, users, imagePaths, apiUrl, anonKey, adminAccessToken);
}
