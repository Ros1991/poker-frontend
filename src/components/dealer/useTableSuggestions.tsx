import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as entriesApi from '../../api/entries.api'
import * as tablesApi from '../../api/tables.api'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { analyzeTables, pickRandomBalanceMove, seatedByTable } from '../../utils/tableBalance'
import type { BalanceMove } from '../../utils/tableBalance'
import { BalanceDrawDialog } from './BalanceDrawDialog'
import { BreakTableDialog } from './BreakTableDialog'
import { apiErrorMessage, isActiveStatus, tableLabel } from './terminalFormat'
import { invalidateTerminalQueries, terminalFeatures } from './useTerminalActions'

function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

/**
 * O sorteio de equilíbrio ainda vale com os dados de agora: o jogador segue
 * ativo no mesmo lugar, o lugar de destino está livre e as mesas continuam
 * desequilibradas (2 ou mais de diferença entre origem e destino).
 */
function isBalanceMoveStillValid(move: BalanceMove, tables: Table[], entries: TournamentEntry[]): boolean {
  const player = entries.find((e) => e.id === move.entryId)
  if (!player || !isActiveStatus(player.status)) return false
  if (player.tableId !== move.fromTableId || player.seatNumber !== move.fromSeat) return false
  const toTable = tables.find((t) => t.id === move.toTableId)
  if (!toTable || !tables.some((t) => t.id === move.fromTableId) || move.toSeat > toTable.maxSeats) return false
  const seated = seatedByTable(tables, entries)
  const toPlayers = seated.get(move.toTableId) ?? []
  if (toPlayers.some((e) => e.seatNumber === move.toSeat)) return false
  const fromCount = seated.get(move.fromTableId)?.length ?? 0
  return fromCount - toPlayers.length >= 2
}

interface TableSuggestionsOptions {
  tournamentId: string
  /** Torneio (plano do dono: sem Tables não há quebra nem equilíbrio — a consulta de mesas daria 402) */
  tournament: Tournament | undefined
  tables: Table[]
  entries: TournamentEntry[]
  /** "Escolher eu mesmo" do sorteio de equilíbrio (terminal: tela Mesas; painel: as mesas numa modal) */
  onChooseMyself: () => void
}

/**
 * Sugestões de mesa depois de eliminar, compartilhadas pelo terminal do dealer e pela aba Jogadores do painel
 * (SPEC-20261026-1908 — antes só o terminal tinha): com os dados buscados agora no servidor, se os jogadores cabem
 * numa mesa a menos abre o "Quebrar mesa" (o resultado avisa "Agora é mesa final!"); senão, se desequilibrou, sorteia
 * quem muda ("Quem muda de mesa", com "Sortear outro" e "Escolher eu mesmo"). As regras são as de `utils/tableBalance`.
 *
 * Nasce antes do `useTerminalActions` de quem usa: o `close` vai no `onEliminationUndone` dele (eliminação desfeita
 * deixa o sorteio aberto velho), por isso invalida as consultas por conta própria (`invalidateTerminalQueries`).
 * Devolve a análise das mesas de agora (avisos do topo), as funções que abrem cada diálogo e o JSX (`dialogs`).
 */
