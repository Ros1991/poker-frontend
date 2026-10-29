/**
 * Navegação da conta (SPEC-20261029-1724) — a MESMA leitura para o menu lateral, o seletor do cabeçalho, a barra de
 * baixo do celular e a casca das seções:
 * - de qual home game é a tela aberta (pela rota; nas telas sem o id na URL — painel do torneio, ranking, ficha do
 *   jogador — pelo que a própria tela já buscou, lido do cache sem consulta nova) e em que seção ela está;
 * - qual home game o menu mostra (o da tela; fora de um home game — Início, Meu plano —, o selecionado);
 * - as seções visíveis desse home game (plano do DONO e permissão de quem está logado — `visibleHomeGameSections`);
 * - se o "home game" aparece como conceito: só na Liga, ou quando a conta acessa mais de um (é membro do clube de
 *   outra pessoa — decisão do orquestrador registrada no state.md). No Mesa e no Clube sem outro clube, nada de
 *   seletor nem da palavra "home game" (D18).
 */
import { matchPath, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as homeGamesApi from '../api/homeGames.api'
import * as tournamentsApi from '../api/tournaments.api'
import * as rankingsApi from '../api/rankings.api'
import * as personsApi from '../api/persons.api'
import { ROUTES, isHomeGameSection } from '../constants/routes'
import type { HomeGameSection } from '../constants/routes'
import { sectionFromLegacyTab, visibleHomeGameSections } from '../components/layout/navTabs'
import type { HomeGame } from '../types/homeGame.types'
import type { AuthUser } from '../types/auth.types'
import { useAuth } from './useAuth'
import { useHomeGame } from './useHomeGame'
import { usePlan } from './usePlan'

export interface RouteHomeGame {
  /** Home game da tela aberta (null = tela fora de home game, ou ainda sem o dado) */
  homeGameId: string | null
  /** Seção marcada no menu e na barra de baixo */
  section: HomeGameSection | null
  /** A tela é a própria seção (`/home-games/:id/<seção>`), não uma sub-tela (formulário, ficha, ranking) */
  onSectionPage: boolean
  /** Painel do torneio aberto (`/tournaments/:id`, com ou sem `?tab=`) */
  tournamentId: string | null
}

const match = (pattern: string, pathname: string) => matchPath({ path: pattern, end: true }, pathname)

/** De qual home game e de qual seção é a tela aberta. */
export function useRouteHomeGame(): RouteHomeGame {
  const { pathname, search } = useLocation()

  const dashboard = match(ROUTES.TOURNAMENT_DASHBOARD, pathname)
  const tournamentEdit = match(ROUTES.TOURNAMENT_EDIT, pathname)
  const rankingPage = match(ROUTES.RANKING_DETAIL, pathname) ?? match(ROUTES.RANKING_EDIT, pathname)
  const playerPage = match(ROUTES.PLAYER_DETAIL, pathname) ?? match(ROUTES.PLAYER_EDIT, pathname)
  const playerId = playerPage && playerPage.params.id !== 'new' ? playerPage.params.id : undefined

  // Telas sem o id do home game na URL: o que a própria tela buscou (mesma chave e mesma função; `enabled: false`)
  const tournamentId = dashboard?.params.id ?? tournamentEdit?.params.id
  const tournament = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId!),
    enabled: false,
  })
  const rankingId = rankingPage?.params.id
  const ranking = useQuery({
    queryKey: ['ranking', rankingId],
    queryFn: () => rankingsApi.getById(rankingId!),
    enabled: false,
  })
  const person = useQuery({
    queryKey: ['person', playerId],
    queryFn: () => personsApi.getById(playerId!),
    enabled: false,
  })

  const none: RouteHomeGame = { homeGameId: null, section: null, onSectionPage: false, tournamentId: null }
  const at = (homeGameId: string | undefined | null, section: HomeGameSection, onSectionPage = false): RouteHomeGame => ({
    homeGameId: homeGameId ?? null,
    section,
    onSectionPage,
    tournamentId: null,
  })

  if (dashboard?.params.id) {
    return { ...at(tournament.data?.homeGameId, 'torneios'), tournamentId: dashboard.params.id }
  }
  if (tournamentEdit) return at(tournament.data?.homeGameId, 'torneios')
  if (match(ROUTES.HOME_GAME_NEW, pathname)) return none

  const newTournament = match(ROUTES.TOURNAMENT_NEW, pathname) ?? match(ROUTES.TOURNAMENTS, pathname)
  if (newTournament) return at(newTournament.params.id, 'torneios')
  const newRanking = match(ROUTES.RANKING_NEW, pathname)
  if (newRanking) return at(newRanking.params.homeGameId, 'rankings')
  const blinds = match(ROUTES.BLIND_STRUCTURE_NEW, pathname) ?? match(ROUTES.BLIND_STRUCTURE_EDIT, pathname)
  if (blinds) return at(blinds.params.homeGameId, 'estruturas')
  const edit = match(ROUTES.HOME_GAME_EDIT, pathname)
  if (edit) return at(edit.params.id, 'configuracoes')
  const section = match(ROUTES.HOME_GAME_SECTION, pathname)
  if (section && isHomeGameSection(section.params.section)) return at(section.params.id, section.params.section, true)
  const detail = match(ROUTES.HOME_GAME_DETAIL, pathname)
  if (detail) return at(detail.params.id, sectionFromLegacyTab(new URLSearchParams(search).get('tab')), true)

  if (rankingPage) return at(ranking.data?.homeGameId, 'rankings')
  if (playerPage) return at(person.data?.homeGameId, 'jogadores')
  if (match(ROUTES.PLAYER_NEW, pathname) || match(ROUTES.PLAYERS, pathname)) return at(null, 'jogadores')
  return none
}

