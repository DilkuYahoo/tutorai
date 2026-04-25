import { createContext, useReducer, useCallback, useEffect, useRef } from 'react'
import { api, USE_API } from '@/services/api'
import { MOCK_DISTRIBUTIONS, MOCK_METRICS, MOCK_GEO } from '@/data/mockData'
import { subHours, subDays, formatISO } from 'date-fns'

export const MonitorContext = createContext(null)

const PRESETS = {
  '24h': () => ({ from: formatISO(subHours(new Date(), 24)), to: formatISO(new Date()) }),
  '7d':  () => ({ from: formatISO(subDays(new Date(), 7)),   to: formatISO(new Date()) }),
  '30d': () => ({ from: formatISO(subDays(new Date(), 30)),  to: formatISO(new Date()) }),
}

const initialState = {
  distributions: [],
  selectedDistId: 'all',
  preset: '24h',
  from: PRESETS['24h']().from,
  to:   PRESETS['24h']().to,
  metrics: null,
  geo: null,
  loading: false,
  error: null,
  lastRefreshed: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_DISTRIBUTIONS': return { ...state, distributions: action.payload }
    case 'SET_DIST':          return { ...state, selectedDistId: action.payload }
    case 'SET_PRESET': {
      const range = PRESETS[action.payload]?.()
      return { ...state, preset: action.payload, ...(range || {}) }
    }
    case 'SET_RANGE':  return { ...state, preset: 'custom', from: action.from, to: action.to }
    case 'FETCH_START':   return { ...state, loading: true, error: null }
    case 'FETCH_SUCCESS': return {
      ...state, loading: false,
      metrics: action.metrics,
      geo: action.geo,
      lastRefreshed: new Date(),
    }
    case 'FETCH_ERROR': return { ...state, loading: false, error: action.error }
    default: return state
  }
}

export function MonitorProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const timerRef = useRef(null)

  const loadDistributions = useCallback(async () => {
    if (!USE_API) {
      dispatch({ type: 'SET_DISTRIBUTIONS', payload: MOCK_DISTRIBUTIONS })
      return
    }
    try {
      const data = await api.getDistributions()
      dispatch({ type: 'SET_DISTRIBUTIONS', payload: data.distributions })
    } catch {
      dispatch({ type: 'SET_DISTRIBUTIONS', payload: MOCK_DISTRIBUTIONS })
    }
  }, [])

  const fetchData = useCallback(async (distId, from, to) => {
    dispatch({ type: 'FETCH_START' })
    if (!USE_API) {
      await new Promise(r => setTimeout(r, 400))
      dispatch({ type: 'FETCH_SUCCESS', metrics: MOCK_METRICS, geo: MOCK_GEO })
      return
    }
    try {
      const params = { distributionId: distId, from, to }
      const [metrics, geo] = await Promise.all([
        api.getMetrics(params),
        api.getGeo(params),
      ])
      dispatch({ type: 'FETCH_SUCCESS', metrics, geo })
    } catch (e) {
      dispatch({ type: 'FETCH_ERROR', error: e.message })
    }
  }, [])

  // Initial load + whenever filters change
  useEffect(() => {
    fetchData(state.selectedDistId, state.from, state.to)
  }, [state.selectedDistId, state.from, state.to, fetchData])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const range = PRESETS[state.preset]?.() ?? { from: state.from, to: state.to }
      fetchData(state.selectedDistId, range.from, range.to)
    }, 60_000)
    return () => clearInterval(timerRef.current)
  }, [state.selectedDistId, state.preset, state.from, state.to, fetchData])

  useEffect(() => { loadDistributions() }, [loadDistributions])

  return (
    <MonitorContext.Provider value={{
      ...state,
      setDist:   (id)          => dispatch({ type: 'SET_DIST', payload: id }),
      setPreset: (p)           => dispatch({ type: 'SET_PRESET', payload: p }),
      setRange:  (from, to)    => dispatch({ type: 'SET_RANGE', from, to }),
      refresh:   ()            => fetchData(state.selectedDistId, state.from, state.to),
    }}>
      {children}
    </MonitorContext.Provider>
  )
}
