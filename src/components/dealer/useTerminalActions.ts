import { useCallback, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
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

/**
 * Kind que desfaz pela rota de eliminação; atividade (só o timebank se desfaz — SPEC-20261029-1722) pela de atividade; o
 * resto (dinheiro e inscrição) pela de transação
 */
export function undoHistoryItem(tournamentId: string, item: HistoryItem) {
  if (item.kind === 'Elimination') return historyApi.undoElimination(tournamentId, item.refId)
  if (item.kind === 'Activity') return historyApi.undoActivity(tournamentId, item.refId)
  return historyApi.undoTransaction(tournamentId, item.refId)
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

/**
 * Invalida tudo que uma ação do terminal/painel pode mudar no torneio. Recursos pagos só com eles no plano do dono (sem
 * eles as consultas nem existem e dariam 402). Usado pelo `invalidateAll` e pelas sugestões de mesa
 * (`useTableSuggestions`), que nascem antes das ações para poder fechar o sorteio quando uma eliminação é desfeita.
 */
export function invalidateTerminalQueries(
  queryClient: QueryClient,
  tournamentId: string,
  features: { payments: boolean; tables: boolean },
) {
  void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
  void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
  void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
  void queryClient.invalidateQueries({ queryKey: ['availablePlayers', tournamentId] })
  if (features.tables) void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
  if (features.payments) {
    void queryClient.invalidateQueries({ queryKey: ['payments', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['costExtras', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
    // Abas Pagamentos e Financeiro do painel (resumo, cards por forma e "quem pagou para quem" — SPEC-20261026-1906):
    // desfazer um pagamento pelo toast/Histórico não pode deixar o detalhamento velho no cache
    void queryClient.invalidateQueries({ queryKey: ['paymentSummary', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['paymentTotalsByMethod', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['paymentBreakdown', tournamentId] })
  }
}

interface TerminalActionsOptions {
  /** Uma eliminação foi desfeita (toast, Ficha ou Histórico): o sorteio de mesas aberto ficou velho */
  onEliminationUndone?: () => void
}

/**
 * Mutações do terminal (e da aba Jogadores do painel — SPEC-20261023-1217) + "Desfazer" logo após cada ação. O toast fica amarrado
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

  const invalidateAll = useCallback(
    () => invalidateTerminalQueries(queryClient, tournamentId, { payments: paymentsEnabled, tables: tablesEnabled }),
    [queryClient, tournamentId, tablesEnabled, paymentsEnabled],
  )

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
   * Desfaz juntos os lançamentos de uma mesma ida ao PaymentModal (o atalho do limite por destino — SPEC-20261026-1906 —
   * lança o que o destino recebe e o restante em outro destino: são dois itens no histórico, um pagamento só) e os N
   * add-ons comprados de uma vez (SPEC-20261027-1311: um lançamento por add-on).
   */
  const undoItems = useCallback(
    async (items: HistoryItem[], label: string) => {
      let undone = 0
      try {
        for (const item of items) {
          await undoHistoryItem(tournamentId, item)
          undone++
        }
        toast.success(`Desfeito: ${label}`)
      } catch (err) {
        const msg = apiErrorMessage(err, 'Não foi possível desfazer.')
        toast.error(undone > 0 ? `Só parte foi desfeita (${undone} de ${items.length}). ${msg}` : msg)
      } finally {
        invalidateAll()
      }
    },
    [tournamentId, invalidateAll],
  )

  /**
   * Toast de sucesso com "Desfazer" do(s) item(ns) criado(s) pela ação. `before` = refIds do jogador (nos tipos pedidos)
   * antes da ação; null = sem como saber → sem "Desfazer". `expected` = quantos itens a ação cria (N add-ons de uma vez
   * criam N lançamentos — SPEC-20261027-1311): o "Desfazer" desfaz todos eles juntos.
   */
  const showUndoToast = useCallback(
    async (message: string, entryId: string, kinds: HistoryKind[], before: Set<string> | null, expected = 1) => {
      let created: HistoryItem[] | null = null
      if (before) {
        try {
          const items = createdSince(await historyApi.getHistory(tournamentId, entryId), kinds, before)
          // Só os itens novos desta ação; outro número (outro aparelho ao mesmo tempo) é ambíguo
          if (items.length === expected && items.every((i) => !i.undone && i.canUndo)) created = items
        } catch {
          // Sem o histórico, o toast vai sem "Desfazer"
        }
      }
      const items = created
      toast.success(
        message,
        items
          ? {
              duration: UNDO_TOAST_MS,
              action: {
                label: 'Desfazer',
                onClick: () => void (items.length === 1 ? undoItem(items[0]) : undoItems(items, message)),
              },
            }
          : undefined,
      )
    },
    [tournamentId, undoItem, undoItems],
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

  // Add-on com quantidade (SPEC-20261027-1311): cada add-on vira um lançamento; o "Desfazer" do toast desfaz os N
  const addonMutation = useMutation({
    mutationFn: async (vars: { entry: TournamentEntry; quantity: number }) => {
      const before = await snapshotRefIds(tournamentId, vars.entry.id, ['Addon'])
      await entriesApi.addon(tournamentId, vars.entry.id, { quantity: vars.quantity })
      return before
    },
    onSuccess: (before, { entry, quantity }) => {
      invalidateAll()
      const value = tournament ? ` (${formatCurrency(tournament.addonAmount * quantity)})` : ''
      void showUndoToast(
        `${quantity === 1 ? 'Add-on' : `${quantity} add-ons`} de ${playerName(entry)}${value}`,
        entry.id,
        ['Addon'],
        before,
        quantity,
      )
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao registrar add-on.')),
  })

  const eliminateMutation = useMutation({
    mutationFn: async (vars: { entry: TournamentEntry; eliminatedByEntryId?: string; killerName?: string }) => {
      const before = await snapshotRefIds(tournamentId, vars.entry.id, ['Elimination'])
      const result = (await entriesApi.eliminate(tournamentId, vars.entry.id, {
        eliminatedByEntryId: vars.eliminatedByEntryId,
      })) as unknown as EliminationResult
      return { result, before }
    },
    onSuccess: ({ result, before }, { entry, killerName }) => {
      invalidateAll()
      // "· na premiação" quando o servidor diz que a posição paga (SPEC-20261023-1217, L10 — painel e terminal)
      const itm = result?.isInTheMoney ? ' · na premiação' : ''
      // Knockout (SPEC-20261026-1909): para onde foi o bounty
      const who = killerName ?? result?.eliminatedBy ?? 'quem eliminou'
      const bounty =
        (result?.bountyAmount ?? 0) > 0
          ? (result?.bountyToHead ?? 0) > 0
            ? ` · bounty: ${formatCurrency(result?.bountyCash ?? 0)} para ${who} + ${formatCurrency(result?.bountyToHead ?? 0)} na cabeça`
            : ` · bounty ${formatCurrency(result?.bountyCash ?? 0)} para ${who}`
          : ''
      // Última eliminação: o servidor já finalizou o torneio — o toast diz isso e quem é o campeão (revisão geral 2)
      const finished = result?.tournamentFinished
        ? `. Torneio finalizado: ${result.championName ?? 'o último jogador'} é o campeão!`
        : ''
      void showUndoToast(
        result?.position
          ? `${playerName(entry)} saiu em ${result.position}º lugar${itm}${bounty}${finished}`
          : `${playerName(entry)} saiu do torneio${itm}${bounty}${finished}`,
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
        // Só os lançamentos feitos com o modal aberto (estornar um antigo lá dentro não oferece desfazer outro)
        const created = createdSince(items, PAYMENT_KINDS, before).filter((i) => !i.undone && i.canUndo)
        if (created.length === 0) return
        if (created.length === 1) {
          const latest = created[0]
          toast.success(`${latest.description} — ${playerName(entry)}`, {
            duration: UNDO_TOAST_MS,
            action: { label: 'Desfazer', onClick: () => void undoItem(latest) },
          })
          return
        }
        // Pagamento dividido entre destinos: o texto na ordem em que foram lançados; o "Desfazer" desfaz todas as
        // partes (a mais recente primeiro)
        const label = `${[...created].reverse().map((i) => i.description).join(' + ')} — ${playerName(entry)}`
        toast.success(label, {
          duration: UNDO_TOAST_MS,
          action: { label: 'Desfazer', onClick: () => void undoItems(created, label) },
        })
      })
      .catch(() => undefined)
  }, [paymentEntry, tournamentId, invalidateAll, undoItem, undoItems])

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