export interface AccountNav {
  /** A rota (home game, seção, painel do torneio) */
  route: RouteHomeGame
  /** Home game que o menu mostra: o da tela; fora de um home game, o selecionado */
  current: HomeGame | null
  /** Id dele (pode existir antes do objeto: a casca ainda carregando) */
  currentId: string | null
  /** Seções visíveis do home game do menu */
  sections: HomeGameSection[]
  /** A conta é Liga ("home game" como conceito, criar home game) */
  isLiga: boolean
  /** Seletor no cabeçalho: na Liga, ou quando a conta acessa mais de um home game */
  showSelector: boolean
  /** Home games que a conta acessa (os dela primeiro, o principal à frente) */
  homeGames: HomeGame[]
  /** Home game principal da própria conta */
  primary: HomeGame | null
  isLoading: boolean
}

/**
 * Rótulo do home game para a interface: o nome do clube (`displayName`); no principal de dono Mesa (sem nome de clube) o
 * nome da conta — da própria pessoa, quando é o dela.
 */
export function homeGameLabel(homeGame: Pick<HomeGame, 'displayName' | 'name' | 'ownerId'>, user: AuthUser | null): string {
  if (homeGame.displayName) return homeGame.displayName
  if (homeGame.displayName === null && user && homeGame.ownerId === user.id) return user.name
  return homeGame.name
}

export function useAccountNav(): AccountNav {
  const { user } = useAuth()
  const { myPlan } = usePlan()
  const { homeGames, selectedHomeGame, isLoading } = useHomeGame()
  const route = useRouteHomeGame()

  // Home game da rota fora da lista (ex.: o Admin abrindo pela Administração): o que a casca buscou
  const listed = route.homeGameId ? homeGames.find((h) => h.id === route.homeGameId) : undefined
  const cached = useQuery({
    queryKey: ['homeGame', route.homeGameId],
    queryFn: () => homeGamesApi.getById(route.homeGameId!),
    enabled: false,
  })

  const current = route.homeGameId ? listed ?? cached.data ?? null : selectedHomeGame
  const currentId = route.homeGameId ?? selectedHomeGame?.id ?? null
  const plan = myPlan?.effectivePlan ?? user?.effectivePlan ?? user?.plan
  const isLiga = myPlan?.limits.homeGamesVisible ?? plan === 'Liga'
  const primary = (user && homeGames.find((h) => h.isPrimary && h.ownerId === user.id)) || null

  return {
    route,
    current,
    currentId,
    sections: visibleHomeGameSections(current),
    isLiga,
    showSelector: isLiga || homeGames.length > 1,
    homeGames,
    primary,
    isLoading,
  }
}
