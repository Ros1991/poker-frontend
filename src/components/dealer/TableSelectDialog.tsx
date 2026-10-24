import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import { seatedByTable } from '../../utils/tableBalance'
import { tableLabel } from './terminalFormat'

interface TableSelectDialogProps {
  isOpen: boolean
  onClose: () => void
  tables: Table[]
  entries: TournamentEntry[]
  selectedTableId: string | null
  onSelect: (tableId: string) => void
  onOpenTables: () => void
}

/** Seletor de mesa do topo ("Mesa 1 ▾") */
export function TableSelectDialog({
  isOpen,
  onClose,
  tables,
  entries,
  selectedTableId,
  onSelect,
  onOpenTables,
}: TableSelectDialogProps) {
  const seated = seatedByTable(tables, entries)
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Qual mesa você está?" size="sm">
      <div className="flex flex-col gap-2">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              'flex min-h-[52px] items-center justify-between rounded-lg border px-3 text-left transition-colors',
              selectedTableId === t.id
                ? 'border-accent-blue bg-accent-blue-soft'
                : 'border-border-default bg-bg-primary hover:bg-bg-tertiary',
            )}
          >
            <span>
              <span className="block font-semibold text-text-primary">
                {tableLabel(t)}
                {t.isFinalTable && <span className="ml-2 text-xs text-accent-gold-deep">Mesa final</span>}
              </span>
            </span>
            <span className="text-sm tabular-nums text-text-secondary">{seated.get(t.id)?.length ?? 0} jogadores</span>
          </button>
        ))}
        {tables.length === 0 && (
          <p className="py-4 text-center text-sm text-text-secondary">Nenhuma mesa sorteada.</p>
        )}
        <Button variant="secondary" className="mt-1" onClick={onOpenTables}>
          Ver todas as mesas
        </Button>
      </div>
    </Modal>
  )
}
