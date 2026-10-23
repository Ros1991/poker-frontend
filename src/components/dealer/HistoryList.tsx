import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Undo2 } from 'lucide-react'
import * as historyApi from '../../api/history.api'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { cn } from '../../utils/cn'
import type { HistoryItem } from '../../types/history.types'
import { formatTime, normalizeText } from './terminalFormat'

interface HistoryListProps {
  tournamentId: string
  /** Só o histórico deste jogador (Ficha) */
  entryId?: string
  /** Filtro por nome do jogador (tela Histórico) */
  search?: string
  /** Desfaz o item (já confirmado); a lista é invalidada por quem chama */
  onUndo: (item: HistoryItem) => Promise<void>
}

/** Histórico do mais recente para o mais antigo; desfeito fica riscado */
export function HistoryList({ tournamentId, entryId, search, onUndo }: HistoryListProps) {
  const [confirmItem, setConfirmItem] = useState<HistoryItem | null>(null)
  const [undoing, setUndoing] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['history', tournamentId, entryId ?? 'all'],
    queryFn: () => historyApi.getHistory(tournamentId, entryId),
    refetchInterval: 10000,
  })

  const items = useMemo(() => {
    const term = normalizeText(search?.trim() ?? '')
    if (!data || !term) return data ?? []
    return data.filter((i) => i.playerName && normalizeText(i.playerName).includes(term))
  }, [data, search])

  async function handleConfirm() {
    if (!confirmItem) return
    setUndoing(true)
    try {
      await onUndo(confirmItem)
    } finally {
      setUndoing(false)
      setConfirmItem(null)
    }
  }

  if (isLoading) return <LoadingSpinner size="md" text="Carregando histórico..." className="py-8" />
  if (isError) return <p className="py-8 text-center text-sm text-accent-red-deep">Não foi possível carregar o histórico.</p>
  if (items.length === 0)
    return (
      <p className="py-8 text-center text-sm text-text-secondary">
        {search?.trim() ? 'Nada encontrado para essa busca.' : 'Nada registrado ainda.'}
      </p>
    )

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2.5 rounded-lg border border-border-default bg-bg-secondary p-2.5">
            <span className="w-11 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-text-secondary">{formatTime(item.at)}</span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm text-text-primary',
                  item.undone && 'text-text-muted line-through',
                )}
              >
                {item.description}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {!entryId && item.playerName && (
                  <span className="font-medium text-text-primary">{item.playerName}</span>
                )}
                {!entryId && item.playerName && item.by && ' · '}
                {item.by && `por ${item.by}`}
              </p>
              {item.undone && (
                <p className="mt-0.5 text-xs text-accent-gold-deep">
                  desfeito{item.undoneAt ? ` às ${formatTime(item.undoneAt)}` : ''}
                  {item.undoneBy ? ` por ${item.undoneBy}` : ''}
                </p>
              )}
              {!item.undone && !item.canUndo && item.undoBlockedReason && (
                <p className="mt-0.5 text-[11px] text-text-secondary">{item.undoBlockedReason}</p>
              )}
            </div>
            {item.canUndo && (
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 self-center px-2.5"
                onClick={() => setConfirmItem(item)}
              >
                <Undo2 className="h-4 w-4" /> Desfazer
              </Button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        isOpen={!!confirmItem}
        onClose={() => !undoing && setConfirmItem(null)}
        onConfirm={() => void handleConfirm()}
        title="Desfazer"
        message={
          confirmItem
            ? confirmItem.playerName
              ? `Desfazer ${confirmItem.description} de ${confirmItem.playerName}?`
              : `Desfazer ${confirmItem.description}?`
            : ''
        }
        confirmLabel="Desfazer"
        variant="warning"
        loading={undoing}
      />
    </>
  )
}
