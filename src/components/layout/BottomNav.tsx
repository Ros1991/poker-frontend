import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, matchPath, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Home, Plus } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useHomeGame } from '../../hooks/useHomeGame'
import { ROUTES, homeGameDetailPath } from '../../constants/routes'
import * as tournamentsApi from '../../api/tournaments.api'
import * as rankingsApi from '../../api/rankings.api'
import * as personsApi from '../../api/persons.api'
import {
  HOME_GAME_TABS,
  TOURNAMENT_TABS,
  homeGameTabPath,
  isTabLocked,
  parseHomeGameTab,
  parseTournamentTab,
  tournamentTabPath,
} from './navTabs'
import type { HomeGameTabKey, TournamentTabKey } from './navTabs'
import { PlanTabLock } from './PlanTabLock'

interface BottomNavProps {
  className?: string
}

/** O que a barra mostra na tela aberta */
type NavMode =
  | { kind: 'tournament'; tournamentId: string; active: TournamentTabKey }
  | { kind: 'homeGame'; homeGameId: string; active: HomeGameTabKey | null; onDetail: boolean }
  | { kind: 'default' }

const match = (pattern: string, pathname: string) => matchPath({ path: pattern, end: true }, pathname)

/**
 * Barra de baixo do celular (abaixo de `lg`; SPEC-20261027-2132): navega dentro do que está aberto.
 * - Painel do torneio: as 7 abas do torneio (mesmos ícones e cadeados de plano das abas do topo), com rolagem lateral.
 * - Dentro de um home game (o detalhe e as telas dele: ficha do jogador, ranking, estrutura de blinds e os formulários
 *   de torneio, ranking, jogador e estrutura): as 5 abas do home game, com a aba da tela atual marcada.
 * - Fora de um home game (lista, Meu plano, Meu perfil, Administração): como antes — até 3 home games + Criar.
 * Trocar de home game, que é raro, fica no menu ☰ (lista "Meus Home Games").
 *
 * Fica no fluxo da coluna do AppLayout (não `fixed`): o `<main>` termina em cima dela, então o fim da página e o que for
 * `sticky bottom-0` nunca ficam escondidos atrás da barra. A área segura do iPhone entra no `padding-bottom`.
 */
export function BottomNav({ className }: BottomNavProps) {
  const mode = useNavMode()

  if (mode.kind === 'tournament') return <TournamentTabsBar mode={mode} className={className} />
  if (mode.kind === 'homeGame') return <HomeGameTabsBar mode={mode} className={className} />
  return <HomeGamesBar className={className} />
}

