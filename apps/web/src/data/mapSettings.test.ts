import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAP_VIEWPORT, loadMapViewport, saveMapViewport, validateMapViewport } from './mapSettings'

function clientMock(response: { data: unknown; error: { code?: string } | null }) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => unknown)> = {}
  for (const method of ['select', 'eq', 'abortSignal', 'upsert']) query[method] = vi.fn().mockReturnValue(query)
  query.maybeSingle = vi.fn().mockResolvedValue(response)
  query.single = vi.fn().mockResolvedValue(response)
  query.then = (resolve: (value: typeof response) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(response).then(resolve, reject)
  const from = vi.fn().mockReturnValue(query)
  return { client: { from } as never, from, query }
}

describe('application map settings', () => {
  it('uses the Banda Aceh fallback when no global setting is saved', async () => {
    await expect(loadMapViewport(clientMock({ data: null, error: null }).client)).resolves.toBeNull()
    expect(DEFAULT_MAP_VIEWPORT).toEqual({ latitude: 5.5483, longitude: 95.3238, zoom: 11.2 })
  })

  it('loads the singleton application viewport', async () => {
    const mock = clientMock({ data: { latitude: '5.559729', longitude: '95.330911', zoom: '13' }, error: null })
    await expect(loadMapViewport(mock.client)).resolves.toEqual({ latitude: 5.559729, longitude: 95.330911, zoom: 13 })
    expect(mock.from).toHaveBeenCalledWith('app_map_settings')
    expect(mock.query.eq).toHaveBeenCalledWith('id', 1)
  })

  it('validates coordinates and the MapLibre supported zoom range', () => {
    expect(validateMapViewport({ latitude: 5.5, longitude: 95.3, zoom: 13 })).toBeNull()
    expect(validateMapViewport({ latitude: 90.1, longitude: 95.3, zoom: 13 })).toContain('Latitude')
    expect(validateMapViewport({ latitude: 5.5, longitude: -181, zoom: 13 })).toContain('Longitude')
    expect(validateMapViewport({ latitude: 5.5, longitude: 95.3, zoom: 19 })).toContain('Zoom')
  })

  it('saves the singleton using the validated values and confirms the returned row', async () => {
    const viewport = { latitude: 5.559729, longitude: 95.330911, zoom: 13 }
    const mock = clientMock({ data: viewport, error: null })
    await expect(saveMapViewport(mock.client, viewport)).resolves.toEqual(viewport)
    expect(mock.query.upsert).toHaveBeenCalledWith({ id: 1, ...viewport }, { onConflict: 'id' })
    await expect(saveMapViewport(mock.client, { ...viewport, zoom: 99 })).rejects.toThrow('Zoom')
  })

  it('does not disguise database and permission failures', async () => {
    await expect(loadMapViewport(clientMock({ data: null, error: { code: '42P01' } }).client)).rejects.toThrow('could not be loaded')
    await expect(saveMapViewport(clientMock({ data: null, error: { code: '42501' } }).client, DEFAULT_MAP_VIEWPORT)).rejects.toThrow('Only an administrator')
  })
})
