import { Lock } from 'lucide-react'
import { cn } from '../../utils/cn'

/**
 * Cadeado de uma aba de recurso do plano pago (SPEC-20261023-1205): o mesmo nas abas do topo do painel do torneio e na
 * barra de baixo do celular (SPEC-20261027-2132).
 */
export function PlanTabLock({ className }: { className?: string }) {
  return <Lock className={cn('h-3.5 w-3.5 text-accent-gold-deep', className)} aria-label="bloqueado no plano atual" />
}
