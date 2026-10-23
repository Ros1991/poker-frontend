import { useCallback, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as entriesApi from '../../api/entries.api'
import * as historyApi from '../../api/history.api'
import { hasFeature } from '../../hooks/usePlan'
import type { EliminationResult, TournamentEntry } from '../../types/entry.types'
import type { HistoryItem, HistoryKind } from '../../types/history.types'
import type { Tournament } from '../../types/tournament.types'
import { apiErrorMessage, formatCurrency, playerName } from './terminalFormat'

const UNDO_TOAST_MS = 10000
const PAYMENT_KINDS: HistoryKind[] = ['Payment', 'Settlement']

/** Kind que desfaz pela rota de eliminação; o resto (dinheiro e inscrição) pela de transação */
export function undoHistoryItem(tournamentId: string, item: HistoryItem) {
  return item.kind === 'Elimination'
    ? historyApi.undoElimination(tournamentId, item.refId)
    : historyApi.undoTransaction(tournamentId, item.refId)
}

/** refIds do jogador nos tipos pedidos, antes da ação; null = não deu para consultar */
async function snapshotRefIds(
  tournamentId: string,
  entryId: string,
  kinds: HistoryKind[],
): Promise<Set<string> | null> {
  try {
    const items = await historyApi.getHistory(tournamentId, entryId)
    return new Set(items.filter((i) => kinds.includes(i.kind)).map((i) => i.refId))
  } catch {
    return null
  }
}

/** Itens dos tipos pedidos que não existiam antes da ação (mais recentes primeiro) */
function createdSince(items: HistoryItem[], kinds: HistoryKind[], before: Set<string>): HistoryItem[] {
  return items.filter((i) => kinds.includes(i.kind) && !before.has(i.refId))
}

/**
 * O que o plano do DONO libera no terminal (SPEC-20261023-1205), pelo `tournament.planFeatures`.
 * Só decide com o torneio carregado: antes disso nenhuma consulta de recurso pago sai (daria 402).
 * - `payments`: Pagar, PaymentModal, abatimento e sugestões de PIX (D3)
 * - `tables`: mesas, "Mesas" do "Mais" e os avisos de desequilíbrio (D13)
 * Rebuy, add-on, eliminar, desfazer, histórico e relógio não dependem de plano (invariante).
 */
export function terminalFeatures(tournament: Tournament | undefined): { payments: boolean; tables: boolean } {
  return {
    payments: !!tournament && hasFeature(tournament.planFeatures, 'Payments'),
    tables: !!tournament && hasFeature(tournament.planFeatures, 'Tables'),
  }
}

interface TerminalActionsOptions {
  /** Uma eliminação foi desfeita (toast, Ficha ou Histórico): o sorteio de mesas aberto ficou velho */
  onEliminationUndone?: () => void
}

/**
 * Mutações do terminal + "Desfazer" logo após cada ação. O toast fica amarrado
 * ao item exato criado pela ação (achado no histórico comparando com o que
 * havia antes); nunca desfaz "o mais recente" na hora do toque.
 */
export function useTerminalActions(
  tournamentId: string,
  tournament: Tournament | undefined,
  { onEliminationUndone }: TerminalActionsOptions = {},
) {
  const queryClient = useQueryClient()
  const features = terminalFeatures(tournament)
  const paymentsEnabled = features.payments
  const tablesEnabled = features.tables
  const [paymentEntry, setPaymentEntry] = useState<TournamentEntry | null>(null)
  // Pagamentos do jogador quando o PaymentModal abriu: null = não deu para consultar; undefined = carregando
  const paymentBaseline = useRef<{ entryId: string; before: Set<string> | null | undefined } | null>(null)

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['availablePlayers', tournamentId] })
    // Recursos pagos: sem eles no plano as consultas nem existem (dariam 402)
    if (tablesEnabled) void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
    if (paymentsEnabled) {
      void queryClient.invalidateQueries({ queryKey: ['payments', tournamentId] })
      void queryClient.invalidateQueries({ queryKey: ['costExtras', tournamentId] })
      void queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
    }
  }, [queryClient, tournamentId, tablesEnabled, paymentsEnabled])

  /** Desfaz um item do histórico (já confirmado pelo usuário) */
  const undoItem = useCallback(
    async (item: HistoryItem) => {
      try {
        await undoHistoryItem(tournamentId, item)
        toast.success(
          item.playerName ? `Desfeito: ${item.description} — ${item.playerName}` : `Desfeito: ${item.description}`,
        )
        if (item.kind === 'Elimination') onEliminationUndone?.()
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Não foi possível desfazer.'))
      } finally {
        invalidateAll()
      }
    },
    [tournamentId, invalidateAll, onEliminationUndone],
  )

  /**
   * Toast de sucesso com "Desfazer" do item criado pela ação. `before` = refIds
   * do jogador (nos tipos pedidos) antes da ação; null = sem como saber → sem "Desfazer".
   */
  const showUndoToast = useCallback(
    async (message: string, entryId: string, kinds: HistoryKind[], before: Set<string> | null) => {
      let created: HistoryItem | null = null
      if (before) {
        try {
          const items = createdSince(await historyApi.getHistory(tournamentId, entryId), kinds, before)
          // Só um item novo é o desta ação; mais de um (outro aparelho ao mesmo tempo) é ambíguo
          if (items.length === 1 && !items[0].undone && items[0].canUndo) created = items[0]
        } catch {
          // Sem o histórico, o toast vai sem "Desfazer"
        }
      }
      const item = created
      toast.success(
        message,
        item
          ? { duration: UNDO_TOAST_MS, action: { label: 'Desfazer', onClick: () => void undoItem(item) } }
          : undefined,
      )
    },
    [tournamentId, undoItem],
  )

  const rebuyMutation = useMutation({
    mutationFn: async (entry: TournamentEntry) => {
      const before = await snapshotRefIds(tournamentId, entry.id, ['Rebuy'])
      await entriesApi.rebuy(tournamentId, entry.id)
      return before
    },
    onSuccess: (before, entry) => {
      invalidateAll()
      void showUndoToast(
        `Rebuy de ${playerName(entry)}${tournament ? ` (${formatCurrency(tournament.rebuyAmount)})` : ''}`,
        entry.id,
        ['Rebuy'],
        before,
      )
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao registrar rebuy.')),
  })

  const addonMutation = useMutation({
    mutationFn: async (vars: { entry: TournamentEntry; isDouble: boolean }) => {
      const before = await snapshotRefIds(tournamentId, vars.entry.id, ['Addon'])
      await entriesApi.addon(tournamentId, vars.entry.id, { isDouble: vars.isDouble })
      return before
    },
    onSuccess: (before, { entry, isDouble }) => {
      invalidateAll()
      const value = tournament ? ` (${formatCurrency(tournament.addonAmount * (isDouble ? 2 : 1))})` : ''
      void showUndoToast(
        `${isDouble ? 'Add-on duplo' : 'Add-on'} de ${playerName(entry)}${value}`,
        entry.id,
        ['Addon'],
        before,
      )
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao registrar add-on.')),
  })

  const eliminateMutation = useMutation({
    mutationFn: async (vars: { entry: TournamentEntry; eliminatedByEntryId?: string }) => {
      const before = await snapshotRefIds(tournamentId, vars.entry.id, ['Elimination'])
      const result = (await entriesApi.eliminate(tournamentId, vars.entry.id, {
        eliminatedByEntryId: vars.eliminatedByEntryId,
      })) as unknown as EliminationResult
      return { result, before }
    },
    onSuccess: ({ result, before }, { entry }) => {
      invalidateAll()
      void showUndoToast(
        result?.position
          ? `${playerName(entry)} saiu em ${result.position}º lugar`
          : `${playerName(entry)} saiu do torneio`,
        entry.id,
        ['Elimination'],
        before,
      )
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao eliminar jogador.')),
  })

  // Endpoint antigo (desfaz a eliminação do jogador direto pela Ficha)
  const undoEliminationMutation = useMutation({
    mutationFn: (entry: TournamentEntry) => entriesApi.undoElimination(tournamentId, entry.id),
    onSuccess: (_data, entry) => {
      invalidateAll()
      toast.success(`Eliminação de ${playerName(entry)} desfeita.`)
      onEliminationUndone?.()
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao desfazer eliminação.')),
  })

  /** Abre o PaymentModal guardando os pagamentos que já existiam, para oferecer "Desfazer" ao fechar */
  const openPayment = useCallback(
    (entry: TournamentEntry) => {
      // Sem Payments no plano do dono não há pagamento (o botão nem aparece)
      if (!paymentsEnabled) return
      const baseline = { entryId: entry.id, before: undefined as Set<string> | null | undefined }
      paymentBaseline.current = baseline
      setPaymentEntry(entry)
      void snapshotRefIds(tournamentId, entry.id, PAYMENT_KINDS).then((before) => {
        baseline.before = before
      })
    },
    [tournamentId, paymentsEnabled],
  )

  const closePayment = useCallback(() => {
    const entry = paymentEntry
    const baseline = paymentBaseline.current
    paymentBaseline.current = null
    setPaymentEntry(null)
    invalidateAll()
    const before = baseline?.before
    if (!entry || !before) return
    void historyApi
      .getHistory(tournamentId, entry.id)
      .then((items) => {
        // Só um pagamento feito com o modal aberto (estornar um antigo lá dentro não oferece desfazer outro)
        const latest = createdSince(items, PAYMENT_KINDS, before).find((i) => !i.undone && i.canUndo)
        if (!latest) return
        toast.success(`${latest.description} — ${playerName(entry)}`, {
          duration: UNDO_TOAST_MS,
          action: { label: 'Desfazer', onClick: () => void undoItem(latest) },
        })
      })
      .catch(() => undefined)
  }, [paymentEntry, tournamentId, invalidateAll, undoItem])

  return {
    paymentsEnabled,
    tablesEnabled,
    invalidateAll,
    undoItem,
    showUndoToast,
    rebuyMutation,
    addonMutation,
    eliminateMutation,
    undoEliminationMutation,
    paymentEntry,
    openPayment,
    closePayment,
  }
}
