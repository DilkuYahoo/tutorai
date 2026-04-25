const BASE_URL = import.meta.env.VITE_API_URL || ''

export const USE_API = Boolean(BASE_URL)

async function request(path) {
  if (!BASE_URL) return null
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }))
    const err = new Error(data.error || `Request failed: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const api = {
  getDistributions: () => request('/distributions'),
  getMetrics: (params) => request(`/logs/metrics?${new URLSearchParams(params)}`),
  getGeo: (params) => request(`/logs/geo?${new URLSearchParams(params)}`),
}
