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

/**
 * O home game selecionado fica guardado neste navegador, por conta (SPEC-20261029-1724): quem troca no seletor do
 * cabeçalho (Liga, ou quem é membro do clube de outra pessoa) volta para ele ao recarregar ou abrir o painel de novo.
 * Sem armazenamento (aba anônima, bloqueado), vale o padrão.
 */
const storageKey = (userId: string) => `poker_selected_home_game:${userId}`

function readStoredId(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

function storeId(userId: string, id: string | null) {
  try {
    if (id) localStorage.setItem(storageKey(userId), id)
    else localStorage.removeItem(storageKey(userId))
  } catch {
    // sem armazenamento: a escolha vale só nesta aba
  }
}

interface HomeGameProviderProps {
  children: ReactNode
}

export function HomeGameProvider({ children }: HomeGameProviderProps) {
  const { isAuthenticated, user } = useAuth()
  const [homeGames, setHomeGames] = useState<HomeGame[]>([])
  const [selectedHomeGame, setSelectedHomeGame] = useState<HomeGame | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  // Conta cuja lista já carregou ao menos uma vez (com sucesso ou não). Até lá `isLoading` é true: quem decide pelo
  // home game selecionado (o `/players` aberto direto, por exemplo) espera a primeira carga em vez de cair no Início —
  // inclusive no render logo depois do login, antes de o efeito da carga começar.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const userId = user?.id
  const loadHomeGames = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setHomeGames([])
      setSelectedHomeGame(null)
      return
    }

    setIsFetching(true)
    try {
      const data = await homeGamesApi.getAll()
      setHomeGames(data)
      // O ativo continua o mesmo se ainda existe (com os dados novos); se ele foi excluído (SPEC-20261026-1126) ou
      // nunca houve um, vale o guardado neste navegador (SPEC-20261029-1724), o principal da conta (SPEC-20261029-1723),
      // o único home game da lista — ou nenhum
      setSelectedHomeGame((current) => {
        const kept = current ? data.find((hg) => hg.id === current.id) : undefined
        if (kept) return kept
        const storedId = readStoredId(userId)
        const stored = storedId ? data.find((hg) => hg.id === storedId) : undefined
        return stored ?? defaultHomeGame(data, userId)
      })
    } catch {
      setHomeGames([])
    } finally {
      setIsFetching(false)
      setLoadedFor(userId)
    }
  }, [isAuthenticated, userId])

  const isLoading = isFetching || (isAuthenticated && !!userId && loadedFor !== userId)

  useEffect(() => {
    void loadHomeGames()
  }, [loadHomeGames])

  const selectHomeGame = useCallback((homeGame: HomeGame | null) => {
    setSelectedHomeGame(homeGame)
    if (userId) storeId(userId, homeGame?.id ?? null)
  }, [userId])

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
