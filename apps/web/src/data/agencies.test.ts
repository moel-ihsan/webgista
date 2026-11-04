import { describe, expect, it, vi } from 'vitest'

import { createAgency, deleteAgency, listAgencies } from './agencies'

function clientMock(response: { data: unknown; error: { code?: string } | null }) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => unknown)> = {}
  for (const method of ['select', 'order', 'in', 'insert', 'delete', 'eq']) query[method] = vi.fn().mockReturnValue(query)
  query.single = vi.fn().mockResolvedValue(response)
  query.maybeSingle = vi.fn().mockResolvedValue(response)
  query.then = (resolve: (value: typeof response) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(response).then(resolve, reject)
  const from = vi.fn().mockReturnValue(query)
  return { client: { from } as never, from, query }
}

describe('agency data access', () => {
  it('loads authorized agencies from the database and scopes editors to their memberships', async () => {
    const mock = clientMock({ data: [{ id: 'agency-1', name: 'Dishub', is_public: false }], error: null })
    await expect(listAgencies(mock.client, 'agency_editor', ['agency-1'])).resolves.toEqual([{ id: 'agency-1', name: 'Dishub', isPublic: false }])
    expect(mock.from).toHaveBeenCalledWith('agencies')
    expect(mock.query.select).toHaveBeenCalledWith('id,name,is_public')
    expect(mock.query.in).toHaveBeenCalledWith('id', ['agency-1'])
    await expect(listAgencies(mock.client, 'agency_editor', [])).resolves.toEqual([])
  })

  it('creates only a validated name and relies on the database private default', async () => {
    const mock = clientMock({ data: { id: 'agency-1', name: 'Testing Agency', is_public: false }, error: null })
    await expect(createAgency(mock.client, ' Testing Agency ')).resolves.toMatchObject({ isPublic: false })
    expect(mock.query.insert).toHaveBeenCalledWith({ name: 'Testing Agency' })
    await expect(createAgency(mock.client, ' ')).rejects.toThrow('between 2 and 120')
    await expect(createAgency(clientMock({ data: null, error: { code: '23505' } }).client, 'Testing Agency')).rejects.toThrow('already exists')
  })

  it('reports FK and RLS protected agency removals without claiming a change', async () => {
    await expect(deleteAgency(clientMock({ data: { id: 'agency-1' }, error: null }).client, 'agency-1')).resolves.toBe(true)
    await expect(deleteAgency(clientMock({ data: null, error: { code: '23503' } }).client, 'agency-1')).rejects.toThrow('still referenced')
    await expect(deleteAgency(clientMock({ data: null, error: { code: '42501' } }).client, 'agency-1')).rejects.toThrow('Only an administrator')
  })
})
