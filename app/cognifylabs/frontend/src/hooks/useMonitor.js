import { useContext } from 'react'
import { MonitorContext } from '@/context/MonitorContext'
export const useMonitor = () => useContext(MonitorContext)
