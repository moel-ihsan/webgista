import { describe, expect, it, vi } from 'vitest'

import {
  canManageCctvLocation,
  createCctvLocation,
  deleteCctvLocation,
  listCctvAgencies,
  listCctvLocations,
  pageCctvLocations,
  searchCctvLocations,
  sortCctvLocations,
  setCctvLocationActive,
  updateCctvLocation,
  validateCctvLocationInput,
} from './cctvManagement'
import type { CctvLocationInput, CctvManagementLocation } from './cctvManagement'

const camera = {
  id: 'camera-1', name: 'Simpang Lima', address: 'Banda Aceh', category: 'regular', agency_id: 'agency-1',
  longitude: '95.323800', latitude: '5.548300', is_active: true, is_public: false, updated_at: '2026-11-04T00:00:00Z',
  snapshot_path: null,
  agency: { id: 'agency-1', name: 'Dishub' },
}
const input: CctvLocationInput = {
  name: 'Simpang Lima', address: 'Banda Aceh', category: 'regular', agencyId: 'agency-1', longitude: 95.3238, latitude: 5.5483,
}

function clientMock(response: { data: unknown; error: { code?: string; constraint?: string; details?: string } | null }) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => unknown)> = {}
  for (const method of ['select', 'order', 'eq', 'in', 'abortSignal', 'insert', 'update', 'delete']) {
    query[method] = vi.fn().mockReturnValue(query)
  }
  query.maybeSingle = vi.fn().mockResolvedValue(response)
  query.then = (
    resolve: (value: typeof response) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject)
  const from = vi.fn().mockReturnValue(query)
  return { client: { from } as never, from, query }
}

