import { Crown, LayoutDashboard, Spade, Tablet, Tv, UserPlus } from 'lucide-react'
import type { ManualIcon as ManualIconKey } from '../manual.content'

const ICONS = {
  conta: UserPlus,
  dealer: Tablet,
  painel: LayoutDashboard,
  telao: Tv,
  // SPEC-20261029-1726: Para quem joga
  jogador: Spade,
  planos: Crown,
} as const

/** Ícone de cada módulo do manual (decorativo). */
export function ManualIcon({ icon, className }: { icon: ManualIconKey; className?: string }) {
  const Icon = ICONS[icon]
  return <Icon className={className} aria-hidden="true" />
}
