import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { HomeGame } from '../types/homeGame.types'
import * as homeGamesApi from '../api/homeGames.api'
import { useAuth } from '../hooks/useAuth'
import { HomeGameContext } from './homeGameContextValue'
import type { HomeGameContextValue } from './homeGameContextValue'

// O contexto mora em homeGameContextValue.ts e o hook em hooks/useHomeGame.ts: este arquivo só
// exporta o provider (react-refresh/only-export-components).

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
      // O ativo continua o mesmo se ainda existe (com os dados novos); se ele foi excluído (SPEC-20261026-1126) ou
      // nunca houve um, vale o único home game da lista — ou nenhum
      setSelectedHomeGame((current) => {
        const kept = current ? data.find((hg) => hg.id === current.id) : undefined
        if (kept) return kept
        return data.length === 1 ? data[0] : null
      })
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