export function useTableSuggestions({ tournamentId, tournament, tables, entries, onChooseMyself }: TableSuggestionsOptions) {
  const queryClient = useQueryClient()
  const features = terminalFeatures(tournament)
  const enabled = features.tables
  const [breakOpen, setBreakOpen] = useState(false)
  const [balanceMove, setBalanceMove] = useState<BalanceMove | null>(null)

  const analysis = useMemo(() => analyzeTables(tables, entries), [tables, entries])

  const invalidate = () => invalidateTerminalQueries(queryClient, tournamentId, features)

  /** Eliminação desfeita: o sorteio de equilíbrio/quebra aberto foi feito com as mesas de antes */
  const close = useCallback(() => {
    setBalanceMove(null)
    setBreakOpen(false)
  }, [])

  /** Inscrições e mesas buscadas agora no servidor (sem cache) */
  async function fetchFreshTables() {
    const [freshEntries, freshTables] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: ['entries', tournamentId],
        queryFn: () => entriesApi.getAll(tournamentId),
        staleTime: 0,
      }),
      queryClient.fetchQuery({
        queryKey: ['tables', tournamentId],
        queryFn: () => tablesApi.getAll(tournamentId),
        staleTime: 0,
      }),
    ])
    return { freshEntries, freshTables }
  }

  /** Com os dados novos: se der para quebrar uma mesa abre o "Quebrar"; senão, se desequilibrou, sorteia quem muda */
  async function evaluateAfterElimination() {
    // Sem controle de mesas no plano não há equilíbrio nem quebra (e a consulta daria 402)
    if (!enabled) return
    try {
      const { freshEntries, freshTables } = await fetchFreshTables()
      const fresh = analyzeTables(freshTables, freshEntries)
      if (fresh.breakable) setBreakOpen(true)
      else if (fresh.imbalance) setBalanceMove(pickRandomBalanceMove(fresh, freshTables, freshEntries))
    } catch {
      // Sem os dados novos, os avisos do topo aparecem na próxima consulta
    }
  }

  function drawBalance(excludeEntryId?: string) {
    const move = pickRandomBalanceMove(analysis, tables, entries, excludeEntryId)
    if (!move) {
      toast.info('As mesas já estão equilibradas.')
      setBalanceMove(null)
      return
    }
    setBalanceMove(move)
  }

  /** Sorteia de novo com os dados novos; se não há mais desequilíbrio, fecha avisando */
  function redrawBalanceMove(freshTables: Table[], freshEntries: TournamentEntry[], notice?: string) {
    const move = pickRandomBalanceMove(analyzeTables(freshTables, freshEntries), freshTables, freshEntries)
    if (!move) {
      toast.info('As mesas já estão equilibradas.')
      setBalanceMove(null)
      return
    }
    if (notice) toast.info(notice)
    setBalanceMove(move)
  }

  const balanceMutation = useMutation({
    mutationFn: async (move: BalanceMove) => {
      // O sorteio pode ter ficado velho (eliminação desfeita, outro aparelho mexeu): confere antes
      const { freshEntries, freshTables } = await fetchFreshTables()
      if (!isBalanceMoveStillValid(move, freshTables, freshEntries)) {
        return { moved: false as const, freshEntries, freshTables }
      }
      await tablesApi.movePlayer(tournamentId, {
        entryId: move.entryId,
        toTableId: move.toTableId,
        toSeat: move.toSeat,
        reason: 'balance',
      })
      return { moved: true as const }
    },
    onSuccess: (outcome, move) => {
      if (!outcome.moved) {
        redrawBalanceMove(outcome.freshTables, outcome.freshEntries, 'As mesas mudaram. Sorteamos de novo: confira antes de confirmar.')
        return
      }
      const dest = tables.find((t) => t.id === move.toTableId)
      toast.success(`${move.playerName} foi para ${dest ? tableLabel(dest) : 'a mesa'}, lugar ${move.toSeat}`)
      setBalanceMove(null)
      invalidate()
    },
    onError: async (err) => {
      toast.error(apiErrorMessage(err, 'Erro ao mudar o jogador de mesa.'))
      // 400 = o servidor recusou este sorteio (ex.: lugar de destino já ocupado): sorteia de novo
      if (httpStatus(err) !== 400) return
      try {
        const { freshEntries, freshTables } = await fetchFreshTables()
        redrawBalanceMove(freshTables, freshEntries, 'Sorteamos de novo: confira antes de confirmar.')
      } catch {
        setBalanceMove(null)
      }
    },
  })

  const dialogs = enabled ? (
    <>
      {breakOpen && (
        <BreakTableDialog
          tournamentId={tournamentId}
          tables={tables}
          entries={entries}
          suggestedTableId={analysis.breakable?.suggestedTableId ?? null}
          onClose={() => setBreakOpen(false)}
          onBroken={() => invalidate()}
        />
      )}

      {balanceMove && (
        <BalanceDrawDialog
          move={balanceMove}
          tables={tables}
          person={entries.find((e) => e.id === balanceMove.entryId)?.person ?? null}
          loading={balanceMutation.isPending}
          onConfirm={() => balanceMutation.mutate(balanceMove)}
          onReroll={() => drawBalance(balanceMove.entryId)}
          onChooseMyself={() => {
            setBalanceMove(null)
            onChooseMyself()
          }}
          onClose={() => setBalanceMove(null)}
        />
      )}
    </>
  ) : null

  return {
    /** Análise das mesas com os dados de agora (avisos do topo e "Quebrar mesa" da tela Mesas) */
    analysis,
    evaluateAfterElimination,
    openBreak: () => setBreakOpen(true),
    drawBalance,
    close,
    dialogs,
  }
}