describe('CCTV management data access', () => {
  it('selects only management metadata and maps safe camera records', async () => {
    const mock = clientMock({ data: [camera], error: null })
    await expect(listCctvLocations(mock.client)).resolves.toMatchObject([{
      id: 'camera-1', agencyName: 'Dishub', longitude: 95.3238, latitude: 5.5483, isPublic: false,
    }])
    expect(mock.from).toHaveBeenCalledWith('cctv_locations')
    expect(mock.query.select).toHaveBeenCalledWith(
      'id,name,address,category,agency_id,longitude,latitude,is_active,is_public,snapshot_path,updated_at,agency:agencies(id,name)',
    )
  })

  it('handles an empty list and reports generic query errors', async () => {
    await expect(listCctvLocations(clientMock({ data: [], error: null }).client)).resolves.toEqual([])
    await expect(listCctvLocations(clientMock({ data: null, error: { code: 'XX000' } }).client))
      .rejects.toThrow('CCTV list failed. Please try again.')
  })

  it('rejects malformed coordinates and missing required database fields', async () => {
    const mock = clientMock({ data: [{ ...camera, longitude: 181 }, { ...camera, id: null }], error: null })
    await expect(listCctvLocations(mock.client)).resolves.toEqual([])
  })

  it('filters agency choices to trusted editor memberships and allows admins to load RLS-visible agencies', async () => {
    const editor = clientMock({ data: [{ id: 'agency-1', name: 'Dishub', is_public: false }], error: null })
    await listCctvAgencies(editor.client, 'agency_editor', ['agency-1'])
    expect(editor.query.select).toHaveBeenCalledWith('id,name,is_public')
    expect(editor.query.in).toHaveBeenCalledWith('id', ['agency-1'])
    const admin = clientMock({ data: [{ id: 'agency-1', name: 'Dishub', is_public: false }], error: null })
    await listCctvAgencies(admin.client, 'administrator', [])
    expect(admin.query.in).not.toHaveBeenCalled()
  })

  it('creates only the permitted metadata and treats a zero-row result as no change', async () => {
    const mock = clientMock({ data: { id: 'camera-1' }, error: null })
    await expect(createCctvLocation(mock.client, input)).resolves.toBe('camera-1')
    expect(mock.query.insert).toHaveBeenCalledWith({
      name: input.name, address: input.address, category: input.category, agency_id: input.agencyId,
      longitude: input.longitude, latitude: input.latitude,
    })
    const noRows = clientMock({ data: null, error: null })
    await expect(createCctvLocation(noRows.client, input)).resolves.toBeNull()
  })

  it('targets update, status and delete by the requested camera id', async () => {
    const update = clientMock({ data: { id: 'camera-1' }, error: null })
    await expect(updateCctvLocation(update.client, 'camera-1', input)).resolves.toBe(true)
    expect(update.query.eq).toHaveBeenCalledWith('id', 'camera-1')
    const status = clientMock({ data: { id: 'camera-1' }, error: null })
    await setCctvLocationActive(status.client, 'camera-1', false)
    expect(status.query.update).toHaveBeenCalledWith({ is_active: false })
    const deletion = clientMock({ data: null, error: null })
    await expect(deleteCctvLocation(deletion.client, 'camera-1')).resolves.toBe(false)
    expect(deletion.query.eq).toHaveBeenCalledWith('id', 'camera-1')
  })

  it('validates coordinates, lengths and agency assignment and mirrors the agency role scope', () => {
    expect(validateCctvLocationInput(input, ['agency-1'])).toBeNull()
    expect(validateCctvLocationInput({ ...input, longitude: Number.NaN }, ['agency-1'])).toContain('longitude')
    expect(validateCctvLocationInput({ ...input, latitude: 91 }, ['agency-1'])).toContain('latitude')
    expect(validateCctvLocationInput({ ...input, agencyId: 'agency-2' }, ['agency-1'])).toContain('authorized')
    expect(validateCctvLocationInput({ ...input, name: ' ' }, ['agency-1'])).toContain('Name')
    expect(validateCctvLocationInput({ ...input, address: 'x'.repeat(501) }, ['agency-1'])).toContain('Address')
    expect(canManageCctvLocation('agency_editor', ['agency-1'], { agencyId: 'agency-1' })).toBe(true)
    expect(canManageCctvLocation('agency_editor', ['agency-1'], { agencyId: 'agency-2' })).toBe(false)
    expect(canManageCctvLocation('administrator', [], { agencyId: 'agency-2' })).toBe(true)
  })

  it('searches case-insensitively across authorized display fields and pages results', () => {
    const rows: CctvManagementLocation[] = [
      { id: 'one', name: 'Simpang Lima', address: 'Banda Aceh', agencyId: 'agency-1', agencyName: 'Dishub', category: 'regular', longitude: 95.3, latitude: 5.5, isActive: true, isPublic: false, snapshotPath: null, updatedAt: '2026-11-04T00:00:00Z' },
      { id: 'two', name: 'Ulee Kareng', address: 'Banda Aceh', agencyId: 'agency-2', agencyName: 'Police', category: 'analytic', longitude: 95.31, latitude: 5.51, isActive: false, isPublic: true, snapshotPath: null, updatedAt: '2026-11-04T00:00:00Z' },
    ]
    expect(searchCctvLocations(rows, 'DISHUB').map(({ id }) => id)).toEqual(['one'])
    expect(searchCctvLocations(rows, 'kareng').map(({ id }) => id)).toEqual(['two'])
    expect(pageCctvLocations(rows, 2, 1).map(({ id }) => id)).toEqual(['two'])
    expect(sortCctvLocations(rows, 'name', 'ascending').map(({ id }) => id)).toEqual(['one', 'two'])
    expect(sortCctvLocations(rows, 'coordinate', 'descending').map(({ id }) => id)).toEqual(['two', 'one'])
  })

  it('does not expose database details in permission or foreign-key errors', async () => {
    await expect(deleteCctvLocation(clientMock({ data: null, error: { code: '23503', constraint: 'traffic_observations_cctv_id_fkey' } }).client, 'camera-1'))
      .rejects.toThrow('traffic observation history')
    await expect(deleteCctvLocation(clientMock({ data: null, error: { code: '23503', details: 'Key is still referenced from table traffic_observations' } }).client, 'camera-1'))
      .rejects.toThrow('Deactivate it to preserve those records.')
    await expect(deleteCctvLocation(clientMock({ data: null, error: { code: '42501' } }).client, 'camera-1'))
      .rejects.toThrow('not authorized')
  })
})
