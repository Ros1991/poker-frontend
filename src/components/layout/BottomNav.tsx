import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { House } from 'lucide-react'
import { cn } from '../../utils/cn'
import { ROUTES, homeGameSectionPath } from '../../constants/routes'
import { useAccountNav } from '../../hooks/useAccountNav'
import * as tournamentsApi from '../../api/tournaments.api'
import {
  TOURNAMENT_TABS,
  homeGameSectionTab,
  isTabLocked,
  parseTournamentTab,
  tournamentTabPath,
} from './navTabs'
import { PlanTabLock } from './PlanTabLock'

interface BottomNavProps {
  className?: string
}

/**
 * Barra de baixo do celular (abaixo de `lg`; SPEC-20261027-2132, por rota desde a SPEC-20261029-1724):
 * - Painel do torneio: as 7 abas do torneio (mesmos ícones e cadeados de plano das abas do topo), com rolagem lateral.
 * - Em qualquer outra tela: Início + as seções do home game do menu (as mesmas do menu lateral, de `navTabs.ts`, menos
 *   Configurações, que fica no "⋯" do cabeçalho), com a seção da tela marcada — também nas sub-telas (ficha do jogador,
 *   ranking, estrutura e os formulários). Sem lista de home games: trocar de home game é no seletor do cabeçalho.
 *
 * Fica no fluxo da coluna do AppLayout (não `fixed`): o `<main>` termina em cima dela, então o fim da página e o que for
 * `sticky bottom-0` nunca ficam escondidos atrás da barra. A área segura do iPhone entra no `padding-bottom`.
 */
export function BottomNav({ className }: BottomNavProps) {
  const nav = useAccountNav()
  const [searchParams] = useSearchParams()

  if (nav.route.tournamentId) {
    return (
      <TournamentTabsBar
        tournamentId={nav.route.tournamentId}
        active={parseTournamentTab(searchParams.get('tab'))}
        className={className}
      />
    )
  }
  return <AccountBar className={className} />
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
  tournamentId,
  active: activeTab,
  className,
}: {
  tournamentId: string
  active: ReturnType<typeof parseTournamentTab>
  className?: string
}) {
  // Cadeados: plano do DONO do home game, do torneio que o painel já buscou (sem consulta nova)
  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId),
    enabled: false,
  })
  const planFeatures = tournament?.planFeatures

  return (
    <BarFrame label="Abas do torneio" kind="tournament" className={className} activeKey={activeTab}>
      {TOURNAMENT_TABS.map((tab) => {
        const active = tab.key === activeTab
        const locked = isTabLocked(tab, planFeatures)
        const Icon = tab.icon
        return (
          <li key={tab.key} className="flex-1 shrink-0">
            <Link
              to={tournamentTabPath(tournamentId, tab.key)}
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

// ------------------------------------------------------------------ Início + seções do home game

function AccountBar({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const { route, currentId, sections } = useAccountNav()
  const onInicio = pathname === ROUTES.INICIO
  const items = currentId ? sections.map(homeGameSectionTab).filter((t) => t.inBottomBar) : []
  const activeKey = onInicio ? 'inicio' : route.section

  return (
    <BarFrame label="Navegação" kind="home-game" className={className} activeKey={activeKey}>
      <li className="flex-1 shrink-0">
        <Link
          to={ROUTES.INICIO}
          aria-current={onInicio ? 'page' : undefined}
          data-tab="inicio"
          className={itemClass(onInicio)}
        >
          {onInicio && <ActiveMark />}
          <House className="h-5 w-5" aria-hidden />
          <span>Início</span>
        </Link>
      </li>
      {items.map((tab) => {
        const active = !onInicio && tab.key === route.section
        const Icon = tab.icon
        return (
          <li key={tab.key} className="flex-1 shrink-0">
            <Link
              to={homeGameSectionPath(currentId!, tab.key)}
              // Na própria seção, trocar de seção não empilha histórico (como as abas de antes); das outras telas, empilha
              replace={route.onSectionPage}
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
