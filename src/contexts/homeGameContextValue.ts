import { createContext } from 'react'
import type { HomeGame } from '../types/homeGame.types'

// Contexto do home game ativo, separado do HomeGameProvider (HomeGameContext.tsx) para o arquivo
// do provider só exportar componente (react-refresh/only-export-components). Leia com `useHomeGame`.

export interface HomeGameContextValue {
  homeGames: HomeGame[]
  selectedHomeGame: HomeGame | null
  isLoading: boolean
  selectHomeGame: (homeGame: HomeGame | null) => void
  refreshHomeGames: () => Promise<void>
}

export const HomeGameContext = createContext<HomeGameContextValue | null>(null)
