const BASE_URL = import.meta.env.VITE_API_URL || ''

export const USE_API = Boolean(BASE_URL)

let _token = null

export function setAuthToken(token) {
  _token = token
}

async function request(method, path, body, withAuth = true) {
  if (!BASE_URL) return null

  const headers = { 'Content-Type': 'application/json' }
  if (withAuth && _token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => ({ error: res.statusText }))

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`)
    err.status = res.status
    throw err
  }

  return data
}

// Authenticated API — all admin/internal calls
export const api = {
  get:    (path)        => request('GET',    path, undefined, true),
  post:   (path, body)  => request('POST',   path, body,      true),
  put:    (path, body)  => request('PUT',    path, body,      true),
  delete: (path)        => request('DELETE', path, undefined, true),
}

// Unauthenticated API — public pages (careers, application form)
export const publicApi = {
  get:  (path)       => request('GET',  path, undefined, false),
  post: (path, body) => request('POST', path, body,      false),
}
