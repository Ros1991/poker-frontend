import { AlertTriangle, Shuffle, UserX } from 'lucide-react'
import { Button } from '../ui/Button'
import type { Table } from '../../api/tables.api'
import type { TableAnalysis } from '../../utils/tableBalance'
import { tableLabel } from './terminalFormat'

interface TableAlertsProps {
  analysis: TableAnalysis
  tables: Table[]
  unseatedCount: number
  onBreakTable: () => void
  onDrawBalance: () => void
  onOpenTables: () => void
}

/** Avisos abaixo do topo. Quebrar mesa tem prioridade sobre desequilíbrio. */
export function TableAlerts({
  analysis,
  tables,
  unseatedCount,
  onBreakTable,
  onDrawBalance,
  onOpenTables,
}: TableAlertsProps) {
  const name = (id: string) => {
    const t = tables.find((x) => x.id === id)
    return t ? tableLabel(t) : 'Mesa'
  }
  const { breakable, imbalance } = analysis

  if (!breakable && !imbalance && unseatedCount === 0) return null

  return (
    <div className="flex flex-col gap-2 px-3 pt-3">
      {breakable ? (
        <div className="rounded-xl border border-accent-yellow/40 bg-accent-yellow-soft p-3">
          <p className="flex items-start gap-2 text-sm font-medium text-text-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" />
            Dá para juntar em {breakable.targetTables}{' '}
            {breakable.targetTables === 1 ? 'mesa' : 'mesas'}: {breakable.players}{' '}
            {breakable.players === 1 ? 'jogador cabe' : 'jogadores cabem'}
            {unseatedCount > 0 ? ` (contando ${unseatedCount} sem lugar)` : ''}. Quebrar uma mesa?
          </p>
          <Button className="mt-2 w-full" onClick={onBreakTable}>
            Quebrar mesa
          </Button>
        </div>
      ) : imbalance ? (
        <div className="rounded-xl border border-accent-yellow/40 bg-accent-yellow-soft p-3">
          <p className="flex items-start gap-2 text-sm font-medium text-text-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" />
            {name(imbalance.fromTableId)} com {imbalance.fromCount} e {name(imbalance.toTableId)} com{' '}
            {imbalance.toCount}: mova 1 jogador da {name(imbalance.fromTableId)} para a{' '}
            {name(imbalance.toTableId)}.
          </p>
          <Button className="mt-2 w-full" onClick={onDrawBalance}>
            <Shuffle className="h-4 w-4" /> Sortear quem muda
          </Button>
          <button
            type="button"
            onClick={onOpenTables}
            className="mt-1 min-h-[40px] w-full text-sm font-medium text-accent-blue"
          >
            Escolher eu mesmo
          </button>
        </div>
      ) : null}

      {unseatedCount > 0 && tables.length > 0 && (
        <button
          type="button"
          onClick={onOpenTables}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border-default bg-bg-secondary px-3 text-left text-sm text-text-secondary"
        >
          <UserX className="h-4 w-4 shrink-0 text-accent-yellow" />
          <span className="flex-1">
            {unseatedCount === 1 ? '1 jogador sem mesa' : `${unseatedCount} jogadores sem mesa`}
          </span>
          <span className="font-medium text-accent-blue">Ver mesas</span>
        </button>
      )}
    </div>
  )
}
