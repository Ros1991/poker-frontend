/**
 * Abas do home game e do painel do torneio — UMA definição só (SPEC-20261027-2132): as abas do topo das páginas
 * (computador, `lg`+) e a barra de baixo do celular (`BottomNav`, abaixo de `lg`) leem daqui os rótulos, os ícones e o
 * recurso de plano de cada aba (cadeado). As duas abas ficam na URL (`?tab=`), então a barra, o voltar do navegador e o
 * recarregar respeitam a aba aberta.
 */
import {
  BarChart3,
  Clock,
  CreditCard,
  Crown,
  DollarSign,
  Gamepad2,
  LayoutGrid,
  Timer,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { hasFeature } from '../../hooks/usePlan'
import type { PlanFeature } from '../../types/plan.types'

export interface NavTab<K extends string> {
  key: K
  label: string
  icon: LucideIcon
  /**
   * Recurso do plano pago que a aba exige (SPEC-20261023-1205). Sem ele no plano do DONO, a aba ganha o cadeado e o
   * painel mostra o PlanLock no lugar do conteúdo (a aba nem monta, então as consultas dela — que dariam 402 — não saem).
   */
  feature?: PlanFeature
}

// ------------------------------------------------------------------ home game

export type HomeGameTabKey = 'torneios' | 'rankings' | 'blinds' | 'jogadores' | 'membros'

export const HOME_GAME_TABS: readonly NavTab<HomeGameTabKey>[] = [
  { key: 'torneios', label: 'Torneios', icon: Trophy },
  { key: 'rankings', label: 'Rankings', icon: Crown },
  { key: 'blinds', label: 'Estruturas', icon: Timer },
  { key: 'jogadores', label: 'Jogadores', icon: Gamepad2 },
  { key: 'membros', label: 'Membros', icon: Users },
]

/**
 * Aba do home game pelo `?tab=`. O dealer entra pelo QR (SPEC-20261023-1216): sem aba de dealers; um link antigo com a
 * aba removida (ou sem `?tab=`) cai em Torneios.
 */
export function parseHomeGameTab(value: string | null | undefined): HomeGameTabKey {
  return HOME_GAME_TABS.find((t) => t.key === value)?.key ?? 'torneios'
}

export function homeGameTabPath(homeGameId: string, tab: HomeGameTabKey): string {
  return `/home-games/${homeGameId}?tab=${tab}`
}

// ------------------------------------------------------------------ painel do torneio

export type TournamentTabKey =
  | 'jogadores'
  | 'mesas'
  | 'blinds'
  | 'premiacao'
  | 'pagamentos'
  | 'custos'
  | 'financeiro'

export const TOURNAMENT_TABS: readonly NavTab<TournamentTabKey>[] = [
  { key: 'jogadores', label: 'Jogadores', icon: Users },
  { key: 'mesas', label: 'Mesas', icon: LayoutGrid, feature: 'Tables' },
  { key: 'blinds', label: 'Blinds', icon: Clock },
  { key: 'premiacao', label: 'Premiação', icon: Trophy, feature: 'Prizes' },
  { key: 'pagamentos', label: 'Pagamentos', icon: CreditCard, feature: 'Payments' },
  { key: 'custos', label: 'Custos', icon: DollarSign, feature: 'CostExtras' },
  { key: 'financeiro', label: 'Financeiro', icon: BarChart3, feature: 'Financial' },
]

/** Aba do painel do torneio pelo `?tab=` (sem ou com valor desconhecido: Jogadores) */
export function parseTournamentTab(value: string | null | undefined): TournamentTabKey {
  return TOURNAMENT_TABS.find((t) => t.key === value)?.key ?? 'jogadores'
}

export function tournamentTabPath(tournamentId: string, tab: TournamentTabKey): string {
  return `/tournaments/${tournamentId}?tab=${tab}`
}

/**
 * A aba está com o cadeado do plano? `planFeatures` é o do DONO do home game (`tournament.planFeatures`); antes de o
 * torneio carregar (`undefined`) nada fica trancado, como no `hasFeature`.
 */
export function isTabLocked(tab: NavTab<string>, planFeatures: readonly string[] | null | undefined): boolean {
  return !!tab.feature && !hasFeature(planFeatures, tab.feature)
}
