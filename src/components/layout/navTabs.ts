/**
 * Seções do home game e abas do painel do torneio — UMA definição só (SPEC-20261027-2132; seções por rota desde a
 * SPEC-20261029-1724): o menu lateral, as abas do topo do painel (computador, `lg`+) e a barra de baixo do celular
 * (`BottomNav`, abaixo de `lg`) leem daqui os rótulos, os ícones e o recurso de plano de cada item (cadeado). As seções
 * do home game são rotas (`/home-games/:id/<seção>`) e as abas do torneio ficam na URL (`?tab=`), então a barra, o
 * voltar do navegador e o recarregar respeitam o que está aberto.
 */
import {
  BarChart3,
  Clock,
  CreditCard,
  Crown,
  DollarSign,
  Gamepad2,
  LayoutGrid,
  Settings,
  Timer,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { hasFeature } from '../../hooks/usePlan'
import type { PlanFeature } from '../../types/plan.types'
import { isHomeGameSection } from '../../constants/routes'
import type { HomeGameSection } from '../../constants/routes'

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

// ------------------------------------------------------------------ seções do home game

/**
 * Seções do home game (SPEC-20261029-1724): viraram rotas (`/home-games/:id/<seção>`), uma definição só para o menu
 * lateral (computador), a barra de baixo (celular) e o cabeçalho de uma linha das páginas. Configurações fica no menu
 * do computador e no "⋯" do cabeçalho no celular (`inBottomBar: false`).
 */
export interface HomeGameSectionTab extends NavTab<HomeGameSection> {
  /** Aparece na barra de baixo do celular */
  inBottomBar: boolean
}

export const HOME_GAME_SECTIONS: readonly HomeGameSectionTab[] = [
  { key: 'torneios', label: 'Torneios', icon: Trophy, inBottomBar: true },
  { key: 'rankings', label: 'Rankings', icon: Crown, feature: 'Rankings', inBottomBar: true },
  { key: 'estruturas', label: 'Estruturas', icon: Timer, inBottomBar: true },
  { key: 'jogadores', label: 'Jogadores', icon: Gamepad2, inBottomBar: true },
  { key: 'membros', label: 'Membros', icon: Users, inBottomBar: true },
  { key: 'configuracoes', label: 'Configurações', icon: Settings, inBottomBar: false },
]

export function homeGameSectionTab(key: HomeGameSection): HomeGameSectionTab {
  return HOME_GAME_SECTIONS.find((t) => t.key === key) ?? HOME_GAME_SECTIONS[0]
}

/**
 * Aba antiga (`?tab=` de antes da SPEC-20261029-1724) → seção: `blinds` virou `estruturas`; a aba de dealers (que
 * não existe desde a SPEC-20261023-1216), uma aba desconhecida ou nenhuma caem em Torneios.
 */
export function sectionFromLegacyTab(value: string | null | undefined): HomeGameSection {
  if (value === 'blinds') return 'estruturas'
  return isHomeGameSection(value) ? value : 'torneios'
}

/** O que o menu precisa saber do home game para decidir as seções */
export interface SectionsSource {
  /** Plano efetivo do DONO do home game (as seções seguem ele, não o de quem está logado) */
  ownerPlan?: string | null
  /** Quem está logado gerencia (dono, membro administrador ou Admin do sistema) */
  canManage?: boolean
  /** Membros além do dono (um ex-Clube rebaixado para o Mesa continua vendo os membros que tem) */
  memberCount?: number
}

/**
 * Seções que o menu mostra para o home game (SPEC-20261029-1724):
 * - Mesa (plano do dono): Torneios · Estruturas · Jogadores — sem rankings, membros nem configurações (sem financeiro,
 *   logo ou membros não há o que configurar). Exceção: o Mesa que ainda tem membros (veio de um plano pago) vê Membros
 *   para poder tirá-los.
 * - Clube e Liga: Torneios · Rankings · Estruturas · Jogadores · Membros · Configurações, com Membros e Configurações só
 *   para quem gerencia.
 * Plano do dono ainda desconhecido (carregando): o conjunto do Mesa, que nunca mostra o que pode não existir.
 */
export function visibleHomeGameSections(source: SectionsSource | null | undefined): HomeGameSection[] {
  const paid = !!source?.ownerPlan && source.ownerPlan !== 'Mesa'
  const manage = !!source?.canManage
  return HOME_GAME_SECTIONS.filter((t) => {
    switch (t.key) {
      case 'torneios':
      case 'estruturas':
      case 'jogadores':
        return true
      case 'rankings':
        return paid
      case 'membros':
        return manage && (paid || (source?.memberCount ?? 0) > 0)
      case 'configuracoes':
        return paid && manage
    }
  }).map((t) => t.key)
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
