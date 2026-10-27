import { Crown, LayoutDashboard, Tablet, Tv, UserPlus } from 'lucide-react'
import type { ManualIcon as ManualIconKey } from '../manual.content'

const ICONS = {
  conta: UserPlus,
  dealer: Tablet,
  painel: LayoutDashboard,
  telao: Tv,
  planos: Crown,
} as const

/** Ícone de cada módulo do manual (decorativo). */
export function ManualIcon({ icon, className }: { icon: ManualIconKey; className?: string }) {
  const Icon = ICONS[icon]
  return <Icon className={className} aria-hidden="true" />
}
