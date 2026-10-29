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

/**
 * Home game selecionado por padrão (SPEC-20261029-1723): o principal da própria conta — no Mesa e no Clube é o único
 * dela, e é nele que ficam os torneios, estruturas e jogadores; sem principal na lista (conta antiga), o único home game
 * da lista; senão nenhum.
 */
function defaultHomeGame(list: HomeGame[], userId: string): HomeGame | null {
  return list.find((hg) => hg.isPrimary && hg.ownerId === userId) ?? (list.length === 1 ? list[0] : null)
}

interface HomeGameProviderProps {
  children: ReactNode
}

export function HomeGameProvider({ children }: HomeGameProviderProps) {
  const { isAuthenticated, user } = useAuth()
  const [homeGames, setHomeGames] = useState<HomeGame[]>([])
  const [selectedHomeGame, setSelectedHomeGame] = useState<HomeGame | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const userId = user?.id
  const loadHomeGames = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setHomeGames([])
      setSelectedHomeGame(null)
      return
    }

    setIsLoading(true)
    try {
      const data = await homeGamesApi.getAll()
      setHomeGames(data)
      // O ativo continua o mesmo se ainda existe (com os dados novos); se ele foi excluído (SPEC-20261026-1126) ou
      // nunca houve um, vale o principal da conta (SPEC-20261029-1723), o único home game da lista — ou nenhum
      setSelectedHomeGame((current) => {
        const kept = current ? data.find((hg) => hg.id === current.id) : undefined
        if (kept) return kept
        return defaultHomeGame(data, userId)
      })
    } catch {
      setHomeGames([])
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, userId])

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
