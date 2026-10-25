import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Undo2 } from 'lucide-react'
import * as historyApi from '../../api/history.api'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { usePlanCatalog } from '../../hooks/usePlanCatalog'
import { requiredPlanFor } from '../plan/planUtils'
import { cn } from '../../utils/cn'
import type { HistoryItem, HistoryKind } from '../../types/history.types'
import { formatTime, normalizeText } from './terminalFormat'

const PAYMENT_KINDS: HistoryKind[] = ['Payment', 'Settlement']

interface HistoryListProps {
  tournamentId: string
  /** Só o histórico deste jogador (Ficha) */
  entryId?: string
  /** Filtro por nome do jogador (tela Histórico) */
  search?: string
  /** Desfaz o item (já confirmado); a lista é invalidada por quem chama */
  onUndo: (item: HistoryItem) => Promise<void>
  /**
   * Plano do dono sem Payments (SPEC-20261023-1217, L11 — painel e terminal): pagamentos e abatimentos ficam sem
   * "Desfazer", com o motivo do plano (o plano que libera vem do catálogo, nunca digitado)
   */
  paymentsLocked?: boolean
}

/**
 * O que será desfeito, em frase natural. Eliminação (revisão geral do programa, ondas 7–9): o jogador primeiro e os
 * detalhes entre parênteses — "a eliminação de Duda (10º lugar, quem eliminou foi Beto)", texto neutro (serve para
 * jogador e jogadora). Os demais itens: "Rebuy 2 de Duda".
 */
function undoTarget(item: HistoryItem): string {
  if (item.kind === 'Elimination' && item.playerName) {
    const details = [
      item.position ? `${item.position}º lugar` : null,
      item.eliminatedByName ? `quem eliminou foi ${item.eliminatedByName}` : null,
    ].filter(Boolean)
    return `a eliminação de ${item.playerName}${details.length ? ` (${details.join(', ')})` : ''}`
  }
  return item.playerName ? `${item.description} de ${item.playerName}` : item.description
}

/** Texto da confirmação: o aviso do organizador (`undoWarning`, SPEC-20261023-1217 L4) vem antes da pergunta */
function confirmMessage(item: HistoryItem): string {
  const what = undoTarget(item)
  return item.undoWarning ? `${item.undoWarning} Desfazer ${what} mesmo assim?` : `Desfazer ${what}?`
}

/** Histórico do mais recente para o mais antigo; desfeito fica riscado */
export function HistoryList({ tournamentId, entryId, search, onUndo, paymentsLocked = false }: HistoryListProps) {
  const [confirmItem, setConfirmItem] = useState<HistoryItem | null>(null)
  const [undoing, setUndoing] = useState(false)
  // Catálogo público (GET public/plans, nunca 402): só para dizer qual plano libera os pagamentos
  const { plans } = usePlanCatalog({ enabled: paymentsLocked })
  const requiredPlan = requiredPlanFor('Payments', plans)
  const paymentsLockedReason = `Pagamentos estão disponíveis ${
    requiredPlan ? `a partir do plano ${requiredPlan}` : 'nos planos pagos'
  }.`
  const isLockedPayment = (item: HistoryItem) => paymentsLocked && PAYMENT_KINDS.includes(item.kind)

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
      <ul className="flex flex-col gap-1.5" data-history-list>
        {items.map((item) => {
          const locked = isLockedPayment(item)
          return (
            <li key={item.id} className="flex gap-2.5 rounded-lg border border-border-default bg-bg-secondary p-2.5" data-history-item>
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
                {!item.undone && locked && (
                  <p className="mt-0.5 text-[11px] text-text-secondary">{paymentsLockedReason}</p>
                )}
                {!item.undone && !locked && !item.canUndo && item.undoBlockedReason && (
                  <p className="mt-0.5 text-[11px] text-text-secondary">{item.undoBlockedReason}</p>
                )}
              </div>
              {item.canUndo && !locked && (
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
          )
        })}
      </ul>

      <ConfirmDialog
        isOpen={!!confirmItem}
        onClose={() => !undoing && setConfirmItem(null)}
        onConfirm={() => void handleConfirm()}
        title="Desfazer"
        message={confirmItem ? confirmMessage(confirmItem) : ''}
        confirmLabel="Desfazer"
        variant="warning"
        loading={undoing}
      />
    </>
  )
}
