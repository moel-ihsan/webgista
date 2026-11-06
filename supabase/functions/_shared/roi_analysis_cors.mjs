const productionOrigin = 'https://webgista-v2.vercel.app'
const localOrigins = new Set(['http://localhost:5173', 'http://localhost:5174'])

export function roiAnalysisCorsHeaders(origin) {
  const allowedOrigin = origin === null
    ? productionOrigin
    : origin === productionOrigin || localOrigins.has(origin)
      ? origin
      : null

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
