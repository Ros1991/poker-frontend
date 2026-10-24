import { useContext } from 'react'
import { HomeGameContext } from '../contexts/homeGameContextValue'
import type { HomeGameContextValue } from '../contexts/homeGameContextValue'

export function useHomeGame(): HomeGameContextValue {
  const context = useContext(HomeGameContext)
  if (!context) {
    throw new Error('useHomeGame deve ser usado dentro de um HomeGameProvider')
  }
  return context
}
