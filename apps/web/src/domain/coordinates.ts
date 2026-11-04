export function parseCoordinate(value: string): number | null {
  const normalized = value.trim()
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(normalized)) return null
  const coordinate = Number(normalized.replace(',', '.'))
  return Number.isFinite(coordinate) ? coordinate : null
}
