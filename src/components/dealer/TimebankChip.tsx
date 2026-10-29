import { Timer } from 'lucide-react'
import { cn } from '../../utils/cn'
import { timebanksLeftText } from '../../utils/timebank'

interface TimebankChipProps {
  /** Timebanks que o jogador ainda tem */
  remaining: number
  /** Presente = o chip é um botão (abre a TimebankSheet); ausente = só mostra */
  onClick?: () => void
  /** Nome do jogador para o leitor de tela ("Timebank de Duda: 3 restantes") */
  playerName?: string
  className?: string
}

/**
 * Chip "⏱ N" do timebank virtual (SPEC-20261029-1722) ao lado do nome no card do jogador, na Ficha, na lista "Jogadores"
 * do terminal e na aba Jogadores do painel. Só aparece com o timebank ligado no torneio (quem usa decide) — nunca no telão
 * (D5). Laranja, a cor do tempo, para não se confundir com o azul do rebuy, o dourado do add-on e o roxo do bounty; com 0
 * fica apagado. Como botão, a área de toque passa de 40 px sem aumentar a linha do nome (margem negativa).
 */
export function TimebankChip({ remaining, onClick, playerName, className }: TimebankChipProps) {
  const empty = remaining <= 0
  const label = `Timebank${playerName ? ` de ${playerName}` : ''}: ${timebanksLeftText(remaining)}`
  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-bold leading-none tabular-nums',
        empty
          ? 'border-border-default bg-bg-tertiary text-text-secondary'
          : 'border-accent-orange/40 bg-accent-orange-soft text-accent-orange-deep',
      )}
    >
      <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {remaining}
    </span>
  )
  if (!onClick)
    return (
      <span className={cn('inline-flex shrink-0', className)} aria-label={label} title={label} data-timebank-chip={remaining}>
        {pill}
      </span>
    )
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        '-my-2 inline-flex min-h-[40px] min-w-[40px] shrink-0 touch-manipulation items-center justify-center rounded-full px-0.5 active:scale-[0.97]',
        className,
      )}
      data-timebank-chip={remaining}
    >
      {pill}
    </button>
  )
}
