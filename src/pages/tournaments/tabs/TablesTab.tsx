import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRightLeft, LayoutGrid, Shuffle, Plus, Trash2, Users } from 'lucide-react'
import * as tablesApi from '../../../api/tables.api'
import type { Table, TablePlayer } from '../../../api/tables.api'
import * as entriesApi from '../../../api/entries.api'
import { Avatar } from '../../../components/ui/Avatar'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Input } from '../../../components/ui/Input'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import { PlayerConfirmHeader } from '../../../components/dealer/PlayerConfirmHeader'
import type { ConfirmPerson } from '../../../components/dealer/PlayerConfirmHeader'
import type { Tournament } from '../../../types/tournament.types'
import { cn } from '../../../utils/cn'
import { ghostPosition, useSeatDrag } from './useSeatDrag'
import type { SeatDragSource, SeatRef } from './useSeatDrag'

/**
 * Fantasma de quem está sendo arrastado (SPEC-20261027-2133): centrado no dedo/mouse e acima dele, mas preso dentro da
 * tela (revisão da onda 15: perto da borda esquerda a 320 px a foto e o nome saíam da tela). O tamanho muda com o texto
 * ("Solte num lugar", "Mesa 2, lugar 4", "Trocar com …"), então a posição é medida a cada render, antes da pintura.
 */
function SeatDragGhost({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { left, top } = ghostPosition(x, y, el.offsetWidth, el.offsetHeight, document.documentElement.clientWidth, window.innerHeight)
    el.style.transform = `translate(${left}px, ${top}px)`
  })
  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      data-seat-drag-ghost
      className="pointer-events-none fixed left-0 top-0 z-[70] flex max-w-[16rem] items-center gap-2 rounded-full border border-accent-blue bg-bg-card py-1 pl-1 pr-3 shadow-lg"
    >
      {children}
    </div>,
    document.body,
  )
}

interface TablesTabProps {
  tournament: Tournament
}

/** Soltar um jogador num lugar (SPEC-20261027-2133): vazio move, ocupado troca os dois */
interface DropVars {
  source: SeatDragSource
  target: SeatRef
  /** Quem estava no lugar de destino (troca) — null = lugar vazio (move) */
  other: TablePlayer | null
}

function serverMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message
}

/** As mesas como ficam depois de soltar (atualização otimista; o erro do servidor desfaz) */
function applyDrop(tables: Table[], { source, target, other }: DropVars): Table[] {
  const moving = tables.flatMap((t) => t.players ?? []).find((p) => p.id === source.entryId)
  if (!moving) return tables
  return tables.map((t) => {
    let players = (t.players ?? []).filter((p) => p.id !== source.entryId && p.id !== other?.id)
    if (t.id === target.tableId) players = [...players, { ...moving, seatNumber: target.seatNumber }]
    if (other && t.id === source.tableId) players = [...players, { ...other, seatNumber: source.seatNumber }]
    players.sort((a, b) => a.seatNumber - b.seatNumber)
    return { ...t, players, playerCount: players.length }
  })
}

