import { useContext } from 'react'
import { UIContext } from '@/context/UIContext'
export const useUI = () => useContext(UIContext)
