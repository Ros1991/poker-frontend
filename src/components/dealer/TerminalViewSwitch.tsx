import { Link, useParams } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { dealerMiniTvPath, dealerTerminalPath } from '../../constants/routes'

/** As duas telas do dealer no celular: o terminal da mesa e o telão compacto (SPEC-20261029-1721) */
export type TerminalView = 'terminal' | 'tv'

interface TerminalViewSwitchProps {
  current: TerminalView
  className?: string
}

/**
 * Seletor "Terminal | Telão" no topo do terminal do dealer e do telão no celular (SPEC-20261029-1721). Troca de rota sem
 * empilhar o histórico (o "voltar" do navegador sai para onde a pessoa estava antes, ex.: o painel); a mesa escolhida no
 * terminal fica guardada por torneio nesta aba (useRememberedTable), então a volta cai na mesma mesa. O torneio vem da
 * própria rota (`/dealer/:tournamentId` e `/dealer/:tournamentId/telao`).
 */
export function TerminalViewSwitch({ current, className }: TerminalViewSwitchProps) {
  const { tournamentId = '' } = useParams<{ tournamentId: string }>()
  const items = [
    { view: 'terminal', label: 'Terminal', to: dealerTerminalPath(tournamentId) },
    { view: 'tv', label: 'Telão', to: dealerMiniTvPath(tournamentId) },
  ] as const

  return (
    <nav
      aria-label="Trocar de tela"
      className={cn('grid shrink-0 grid-cols-2 rounded-lg border border-border-input bg-bg-card p-0.5', className)}
      data-terminal-view-switch
    >
      {items.map((item) => {
        const active = item.view === current
        return (
          <Link
            key={item.view}
            to={item.to}
            replace
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              if (active) e.preventDefault()
            }}
            className={cn(
              'flex min-h-[36px] items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors',
              active ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-text-primary',
            )}
            data-terminal-view={item.view}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
