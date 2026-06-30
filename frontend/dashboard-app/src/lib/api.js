// Base URL: same-origin in production (FastAPI serves frontend),
// localhost:8000 in dev (Vite proxies /valuation etc. to FastAPI).
// Since Vite proxy handles path forwarding, we use relative paths.
const BASE = ''

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch (_) {}
    const e = new Error(`API ${res.status}: ${detail}`)
    e.status = res.status
    throw e
  }
  return res.json()
}

export const API = {
  health: () => req('/health'),

  valuationOptions: (filters = {}) => {
    const q = new URLSearchParams(filters).toString()
    return req('/valuation/options' + (q ? '?' + q : ''))
  },
  valuationRoads: (filters = {}) => {
    const clean = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v != null && v !== '')
    )
    const q = new URLSearchParams(clean).toString()
    return req('/valuation/roads' + (q ? '?' + q : ''))
  },
  valuationPredict: (payload) =>
    req('/valuation/predict', { method: 'POST', body: JSON.stringify(payload) }),

  hcrCurrent: () => req('/hcr/current'),
  hcrPredict: (payload) =>
    req('/hcr/predict', { method: 'POST', body: JSON.stringify(payload) }),

  dataQuery: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString()
    return req('/data/query' + (q ? '?' + q : ''))
  },

  rentComps: (params, { forceRefresh = false } = {}) => {
    const clean = typeof params === 'string'
      ? { mukim: params }
      : Object.fromEntries(
          Object.entries(params).filter(([, v]) => v != null && v !== '')
        )
    if (forceRefresh) clean.force_refresh = 'true'
    return req('/rent-comps?' + new URLSearchParams(clean))
  },
}
