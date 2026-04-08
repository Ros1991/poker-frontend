import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { HomeGame } from '../types/homeGame.types'
import * as homeGamesApi from '../api/homeGames.api'
import { useAuth } from '../hooks/useAuth'

export interface HomeGameContextValue {
  homeGames: HomeGame[]
  selectedHomeGame: HomeGame | null
  isLoading: boolean
  selectHomeGame: (homeGame: HomeGame | null) => void
  refreshHomeGames: () => Promise<void>
}

const HomeGameContext = createContext<HomeGameContextValue | null>(null)

interface HomeGameProviderProps {
  children: ReactNode
}

export function HomeGameProvider({ children }: HomeGameProviderProps) {
  const { isAuthenticated, user } = useAuth()
  const [homeGames, setHomeGames] = useState<HomeGame[]>([])
  const [selectedHomeGame, setSelectedHomeGame] = useState<HomeGame | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadHomeGames = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setHomeGames([])
      setSelectedHomeGame(null)
      return
    }

    setIsLoading(true)
    try {
      const data = await homeGamesApi.getAll()
      setHomeGames(data)
      // Se só tem 1 HomeGame, seleciona automaticamente
      if (data.length === 1) {
        setSelectedHomeGame(data[0])
      } else {
        setSelectedHomeGame(null)
      }
    } catch {
      setHomeGames([])
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    void loadHomeGames()
  }, [loadHomeGames])

  const selectHomeGame = useCallback((homeGame: HomeGame | null) => {
    setSelectedHomeGame(homeGame)
  }, [])

  const value = useMemo<HomeGameContextValue>(
    () => ({
      homeGames,
      selectedHomeGame,
      isLoading,
      selectHomeGame,
      refreshHomeGames: loadHomeGames,
    }),
    [homeGames, selectedHomeGame, isLoading, selectHomeGame, loadHomeGames],
  )

  return (
    <HomeGameContext.Provider value={value}>
      {children}
    </HomeGameContext.Provider>
  )
}

export function useHomeGame(): HomeGameContextValue {
  const context = useContext(HomeGameContext)
  if (!context) {
    throw new Error('useHomeGame deve ser usado dentro de um HomeGameProvider')
  }
  return context
}
