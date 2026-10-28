import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as tablesApi from '../../../api/tables.api'
import type { Table } from '../../../api/tables.api'
import type { TournamentEntry } from '../../../types/entry.types'
import { apiErrorMessage } from '../../../components/dealer/terminalFormat'
import type { SeatDragSource, SeatRef } from './useSeatDrag'

/** Soltar um jogador num lugar (SPEC-20261027-2133): vazio move, ocupado troca os dois */
export interface SeatDropVars {
  source: SeatDragSource
  target: SeatRef
  /** Quem estava no lugar de destino (troca) — null = lugar vazio (move) */
  other: { id: string; name: string } | null
}

/** As mesas como ficam depois de soltar (atualização otimista; o erro do servidor desfaz) */
function applyDropToTables(tables: Table[], { source, target, other }: SeatDropVars): Table[] {
  const all = tables.flatMap((t) => t.players ?? [])
  const moving = all.find((p) => p.id === source.entryId)
  if (!moving) return tables
  const otherPlayer = other ? all.find((p) => p.id === other.id) : undefined
  return tables.map((t) => {
    let players = (t.players ?? []).filter((p) => p.id !== source.entryId && p.id !== other?.id)
    if (t.id === target.tableId) players = [...players, { ...moving, seatNumber: target.seatNumber }]
    if (otherPlayer && t.id === source.tableId) players = [...players, { ...otherPlayer, seatNumber: source.seatNumber }]
    players.sort((a, b) => a.seatNumber - b.seatNumber)
    return { ...t, players, playerCount: players.length }
  })
}

/** As inscrições como ficam depois de soltar (a tela Mesas do terminal tira os lugares delas) */
function applyDropToEntries(entries: TournamentEntry[], { source, target, other }: SeatDropVars): TournamentEntry[] {
  return entries.map((e) => {
    if (e.id === source.entryId) return { ...e, tableId: target.tableId, seatNumber: target.seatNumber }
    if (other && e.id === other.id) return { ...e, tableId: source.tableId, seatNumber: source.seatNumber }
    return e
  })
}

interface UseSeatDropOptions {
  tournamentId: string
  /** Nome curto do aviso: apelido, senão o nome */
  nameOf: (entryId: string, fallback: string) => string
  /** "Mesa 2" do aviso de quem foi para um lugar vazio */
  tableNameOf: (tableId: string) => string
}

/**
 * Arrastar e soltar (toque e mouse — SPEC-20261027-2133; terminal do dealer — SPEC-20261028-1923): vazio move (o
 * servidor recusa se alguém sentou nele nesse meio-tempo), ocupado troca os dois numa operação só; a tela muda na hora
 * (mesas e inscrições) e o erro devolve o jogador ao lugar com a mensagem do servidor.
 */
export function useSeatDrop({ tournamentId, nameOf, tableNameOf }: UseSeatDropOptions) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ source, target, other }: SeatDropVars): Promise<void> => {
      if (other)
        await tablesApi.swapPlayers(tournamentId, {
          entryId: source.entryId,
          otherEntryId: other.id,
          fromTableId: source.tableId,
          fromSeat: source.seatNumber,
          toTableId: target.tableId,
          toSeat: target.seatNumber,
        })
      else
        await tablesApi.movePlayer(tournamentId, {
          entryId: source.entryId,
          toTableId: target.tableId,
          toSeat: target.seatNumber,
          requireFreeSeat: true,
        })
    },
    onMutate: async (vars) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['tables', tournamentId] }),
        queryClient.cancelQueries({ queryKey: ['entries', tournamentId] }),
      ])
      const previousTables = queryClient.getQueryData<Table[]>(['tables', tournamentId])
      const previousEntries = queryClient.getQueryData<TournamentEntry[]>(['entries', tournamentId])
      queryClient.setQueryData<Table[]>(['tables', tournamentId], (old) => (old ? applyDropToTables(old, vars) : old))
      queryClient.setQueryData<TournamentEntry[]>(['entries', tournamentId], (old) => (old ? applyDropToEntries(old, vars) : old))
      return { previousTables, previousEntries }
    },
    onSuccess: (_data, { source, target, other }) => {
      const name = nameOf(source.entryId, source.name)
      toast.success(
        other
          ? `${name} e ${nameOf(other.id, other.name)} trocaram de lugar`
          : `${name} → ${tableNameOf(target.tableId)}, lugar ${target.seatNumber}`,
      )
    },
    onError: (err, _vars, ctx) => {
      // O jogador volta para o lugar dele
      if (ctx?.previousTables) queryClient.setQueryData(['tables', tournamentId], ctx.previousTables)
      if (ctx?.previousEntries) queryClient.setQueryData(['entries', tournamentId], ctx.previousEntries)
      toast.error(apiErrorMessage(err, 'Não foi possível mudar o jogador de lugar.'))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
      void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
    },
  })
}