function useNavMode(): NavMode {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { selectedHomeGame } = useHomeGame()

  const dashboard = match('/tournaments/:id', pathname)
  const tournamentEdit = match('/tournaments/:id/edit', pathname)
  const rankingPage = match('/rankings/:id', pathname) ?? match('/rankings/:id/edit', pathname)
  const playerPage = match('/players/:id', pathname) ?? match('/players/:id/edit', pathname)
  const playerId = playerPage && playerPage.params.id !== 'new' ? playerPage.params.id : undefined

  // As telas que não têm o id do home game na URL leem do cache o que a própria tela buscou (mesma chave e mesma
  // função; `enabled: false`: a barra não faz consulta nenhuma). Sem o dado ainda, vale o home game ativo.
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

  if (dashboard?.params.id) {
    return { kind: 'tournament', tournamentId: dashboard.params.id, active: parseTournamentTab(searchParams.get('tab')) }
  }

  const inHomeGame = (homeGameId: string | undefined, active: HomeGameTabKey | null, onDetail = false): NavMode =>
    homeGameId ? { kind: 'homeGame', homeGameId, active, onDetail } : { kind: 'default' }
  const selectedId = selectedHomeGame?.id

  if (tournamentEdit) return inHomeGame(tournament.data?.homeGameId ?? selectedId, 'torneios')
  if (match(ROUTES.HOME_GAME_NEW, pathname)) return { kind: 'default' }
  const detail = match(ROUTES.HOME_GAME_DETAIL, pathname)
  if (detail) return inHomeGame(detail.params.id, parseHomeGameTab(searchParams.get('tab')), true)
  const homeGameEdit = match(ROUTES.HOME_GAME_EDIT, pathname)
  if (homeGameEdit) return inHomeGame(homeGameEdit.params.id, null)
  const tournaments = match(ROUTES.TOURNAMENTS, pathname) ?? match(ROUTES.TOURNAMENT_NEW, pathname)
  if (tournaments) return inHomeGame(tournaments.params.id, 'torneios')
  const rankings = match(ROUTES.RANKINGS_BY_HOME_GAME, pathname) ?? match(ROUTES.RANKING_NEW, pathname)
  if (rankings) return inHomeGame(rankings.params.homeGameId, 'rankings')
  const blinds = match(ROUTES.BLIND_STRUCTURE_NEW, pathname) ?? match(ROUTES.BLIND_STRUCTURE_EDIT, pathname)
  if (blinds) return inHomeGame(blinds.params.homeGameId, 'blinds')
  if (rankingPage) return inHomeGame(ranking.data?.homeGameId ?? selectedId, 'rankings')
  if (match(ROUTES.PLAYERS, pathname) || match(ROUTES.PLAYER_NEW, pathname)) return inHomeGame(selectedId, 'jogadores')
  if (playerPage) return inHomeGame(person.data?.homeGameId ?? selectedId, 'jogadores')
  return { kind: 'default' }
}

// ------------------------------------------------------------------ moldura

function BarFrame({
  label,
  kind,
  className,
  activeKey,
  children,
}: {
  label: string
  kind: string
  className?: string
  /** Muda quando a aba atual muda: rola a aba atual para a vista */
  activeKey?: string | null
  children: ReactNode
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const mounted = useRef(false)

  // Aba atual sempre à vista: centralizada na faixa que rola (sem mexer na rolagem vertical da página)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const currentItem = () => list.querySelector<HTMLElement>('[aria-current="page"]')?.closest('li') ?? null
    const center = (smooth: boolean) => {
      const item = currentItem()
      const max = list.scrollWidth - list.clientWidth
      if (!item || max <= 0) return
      const left = Math.max(0, Math.min(max, item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2))
      list.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
    }
    const first = !mounted.current
    center(!first)
    mounted.current = true
    // As larguras mudam quando a fonte da página termina de carregar ou a tela gira: a aba atual volta para a vista
    const item = currentItem()
    let sizes = `${list.clientWidth}/${item?.offsetWidth ?? 0}`
    const observer = new ResizeObserver(() => {
      const next = `${list.clientWidth}/${item?.offsetWidth ?? 0}`
      if (next === sizes) return
      sizes = next
      center(false)
    })
    observer.observe(list)
    if (item) observer.observe(item)
    let alive = true
    // Primeira vez (recarregar a página): a fonte ainda pode estar chegando
    if (first) {
      void document.fonts?.ready.then(() => {
        if (alive) center(false)
      })
    }
    return () => {
      alive = false
      observer.disconnect()
    }
  }, [activeKey, kind])

  return (
    <nav
      aria-label={label}
      data-bottom-nav={kind}
      className={cn('shrink-0 border-t border-border-default bg-bg-secondary', className)}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Rolagem lateral quando as abas não cabem: sem quebrar linha e sem barra de rolagem aparente */}
      <ul
        ref={listRef}
        className="flex items-stretch overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </nav>
  )
}

const itemClass = (active: boolean) =>
  cn(
    'relative flex min-h-[56px] min-w-[3.5rem] flex-col items-center justify-center gap-1 whitespace-nowrap px-1 py-2 text-xs font-medium transition-colors',
    active ? 'text-accent-blue' : 'text-text-secondary hover:text-text-primary',
  )

