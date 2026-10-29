import { Minus, Plus, Timer } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { TIMEBANK_MAX_COUNT, timebanksLeftText } from '../../utils/timebank'
import type { TournamentEntry } from '../../types/entry.types'
import { PlayerConfirmHeader } from './PlayerConfirmHeader'
import { playerName } from './terminalFormat'

interface TimebankSheetProps {
  entry: TournamentEntry | null
  /** Segundos de cada timebank do torneio */
  seconds: number
  /** Terminal do dealer: "Usar timebank" (a contagem é no celular). No painel não vem — só os ajustes */
  onUse?: (entry: TournamentEntry) => void
  onAdjust: (entry: TournamentEntry, delta: 1 | -1) => void
  /** Ajuste em andamento (desabilita os botões) */
  adjusting?: 1 | -1 | null
  onClose: () => void
}

/**
 * "Timebank de Fulano — N restantes" (SPEC-20261029-1722): no terminal, [Usar timebank (30 s)] abre a contagem em tela
 * cheia; [−1]/[+1] tiram ou dão um timebank (nunca abaixo de 0; dá para passar do inicial). No painel, só os ajustes — a
 * contagem fica no terminal. Abre tocando no chip "⏱ N". Só existe com o timebank ligado no torneio.
 */
export function TimebankSheet({ entry, seconds, onUse, onAdjust, adjusting = null, onClose }: TimebankSheetProps) {
  if (!entry) return null
  const name = playerName(entry)
  const left = entry.timebanksRemaining ?? 0
  const busy = adjusting != null
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Timebank de ${name}`}
      size="sm"
      footer={
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div data-timebank-sheet>
        <PlayerConfirmHeader person={entry.person} />
        <div className="mb-4 flex flex-col items-center gap-0.5" aria-live="polite">
          <span
            className={cn(
              'inline-flex items-center gap-2 text-5xl font-bold tabular-nums leading-none',
              left > 0 ? 'text-accent-orange-deep' : 'text-text-secondary',
            )}
            data-timebank-left={left}
          >
            <Timer className="h-9 w-9 shrink-0" aria-hidden />
            {left}
          </span>
          <span className="text-sm text-text-secondary" data-timebank-left-text>
            {left === 1 ? 'timebank restante' : left === 0 ? 'nenhum timebank restante' : 'timebanks restantes'} · {seconds} s cada
          </span>
        </div>

        {onUse && (
          <Button
            size="lg"
            className="mb-3 w-full"
            disabled={left <= 0 || busy}
            onClick={() => onUse(entry)}
            data-timebank-use
          >
            <Timer className="h-5 w-5" aria-hidden />
            Usar timebank ({seconds} s)
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Ajustar os timebanks de ${name}`}>
          <Button
            variant="secondary"
            disabled={left <= 0 || busy}
            loading={adjusting === -1}
            onClick={() => onAdjust(entry, -1)}
            aria-label={`Tirar um timebank de ${name}`}
            data-timebank-minus
          >
            <Minus className="h-4 w-4" aria-hidden />
            <span className="text-base font-bold tabular-nums">1</span>
          </Button>
          <Button
            variant="secondary"
            disabled={left >= TIMEBANK_MAX_COUNT || busy}
            loading={adjusting === 1}
            onClick={() => onAdjust(entry, 1)}
            aria-label={`Dar um timebank a ${name}`}
            data-timebank-plus
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="text-base font-bold tabular-nums">1</span>
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-text-secondary" data-timebank-hint>
          {!onUse
            ? 'A contagem do tempo fica no terminal do dealer. Tudo fica no histórico, com Desfazer.'
            : left > 0
              ? `Depois de usar: ${timebanksLeftText(left - 1)}. Tudo fica no histórico, com Desfazer.`
              : 'Sem timebank para usar: o +1 dá mais um. Tudo fica no histórico, com Desfazer.'}
        </p>
      </div>
    </Modal>
  )
}
