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
  assert.ok(userId, `${marker} QA auth user response omitted its id.`);
  const session = requireSuccess(await request(apiUrl, '/auth/v1/token?grant_type=password', {
    apiKey: anonKey,
    body: { email, password },
    method: 'POST',
  }), `${marker} QA user sign-in`);
  assert.ok(session.access_token, `${marker} QA sign-in response omitted an access token.`);
  return { email, userId, accessToken: session.access_token };
}

async function insertRow(apiUrl, serviceKey, table, body) {
  const data = requireSuccess(await request(apiUrl, `/rest/v1/${table}`, {
    apiKey: serviceKey,
    body,
    method: 'POST',
    prefer: 'return=representation',
  }), `disposable ${table} fixture creation`);
  assert.ok(Array.isArray(data) && data[0], `disposable ${table} fixture response was empty.`);
  return data[0];
}

function cleanupFixtures(cameras, agencies, users) {
  const ids = (values) => values.length
    ? values.map((value) => {
      assert.match(value, /^[0-9a-f-]{36}$/i);
      return `'${value}'::uuid`;
    }).join(', ')
    : 'NULL::uuid';
  for (const sql of [
    `delete from public.cctv_locations where id in (${ids(cameras)})`,
    `delete from public.agencies where id in (${ids(agencies)})`,
    `delete from auth.users where id in (${ids(users.map(({ userId }) => userId))})`,
  ]) {
    execFileSync('supabase', ['db', 'query', sql, '--yes', '--local'], { stdio: ['ignore', 'ignore', 'pipe'] });
  }
}

const { apiUrl, anonKey, serviceKey } = localEnvironment();
const marker = randomUUID();
const users = [];
const agencies = [];
const cameras = [];

try {
  const administrator = await createUser(apiUrl, serviceKey, anonKey, 'administrator');
  users.push(administrator);
  const editor = await createUser(apiUrl, serviceKey, anonKey, 'editor');
  users.push(editor);

  await insertRow(apiUrl, serviceKey, 'user_roles', [
    { user_id: administrator.userId, role: 'administrator' },
    { user_id: editor.userId, role: 'agency_editor' },
  ]);

  const agencyA = await insertRow(apiUrl, serviceKey, 'agencies', {
    name: `CI Private Config A ${marker}`,
    is_public: false,
  });
  agencies.push(agencyA.id);
  const agencyB = await insertRow(apiUrl, serviceKey, 'agencies', {
    name: `CI Private Config B ${marker}`,
    is_public: false,
  });
  agencies.push(agencyB.id);

  requireSuccess(await request(apiUrl, '/rest/v1/agency_memberships', {
    apiKey: serviceKey,
    body: { agency_id: agencyA.id, user_id: editor.userId },
    method: 'POST',
  }), 'disposable editor membership creation');

  const createCamera = async (agencyId, name) => {
    const row = await insertRow(apiUrl, serviceKey, 'cctv_locations', {
      agency_id: agencyId,
      name: `${name} ${marker}`,
      address: `Disposable CI fixture ${marker}`,
      category: 'regular',
      longitude: 95.33,
      latitude: 5.55,
      is_active: false,
      is_public: false,
    });
    cameras.push(row.id);
    return row.id;
  };

  const adminCamera = await createCamera(agencyA.id, 'Admin camera');
  const editorCamera = await createCamera(agencyA.id, 'Editor camera');
  const foreignCamera = await createCamera(agencyB.id, 'Foreign camera');

  const foreignConfig = requireSuccess(await request(apiUrl, '/rest/v1/cctv_private_config', {
    apiKey: serviceKey,
    body: { cctv_id: foreignCamera, source_kind: 'stored_clip', source_uri: '/ci/foreign.mp4', notes: 'disposable CI fixture' },
    method: 'POST',
  }), 'disposable foreign config fixture creation');
  assert.equal(foreignConfig, null);

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

  console.log('PostgREST private-config API checks passed: column-scoped admin/editor writes, actor trigger, cross-agency and anonymous denials.');
} finally {
  cleanupFixtures(cameras, agencies, users);
}