export function TablesTab({ tournament }: TablesTabProps) {
  const queryClient = useQueryClient()
  const [showDrawModal, setShowDrawModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [tableCount, setTableCount] = useState('')
  const [seatsPerTable, setSeatsPerTable] = useState(
    String(tournament.seatsPerTable ?? 9),
  )
  const [newTableNumber, setNewTableNumber] = useState('')
  const [newTableSeats, setNewTableSeats] = useState('9')
  const [confirmUnseat, setConfirmUnseat] = useState(false)
  const [movePlayerEntry, setMovePlayerEntry] = useState<{
    entryId: string
    name: string
    currentTableNumber: number
    currentSeat: number
  } | null>(null)
  const [moveToTableId, setMoveToTableId] = useState('')
  const [moveToSeat, setMoveToSeat] = useState('')
  const [assignSeat, setAssignSeat] = useState<{
    tableId: string
    tableNumber: number
    seatNumber: number
  } | null>(null)
  const [confirmDeleteTable, setConfirmDeleteTable] = useState<Table | null>(null)

  const {
    data: tables,
    isLoading,
  } = useQuery({
    queryKey: ['tables', tournament.id],
    queryFn: () => tablesApi.getAll(tournament.id),
  })


  const { data: entries = [] } = useQuery({
    queryKey: ['entries', tournament.id],
    queryFn: () => entriesApi.getAll(tournament.id),
  })

  // Foto e nome de quem está sendo movido/removido (SPEC-20261026-2103): a pessoa da inscrição; sem ela, só o nome
  function personOf(p: { entryId: string; name: string }): ConfirmPerson {
    return entries.find((e) => e.id === p.entryId)?.person ?? { fullName: p.name, nickname: null, photoUrl: null }
  }
  // Nome curto dos avisos do arrastar: apelido, senão o nome
  function shortName(entryId: string, fallback: string): string {
    const person = entries.find((e) => e.id === entryId)?.person
    return person?.nickname?.trim() || person?.fullName || fallback
  }
  const tableNumberOf = (tableId: string) => tables?.find((t) => t.id === tableId)?.tableNumber

  // Jogador ativo sentado na mesa (lista da mesa + inscrições ativas que apontam para ela): mesa vazia pode ser excluída
  function seatedCount(table: Table): number {
    const ids = new Set((table.players ?? []).map((p) => p.id))
    for (const e of entries)
      if (e.tableId === table.id && (e.status === 'Active' || e.status === 'Registered')) ids.add(e.id)
    return ids.size
  }

  const invalidateSeating = () => {
    void queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
    void queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
    void queryClient.invalidateQueries({ queryKey: ['history', tournament.id] })
  }

  // Arrastar e soltar (toque e mouse — SPEC-20261027-2133): vazio move (o servidor recusa se alguém sentou nele
  // nesse meio-tempo), ocupado troca os dois numa operação só; a tela muda na hora e o erro devolve ao lugar
  const dropMutation = useMutation({
    mutationFn: async ({ source, target, other }: DropVars): Promise<void> => {
      if (other)
        await tablesApi.swapPlayers(tournament.id, {
          entryId: source.entryId,
          otherEntryId: other.id,
          fromTableId: source.tableId,
          fromSeat: source.seatNumber,
          toTableId: target.tableId,
          toSeat: target.seatNumber,
        })
      else
        await tablesApi.movePlayer(tournament.id, {
          entryId: source.entryId,
          toTableId: target.tableId,
          toSeat: target.seatNumber,
          requireFreeSeat: true,
        })
    },
    onMutate: async (vars): Promise<{ previous: Table[] | undefined }> => {
      await queryClient.cancelQueries({ queryKey: ['tables', tournament.id] })
      const previous = queryClient.getQueryData<Table[]>(['tables', tournament.id])
      queryClient.setQueryData<Table[]>(['tables', tournament.id], (old) => (old ? applyDrop(old, vars) : old))
      return { previous }
    },
    onSuccess: (_data, { source, target, other }) => {
      const name = shortName(source.entryId, source.name)
      toast.success(
        other
          ? `${name} e ${shortName(other.id, other.name)} trocaram de lugar`
          : `${name} → Mesa ${tableNumberOf(target.tableId) ?? ''}, lugar ${target.seatNumber}`,
      )
    },
    onError: (err, _vars, ctx) => {
      // O jogador volta para o lugar dele
      if (ctx?.previous) queryClient.setQueryData(['tables', tournament.id], ctx.previous)
      toast.error(serverMessage(err) || 'Não foi possível mudar o jogador de lugar.')
    },
    onSettled: invalidateSeating,
  })

  const seatDrag = useSeatDrag((source, target) => {
    const targetTable = tables?.find((t) => t.id === target.tableId)
    if (!targetTable) return
    const other = targetTable.players?.find((p) => p.seatNumber === target.seatNumber && p.id !== source.entryId) ?? null
    dropMutation.mutate({ source, target, other })
  })
  const drag = seatDrag.drag
  const dragOther = drag?.target
    ? tables?.find((t) => t.id === drag.target!.tableId)?.players?.find((p) => p.seatNumber === drag.target!.seatNumber) ?? null
    : null

  const deleteTableMutation = useMutation({
    mutationFn: (table: Table) => tablesApi.remove(tournament.id, table.id),
    onSuccess: (_data, table) => {
      toast.success(`Mesa ${table.tableNumber} excluída.`)
      setConfirmDeleteTable(null)
    },
    onError: (err) => {
      // 400 do servidor: alguém sentou nela em outro aparelho (a lista recarrega e o botão some)
      toast.error(serverMessage(err) || 'Não foi possível excluir a mesa.')
      setConfirmDeleteTable(null)
    },
    onSettled: invalidateSeating,
  })

  const activePlayerCount = entries.filter((e) => e.status === 'Active' || e.status === 'Registered').length
  // As mesas nascem com as inscrições (SPEC-20261023-1214): sortear é "Sortear de novo" quando elas já existem
  const hasTables = (tables?.length ?? 0) > 0
  const drawLabel = hasTables ? 'Sortear de novo' : 'Sortear mesas'
  const seatsNum = parseInt(seatsPerTable) || tournament.seatsPerTable || 9
  const calculatedTableCount = Math.max(
    1,
    Math.ceil(activePlayerCount / seatsNum),
  )

  // B6: detectar desbalanceamento de mesas (diferença >= 2 entre a maior e a menor)
  const tableCounts = (tables ?? []).map((t) => ({
    t,
    count: entries.filter(
      (e) =>
        e.tableId === t.id &&
        (e.status === 'Active' || e.status === 'Registered'),
    ).length,
  }))
  const occupiedTables = tableCounts.filter((tc) => tc.count > 0)
  let imbalance: { from: number; to: number; move: number } | null = null
  if (occupiedTables.length >= 2) {
    const maxTc = occupiedTables.reduce((a, b) => (b.count > a.count ? b : a))
    const minTc = occupiedTables.reduce((a, b) => (b.count < a.count ? b : a))
    const diff = maxTc.count - minTc.count
    if (diff >= 2) {
      imbalance = {
        from: maxTc.t.tableNumber,
        to: minTc.t.tableNumber,
        move: Math.floor(diff / 2),
      }
    }
  }

  const moveMutation = useMutation({
    mutationFn: (vars: { entryId: string; toTableId: string; toSeat: number }) =>
      tablesApi.movePlayer(tournament.id, vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
      toast.success('Jogador movido!')
      setMovePlayerEntry(null)
      setMoveToTableId('')
      setMoveToSeat('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao mover jogador.')
    },
  })

  const unseatMutation = useMutation({
    mutationFn: (entryId: string) =>
      tablesApi.unseatPlayer(tournament.id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      toast.success('Jogador removido da mesa.')
      setConfirmUnseat(false)
      setMovePlayerEntry(null)
    },
    onError: () => toast.error('Erro ao remover jogador da mesa.'),
  })

  // O dealer entra pelo QR (SPEC-20261023-1216, DL1): o sorteio não escolhe mais dealer por mesa
  const drawMutation = useMutation({
    mutationFn: () =>
      tablesApi.draw(tournament.id, {
        tableCount: tableCount ? parseInt(tableCount) : calculatedTableCount,
        maxSeatsPerTable: seatsNum,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      // A lotação escolhida passa a valer para as mesas que a inscrição abrir depois (SeatsPerTable)
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['history', tournament.id] })
      toast.success('Mesas sorteadas com sucesso!')
      setShowDrawModal(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao sortear mesas.')
    },
  })

  const createTableMutation = useMutation({
    mutationFn: () =>
      tablesApi.create(tournament.id, {
        tableNumber: parseInt(newTableNumber),
        maxSeats: parseInt(newTableSeats),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
      toast.success('Mesa criada!')
      setShowCreateModal(false)
      setNewTableNumber('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao criar mesa.')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner text="Carregando mesas..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">
          Mesas ({tables?.length ?? 0})
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4" />
            Criar Mesa
          </Button>
          <Button size="sm" variant={hasTables ? 'secondary' : 'primary'} onClick={() => setShowDrawModal(true)}>
            <Shuffle className="h-4 w-4" />
            {drawLabel}
          </Button>
        </div>
      </div>

      {imbalance && (
        <div className="flex items-start gap-3 rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3">
          <Users className="h-5 w-5 text-accent-yellow flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">Mesas desbalanceadas</p>
            <p className="text-text-secondary">
              Mova {imbalance.move} jogador(es) da Mesa {imbalance.from} para a
              Mesa {imbalance.to}.
            </p>
          </div>
        </div>
      )}

      {!hasTables && (
        <div className="text-center py-12">
          <LayoutGrid className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Nenhuma mesa criada ainda.</p>
          <p className="text-sm text-text-secondary mt-1">
            As mesas são criadas sozinhas quando você inscreve os jogadores.
          </p>
          {/* Torneio antigo com inscritos sem mesa: o sorteio ainda distribui todo mundo de uma vez */}
          {activePlayerCount > 0 && (
            <Button size="sm" className="mt-4" onClick={() => setShowDrawModal(true)}>
              <Shuffle className="h-4 w-4" />
              Sortear mesas
            </Button>
          )}
        </div>
      )}

      {tables && tables.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table: Table) => (
            <div
              key={table.id}
              className="rounded-xl border border-border-default bg-bg-primary p-4"
              data-table-card={table.tableNumber}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-text-primary">
                  Mesa {table.tableNumber}
                </h3>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-text-secondary tabular-nums flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {(table.players?.length ?? 0)}/
                    {table.maxSeats}
                  </span>
                  {/* Só mesa sem ninguém sentado (SPEC-20261027-2133); o servidor confere de novo (corrida entre aparelhos) */}
                  {seatedCount(table) === 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTable(table)}
                      aria-label={`Excluir a Mesa ${table.tableNumber}`}
                      title="Excluir mesa"
                      data-delete-table={table.tableNumber}
                      className="-my-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-accent-red-soft hover:text-accent-red-deep"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Segurar e arrastar (toque) ou arrastar (mouse) um jogador até outro lugar: vazio move, ocupado troca */}
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: table.maxSeats }, (_, i) => i + 1).map((seatNum) => {
                  const player = table.players?.find((p) => p.seatNumber === seatNum)
                  const isSource = !!drag && drag.source.tableId === table.id && drag.source.seatNumber === seatNum
                  const isTarget = !!drag?.target && drag.target.tableId === table.id && drag.target.seatNumber === seatNum
                  return (
                    <button
                      type="button"
                      key={seatNum}
                      data-seat={seatNum}
                      data-table-id={table.id}
                      data-seat-player={player?.id}
                      data-drop-target={isTarget ? (player ? 'swap' : 'move') : undefined}
                      onPointerDown={
                        player
                          ? (e) =>
                              seatDrag.onPointerDown(e, {
                                entryId: player.id,
                                name: shortName(player.id, player.name),
                                photo: player.photo,
                                tableId: table.id,
                                seatNumber: seatNum,
                              })
                          : undefined
                      }
                      onClick={() => {
                        // O clique que vem logo depois de soltar um arrasto não abre nada
                        if (seatDrag.consumeClick()) return
                        if (player) {
                          setMovePlayerEntry({
                            entryId: player.id,
                            name: player.name,
                            currentTableNumber: table.tableNumber,
                            currentSeat: seatNum,
                          })
                          setMoveToTableId(table.id)
                          setMoveToSeat('')
                        } else {
                          setAssignSeat({
                            tableId: table.id,
                            tableNumber: table.tableNumber,
                            seatNumber: seatNum,
                          })
                        }
                      }}
                      className={cn(
                        // select-none / sem o menu do toque longo: segurar é o começo do arrastar
                        'min-h-[44px] select-none rounded-lg p-2 text-center text-xs transition-colors cursor-pointer [-webkit-touch-callout:none]',
                        player
                          ? 'bg-accent-blue-soft border border-accent-blue/30 hover:bg-accent-blue/20'
                          : 'bg-bg-tertiary border border-dashed border-border-default hover:border-accent-blue/50 hover:bg-bg-secondary',
                        isSource && 'border-dashed border-accent-blue bg-bg-tertiary',
                        isTarget && (player
                          ? 'border-accent-gold bg-accent-gold-soft ring-2 ring-accent-gold'
                          : 'border-accent-blue bg-accent-blue-soft ring-2 ring-accent-blue'),
                      )}
                    >
                      <p className="text-text-secondary text-[10px]">
                        Posição {seatNum}
                      </p>
                      <p className="font-medium text-text-primary truncate">
                        {player?.name ?? '-'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Draw modal */}
      <Modal
        isOpen={showDrawModal}
        onClose={() => setShowDrawModal(false)}
        title={drawLabel}
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowDrawModal(false)}
              disabled={drawMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant={hasTables ? 'danger' : 'primary'}
              onClick={() => drawMutation.mutate()}
              loading={drawMutation.isPending}
            >
              <Shuffle className="h-4 w-4" />
              {hasTables ? 'Sim, sortear de novo' : 'Sortear'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {hasTables && (
            <div className="rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3 text-sm text-text-primary">
              ⚠️ Já existem {tables?.length} {tables?.length === 1 ? 'mesa' : 'mesas'}. Sortear de novo vai{' '}
              <strong>apagar todas as mesas atuais</strong> e sortear todos os jogadores do zero. A lotação escolhida
              passa a valer para as mesas abertas depois.
            </div>
          )}
          <div className="rounded-lg bg-bg-tertiary p-3 text-sm text-text-secondary">
            <p>
              Jogadores ativos:{' '}
              <strong className="text-text-primary">{activePlayerCount}</strong>
            </p>
            <p>
              Mesas calculadas:{' '}
              <strong className="text-text-primary">
                {calculatedTableCount}
              </strong>{' '}
              ({seatsNum} jogadores/mesa)
            </p>
          </div>
          <Input
            label="Jogadores por mesa"
            type="number"
            value={seatsPerTable}
            onChange={(e) => setSeatsPerTable(e.target.value)}
            min={2}
            max={12}
          />
          <Input
            label={`Número de mesas (vazio = ${calculatedTableCount})`}
            type="number"
            value={tableCount}
            onChange={(e) => setTableCount(e.target.value)}
            min={1}
            placeholder={String(calculatedTableCount)}
          />
        </div>
      </Modal>

      {/* Create table modal — formulário Cancelar + Criar: no celular, X/✓ no topo (SPEC-20261027-2132). "Sortear" e
          "Mover" têm verbo próprio e continuam escritos */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Criar Mesa"
        size="sm"
        submitAction={{
          label: 'Criar mesa',
          onClick: () => createTableMutation.mutate(),
          loading: createTableMutation.isPending,
        }}
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowCreateModal(false)}
              disabled={createTableMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createTableMutation.mutate()}
              loading={createTableMutation.isPending}
            >
              Criar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Número da mesa"
            type="number"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            min={1}
          />
          <Input
            label="Assentos"
            type="number"
            value={newTableSeats}
            onChange={(e) => setNewTableSeats(e.target.value)}
            min={2}
            max={10}
          />
        </div>
      </Modal>

      {/* Move player modal */}
      <Modal
        isOpen={!!movePlayerEntry}
        onClose={() => {
          setMovePlayerEntry(null)
          setMoveToTableId('')
          setMoveToSeat('')
        }}
        title="Mover Jogador"
        size="sm"
        footer={
          // Só Cancelar · Mover: cabe numa linha em 320 px (rodapé fixo baixo, sobra corpo com o teclado aberto).
          // "Remover da mesa" (destrutiva) fica no corpo, longe do Cancelar.
          movePlayerEntry && (
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setMovePlayerEntry(null)
                  setMoveToTableId('')
                  setMoveToSeat('')
                }}
                disabled={moveMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!moveToTableId || !moveToSeat) {
                    toast.error('Selecione a mesa e a posição.')
                    return
                  }
                  moveMutation.mutate({
                    entryId: movePlayerEntry.entryId,
                    toTableId: moveToTableId,
                    toSeat: parseInt(moveToSeat),
                  })
                }}
                loading={moveMutation.isPending}
              >
                Mover
              </Button>
            </div>
          )
        }
      >
        {movePlayerEntry && (
          <div className="flex flex-col gap-4">
            <PlayerConfirmHeader
              person={personOf(movePlayerEntry)}
              className="mb-0"
              detail={
                <>
                  Atualmente em:{' '}
                  <strong className="text-text-primary">
                    Mesa {movePlayerEntry.currentTableNumber}, Posição {movePlayerEntry.currentSeat}
                  </strong>
                </>
              }
            />

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">
                Mesa de destino
              </label>
              <select
                value={moveToTableId}
                onChange={(e) => {
                  setMoveToTableId(e.target.value)
                  setMoveToSeat('')
                }}
                className="w-full rounded-md border border-border-input bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
              >
                {tables?.map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.tableNumber}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">
                Posição de destino
              </label>
              <select
                value={moveToSeat}
                onChange={(e) => setMoveToSeat(e.target.value)}
                className="w-full rounded-md border border-border-input bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
              >
                <option value="">Selecione...</option>
                {(() => {
                  const targetTable = tables?.find((t) => t.id === moveToTableId)
                  if (!targetTable) return null
                  return Array.from(
                    { length: targetTable.maxSeats },
                    (_, i) => i + 1,
                  ).map((seatNum) => {
                    const occupied = targetTable.players?.find(
                      (p) =>
                        p.seatNumber === seatNum && p.id !== movePlayerEntry.entryId,
                    )
                    return (
                      <option key={seatNum} value={seatNum}>
                        Posição {seatNum}
                        {occupied ? ` (trocar com ${occupied.name})` : ''}
                      </option>
                    )
                  })
                })()}
              </select>
            </div>

            <div className="border-t border-border-default pt-3">
              <Button
                variant="ghost"
                className="w-full text-accent-red-deep hover:bg-accent-red-soft hover:text-accent-red-deep"
                onClick={() => setConfirmUnseat(true)}
                loading={unseatMutation.isPending}
                disabled={moveMutation.isPending || unseatMutation.isPending}
              >
                Remover da mesa
              </Button>
              <p className="mt-1 text-center text-xs text-text-secondary">
                O jogador continua no torneio, só fica sem lugar.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign player to empty seat modal */}
      <Modal
        isOpen={!!assignSeat}
        onClose={() => setAssignSeat(null)}
        title="Atribuir Jogador ao Assento"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setAssignSeat(null)}>
              Cancelar
            </Button>
          </div>
        }
      >
        {assignSeat && (() => {
          // Jogadores ativos SEM mesa
          const playersWithoutTable = entries.filter(
            (e) =>
              (e.status === 'Active' || e.status === 'Registered') && !e.tableId,
          )
          return (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-bg-tertiary p-3 text-sm text-text-secondary">
                Mesa {assignSeat.tableNumber}, Posição {assignSeat.seatNumber}
              </div>

              {playersWithoutTable.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-4">
                  Nenhum jogador ativo sem mesa.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {playersWithoutTable.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        moveMutation.mutate({
                          entryId: entry.id,
                          toTableId: assignSeat.tableId,
                          toSeat: assignSeat.seatNumber,
                        })
                        setAssignSeat(null)
                      }}
                      className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-bg-tertiary"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {entry.person.nickname ?? entry.person.fullName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Excluir mesa vazia (SPEC-20261027-2133) */}
      <ConfirmDialog
        isOpen={!!confirmDeleteTable}
        onClose={() => setConfirmDeleteTable(null)}
        onConfirm={() => {
          if (confirmDeleteTable) deleteTableMutation.mutate(confirmDeleteTable)
        }}
        title={`Excluir a Mesa ${confirmDeleteTable?.tableNumber ?? ''}?`}
        message={`A mesa sai do painel, do telão e do terminal do dealer.${
          confirmDeleteTable?.dealerName ? ` O dealer ${confirmDeleteTable.dealerName} fica livre.` : ''
        } Dá para criar de novo pelo "Criar Mesa".`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteTableMutation.isPending}
      />

      {/* Fantasma de quem está sendo arrastado: segue o dedo/mouse, acima dele (o dedo não cobre), sempre dentro da tela */}
      {drag && (
        <SeatDragGhost x={drag.x} y={drag.y}>
          <Avatar src={drag.source.photo} name={drag.source.name} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-text-primary">{drag.source.name}</span>
            <span className="flex items-center gap-1 truncate text-xs text-text-secondary">
              {!drag.target ? (
                'Solte num lugar'
              ) : dragOther ? (
                <>
                  <ArrowRightLeft className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Trocar com {shortName(dragOther.id, dragOther.name)}
                </>
              ) : (
                `Mesa ${tableNumberOf(drag.target.tableId) ?? ''}, lugar ${drag.target.seatNumber}`
              )}
            </span>
          </span>
        </SeatDragGhost>
      )}

      <ConfirmDialog
        isOpen={confirmUnseat && !!movePlayerEntry}
        onClose={() => setConfirmUnseat(false)}
        onConfirm={() => {
          if (movePlayerEntry) unseatMutation.mutate(movePlayerEntry.entryId)
        }}
        title="Remover da Mesa"
        header={movePlayerEntry && <PlayerConfirmHeader person={personOf(movePlayerEntry)} />}
        message={`Remover ${movePlayerEntry?.name ?? ''} da mesa? Ele continua ativo, mas sem assento.`}
        confirmLabel="Remover"
        variant="danger"
        loading={unseatMutation.isPending}
      />
    </div>
  )
}
