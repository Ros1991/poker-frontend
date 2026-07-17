import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LayoutGrid, Shuffle, Plus, Users } from 'lucide-react'
import * as tablesApi from '../../../api/tables.api'
import type { Table } from '../../../api/tables.api'
import * as tournamentDealersApi from '../../../api/tournamentDealers.api'
import * as entriesApi from '../../../api/entries.api'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Input } from '../../../components/ui/Input'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import type { Tournament } from '../../../types/tournament.types'

interface TablesTabProps {
  tournament: Tournament
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
  // Dealers selecionados para cada mesa (index = mesa - 1)
  const [drawDealers, setDrawDealers] = useState<(string | null)[]>([])
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
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null)

  const {
    data: tables,
    isLoading,
  } = useQuery({
    queryKey: ['tables', tournament.id],
    queryFn: () => tablesApi.getAll(tournament.id),
  })

  const { data: dealers = [] } = useQuery({
    queryKey: ['tournamentDealers', tournament.id],
    queryFn: () => tournamentDealersApi.getAll(tournament.id),
  })

  const { data: entries = [] } = useQuery({
    queryKey: ['entries', tournament.id],
    queryFn: () => entriesApi.getAll(tournament.id),
  })

  const activePlayerCount = entries.filter((e) => e.status === 'Active' || e.status === 'Registered').length
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

  const setDealerMutation = useMutation({
    mutationFn: (vars: { tableId: string; dealerPersonId: string | null }) =>
      tablesApi.setDealer(tournament.id, vars.tableId, vars.dealerPersonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
      toast.success('Dealer atualizado!')
    },
    onError: () => toast.error('Erro ao atualizar dealer.'),
  })

  const drawMutation = useMutation({
    mutationFn: async () => {
      const drawnTables = await tablesApi.draw(tournament.id, {
        tableCount: tableCount ? parseInt(tableCount) : calculatedTableCount,
        maxSeatsPerTable: seatsNum,
      })

      const sorted = Array.isArray(drawnTables)
        ? [...drawnTables].sort((a, b) => a.tableNumber - b.tableNumber)
        : []

      // Sortear dealers automaticamente para mesas sem dealer escolhido
      const availableDealers = [...dealers]
      const finalDealers: (string | null)[] = sorted.map((_, idx) => {
        const chosen = drawDealers[idx]
        if (chosen) {
          // Remove o dealer escolhido da lista de disponiveis
          const i = availableDealers.findIndex((d) => d.personId === chosen)
          if (i >= 0) availableDealers.splice(i, 1)
          return chosen
        }
        return null
      })

      // Para mesas sem dealer escolhido, sortear dos restantes
      finalDealers.forEach((d, idx) => {
        if (d === null && availableDealers.length > 0) {
          const randomIdx = Math.floor(Math.random() * availableDealers.length)
          const picked = availableDealers.splice(randomIdx, 1)[0]
          finalDealers[idx] = picked.personId
        }
      })

      // Atribuir dealers as mesas
      await Promise.all(
        sorted.map(async (table, idx) => {
          const dealerId = finalDealers[idx]
          if (dealerId) {
            try {
              await tablesApi.setDealer(tournament.id, table.id, dealerId)
            } catch {
              // ignora erro individual de dealer
            }
          }
        }),
      )

      return drawnTables
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] })
      toast.success('Mesas sorteadas com sucesso!')
      setShowDrawModal(false)
      setDrawDealers([])
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
          <Button size="sm" onClick={() => setShowDrawModal(true)}>
            <Shuffle className="h-4 w-4" />
            Sortear Mesas
          </Button>
        </div>
      </div>

      {imbalance && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <Users className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">Mesas desbalanceadas</p>
            <p className="text-text-secondary">
              Mova {imbalance.move} jogador(es) da Mesa {imbalance.from} para a
              Mesa {imbalance.to}.
            </p>
          </div>
        </div>
      )}

      {(!tables || tables.length === 0) && (
        <div className="text-center py-12">
          <LayoutGrid className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Nenhuma mesa criada ainda.</p>
          <p className="text-sm text-text-muted mt-1">
            Use &quot;Sortear Mesas&quot; para distribuir os jogadores.
          </p>
        </div>
      )}

      {tables && tables.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table: Table) => (
            <div
              key={table.id}
              className="rounded-xl border border-border-default bg-bg-primary p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary">
                  Mesa {table.tableNumber}
                </h3>
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {(table.players?.length ?? 0)}/
                  {table.maxSeats}
                </span>
              </div>

              <div className="mb-3">
                <label className="text-xs text-text-muted">Dealer</label>
                <select
                  className="w-full mt-1 rounded-md border border-border-default bg-bg-secondary p-2 text-sm text-text-primary"
                  value={table.dealerPersonId ?? ''}
                  onChange={(e) =>
                    setDealerMutation.mutate({
                      tableId: table.id,
                      dealerPersonId: e.target.value || null,
                    })
                  }
                >
                  <option value="">Sem dealer</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.personId}>
                      {d.nickname ?? d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: table.maxSeats }, (_, i) => i + 1).map((seatNum) => {
                  const player = table.players?.find((p) => p.seatNumber === seatNum)
                  return (
                    <button
                      type="button"
                      key={seatNum}
                      draggable={!!player}
                      onDragStart={() => player && setDraggedEntryId(player.id)}
                      onDragEnd={() => setDraggedEntryId(null)}
                      onDragOver={(e) => {
                        if (draggedEntryId) e.preventDefault()
                      }}
                      onDrop={() => {
                        if (draggedEntryId && draggedEntryId !== player?.id) {
                          moveMutation.mutate({
                            entryId: draggedEntryId,
                            toTableId: table.id,
                            toSeat: seatNum,
                          })
                        }
                        setDraggedEntryId(null)
                      }}
                      onClick={() => {
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
                      className={`rounded-lg p-2 text-center text-xs transition-colors cursor-pointer ${
                        player
                          ? 'bg-accent-blue/10 border border-accent-blue/30 hover:bg-accent-blue/20'
                          : 'bg-bg-tertiary border border-dashed border-border-default hover:border-accent-blue/50 hover:bg-bg-secondary'
                      }`}
                    >
                      <p className="text-text-muted text-[10px]">
                        Posicao {seatNum}
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
        title="Sortear Mesas"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {tables && tables.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-300">
              ⚠️ Já existem {tables.length} mesa(s). Sortear novamente vai{' '}
              <strong>apagar todas as mesas atuais</strong> e re-sortear todos os jogadores do zero.
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
            label={`Numero de mesas (vazio = ${calculatedTableCount})`}
            type="number"
            value={tableCount}
            onChange={(e) => setTableCount(e.target.value)}
            min={1}
            placeholder={String(calculatedTableCount)}
          />

          {/* Selecionar dealers para cada mesa (opcional) */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">
              Dealers das mesas (opcional)
            </label>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {Array.from(
                { length: tableCount ? parseInt(tableCount) : calculatedTableCount },
                (_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted w-14 shrink-0">
                      Mesa {idx + 1}
                    </span>
                    <select
                      value={drawDealers[idx] ?? ''}
                      onChange={(e) => {
                        const newDealers = [...drawDealers]
                        newDealers[idx] = e.target.value || null
                        setDrawDealers(newDealers)
                      }}
                      className="flex-1 rounded-md border border-border-default bg-bg-secondary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                    >
                      <option value="">Sem dealer</option>
                      {dealers.map((d) => (
                        <option key={d.id} value={d.personId}>
                          {d.nickname ?? d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
              )}
            </div>
            {dealers.length === 0 && (
              <p className="text-xs text-text-muted mt-1">
                Nenhum dealer cadastrado neste torneio.
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowDrawModal(false)}
              disabled={drawMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => drawMutation.mutate()}
              loading={drawMutation.isPending}
            >
              <Shuffle className="h-4 w-4" />
              Sortear
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create table modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Criar Mesa"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Numero da mesa"
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
      >
        {movePlayerEntry && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-bg-tertiary p-3 text-sm text-text-secondary">
              <p>
                Jogador:{' '}
                <strong className="text-text-primary">{movePlayerEntry.name}</strong>
              </p>
              <p>
                Atualmente em:{' '}
                <strong className="text-text-primary">
                  Mesa {movePlayerEntry.currentTableNumber}, Posicao {movePlayerEntry.currentSeat}
                </strong>
              </p>
            </div>

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
                className="w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
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
                Posicao de destino
              </label>
              <select
                value={moveToSeat}
                onChange={(e) => setMoveToSeat(e.target.value)}
                className="w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
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
                        Posicao {seatNum}
                        {occupied ? ` (trocar com ${occupied.name})` : ''}
                      </option>
                    )
                  })
                })()}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="danger"
                onClick={() => setConfirmUnseat(true)}
                loading={unseatMutation.isPending}
              >
                Remover da mesa
              </Button>
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
                    toast.error('Selecione mesa e posicao.')
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
          </div>
        )}
      </Modal>

      {/* Assign player to empty seat modal */}
      <Modal
        isOpen={!!assignSeat}
        onClose={() => setAssignSeat(null)}
        title="Atribuir Jogador ao Assento"
        size="sm"
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
                Mesa {assignSeat.tableNumber}, Posicao {assignSeat.seatNumber}
              </div>

              {playersWithoutTable.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">
                  Nenhum jogador ativo sem mesa.
                </p>
              ) : (
                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
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

              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setAssignSeat(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      <ConfirmDialog
        isOpen={confirmUnseat && !!movePlayerEntry}
        onClose={() => setConfirmUnseat(false)}
        onConfirm={() => {
          if (movePlayerEntry) unseatMutation.mutate(movePlayerEntry.entryId)
        }}
        title="Remover da Mesa"
        message={`Remover ${movePlayerEntry?.name ?? ''} da mesa? Ele continua ativo, mas sem assento.`}
        confirmLabel="Remover"
        variant="danger"
        loading={unseatMutation.isPending}
      />
    </div>
  )
}
