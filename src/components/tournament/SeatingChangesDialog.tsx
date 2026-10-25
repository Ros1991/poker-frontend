import { ArrowRightLeft, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { SeatingMove, SeatingResult } from '../../types/entry.types'
import { cn } from '../../utils/cn'
import { seatingAdvice, seatingTitle } from './seatingText'

// Mesas automáticas na inscrição (SPEC-20261023-1214): quando a inscrição abre mesa e equilibra, quem já estava
// sentado e mudou de lugar aparece numa lista pronta para anunciar — no painel (este diálogo) e no terminal do
// dealer (o mesmo SeatingMovesList no topo do resumo do "Adicionar jogadores").

/** "Mesa 1, lugar 3" (lugar antigo pode faltar em dado antigo) */
function fromText(move: SeatingMove): string {
  return move.fromSeat ? `${move.fromTableName}, lugar ${move.fromSeat}` : move.fromTableName
}

/** Lista "Ana: Mesa 1, lugar 3 → Mesa 2, lugar 5" em linhas grandes, legíveis no celular */
export function SeatingMovesList({ moves, className }: { moves: SeatingMove[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-1.5', className)} aria-label="Quem muda de lugar">
      {moves.map((m) => (
        <li
          key={m.entryId}
          className="rounded-lg border border-border-default bg-bg-card px-3 py-2.5 text-base leading-snug text-text-secondary"
        >
          {/* Quebra de linha só entre as partes: "Mesa 2, lugar 5" nunca fica partido no celular */}
          <span className="font-semibold text-text-primary">{m.playerName}:</span>{' '}
          <span className="whitespace-nowrap">{fromText(m)} →</span>{' '}
          <span className="whitespace-nowrap font-semibold text-accent-blue-deep">
            {m.toTableName}, lugar {m.toSeat}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface SeatingChangesDialogProps {
  /** Resultado do lote; o diálogo só abre com alguém mudando de lugar */
  seating: SeatingResult | null
  onClose: () => void
}

/**
 * Aviso de mudanças de lugar do painel: abre depois do "Adicionar jogadores" quando a inscrição abriu mesa e
 * mudou gente de lugar. Fecha só no "Feito" ou no X (o fundo e o ESC não fecham: o organizador precisa ler a lista).
 */
export function SeatingChangesDialog({ seating, onClose }: SeatingChangesDialogProps) {
  const open = !!seating && seating.moves.length > 0
  if (!open || !seating) return null
  const n = seating.moves.length
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={seatingTitle(seating)}
      size="md"
      footer={
        <div className="flex justify-end">
          <Button size="lg" className="w-full sm:w-auto" onClick={onClose}>
            <Check className="h-5 w-5" /> Feito
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 rounded-lg border border-accent-yellow bg-accent-yellow-soft p-3 text-sm text-text-primary">
          <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <span>
            {n === 1 ? '1 jogador muda de lugar' : `${n} jogadores mudam de lugar`} para equilibrar as mesas.{' '}
            {seatingAdvice(seating)}
          </span>
        </p>
        <SeatingMovesList moves={seating.moves} />
      </div>
    </Modal>
  )
}