/** Traço em cima da aba atual (além da cor) */
function ActiveMark() {
  return <span aria-hidden className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-accent-blue" />
}

// ------------------------------------------------------------------ painel do torneio

function TournamentTabsBar({
  mode,
  className,
}: {
  mode: Extract<NavMode, { kind: 'tournament' }>
  className?: string
}) {
  // Cadeados: plano do DONO do home game, do torneio que o painel já buscou (sem consulta nova)
  const { data: tournament } = useQuery({
    queryKey: ['tournament', mode.tournamentId],
    queryFn: () => tournamentsApi.getById(mode.tournamentId),
    enabled: false,
  })
  const planFeatures = tournament?.planFeatures

  return (
    <BarFrame label="Abas do torneio" kind="tournament" className={className} activeKey={mode.active}>
      {TOURNAMENT_TABS.map((tab) => {
        const active = tab.key === mode.active
        const locked = isTabLocked(tab, planFeatures)
        const Icon = tab.icon
        return (
          <li key={tab.key} className="flex-1 shrink-0">
            <Link
              to={tournamentTabPath(mode.tournamentId, tab.key)}
              // Trocar de aba no próprio painel não empilha histórico (como as abas do topo)
              replace
              aria-current={active ? 'page' : undefined}
              title={locked ? 'Recurso de plano pago' : undefined}
              data-tab={tab.key}
              className={itemClass(active)}
            >
              {active && <ActiveMark />}
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden />
                {locked && <PlanTabLock className="absolute -right-2.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-bg-secondary" />}
              </span>
              <span>{tab.label}</span>
            </Link>
          </li>
        )
      })}
    </BarFrame>
  )
}

// ------------------------------------------------------------------ dentro de um home game

function HomeGameTabsBar({
  mode,
  className,
}: {
  mode: Extract<NavMode, { kind: 'homeGame' }>
  className?: string
}) {
  return (
    <BarFrame label="Abas do home game" kind="home-game" className={className} activeKey={mode.active}>
      {HOME_GAME_TABS.map((tab) => {
        const active = tab.key === mode.active
        const Icon = tab.icon
        return (
          <li key={tab.key} className="flex-1 shrink-0">
            <Link
              to={homeGameTabPath(mode.homeGameId, tab.key)}
              // No próprio detalhe, trocar de aba não empilha histórico (como as abas do topo); das outras telas, empilha
              replace={mode.onDetail}
              aria-current={active ? 'page' : undefined}
              data-tab={tab.key}
              className={itemClass(active)}
            >
              {active && <ActiveMark />}
              <Icon className="h-5 w-5" aria-hidden />
              <span>{tab.label}</span>
            </Link>
          </li>
        )
      })}
    </BarFrame>
  )
}

// ------------------------------------------------------------------ fora de um home game (como antes)

function HomeGamesBar({ className }: { className?: string }) {
  const { homeGames, selectedHomeGame } = useHomeGame()

  return (
    <nav
      data-bottom-nav="home-games"
      className={cn('shrink-0 border-t border-border-default bg-bg-secondary', className)}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-center justify-around">
        {homeGames.slice(0, 3).map((homeGame) => (
          <li key={homeGame.id} className="flex-1">
            <NavLink
              to={homeGameDetailPath(homeGame.id)}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium transition-colors min-h-[56px] justify-center',
                  isActive || selectedHomeGame?.id === homeGame.id
                    ? 'text-accent-blue'
                    : 'text-text-secondary hover:text-text-primary',
                )
              }
            >
              <Home className="h-5 w-5" />
              <span className="truncate max-w-[70px]">{homeGame.name}</span>
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <NavLink
            to={ROUTES.HOME_GAME_NEW}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium transition-colors min-h-[56px] justify-center',
                isActive
                  ? 'text-accent-green-deep'
                  : 'text-text-secondary hover:text-text-primary',
              )
            }
          >
            <Plus className="h-5 w-5" />
            <span>Criar</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
