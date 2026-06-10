import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trophy, Calculator, Lock, Medal, Plus, Minus } from 'lucide-react'
import * as prizesApi from '../../../api/prizes.api'
import type { PrizeItem } from '../../../api/prizes.api'
import { Button } from '../../../components/ui/Button'
import type { Tournament } from '../../../types/tournament.types'
import type { TournamentEntry } from '../../../types/entry.types'

interface PrizesTabProps {
  tournament: Tournament
  entries: TournamentEntry[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function PrizesTab({ tournament, entries }: PrizesTabProps) {
  const queryClient = useQueryClient()
  const [numWinners, setNumWinners] = useState(3)
  const [prizes, setPrizes] = useState<PrizeItem[]>([])
  const [calculation, setCalculation] = useState<{
    grossPrizePool: number
    totalCosts: number
    netPrizePool: number
  } | null>(null)

  const calculateMutation = useMutation({
    mutationFn: (count: number) => prizesApi.calculate(tournament.id, count),
    onSuccess: (data) => {
      setPrizes(data.prizes)
      setCalculation({
        grossPrizePool: data.grossPrizePool,
        totalCosts: data.totalCosts,
        netPrizePool: data.netPrizePool,
      })
      toast.success('Premiação calculada!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      toast.error(msg || 'Erro ao calcular premiação.')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () =>
      prizesApi.confirm(
        tournament.id,
        prizes.map((p) => ({ position: p.position, amount: p.amount })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      toast.success('Premiação salva!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      toast.error(msg || 'Erro ao confirmar premiação.')
    },
  })

  // Carregar prêmios SALVOS quando a premiação já foi confirmada (em vez de recalcular)
  const savedMutation = useMutation({
    mutationFn: () => prizesApi.getSaved(tournament.id),
    onSuccess: (data) => {
      setPrizes(
        data.map((p) => ({
          position: p.position,
          amount: p.amount,
          percentage: p.percentage,
        })),
      )
      setCalculation({
        grossPrizePool: tournament.totalPrizePool,
        totalCosts: tournament.totalCosts,
        netPrizePool: tournament.netPrizePool,
      })
    },
  })

  // Ao montar: se a premiação foi confirmada, lê os prêmios salvos; senão, calcula
  useEffect(() => {
    if (prizes.length > 0) return
    if (tournament.prizeConfirmed) {
      if (!savedMutation.isPending) savedMutation.mutate()
    } else if (!calculateMutation.isPending) {
      calculateMutation.mutate(numWinners)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updatePrize(index: number, newAmount: number) {
    const netPool = calculation?.netPrizePool ?? 0
    setPrizes((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              amount: newAmount,
              percentage: netPool > 0 ? (newAmount / netPool) * 100 : 0,
            }
          : p,
      ),
    )
  }

  function addPrize() {
    const newCount = numWinners + 1
    setNumWinners(newCount)
    calculateMutation.mutate(newCount)
  }

  function removePrize(index: number) {
    const removed = prizes[index]
    if (!removed) return
    const newCount = Math.max(1, numWinners - 1)
    setNumWinners(newCount)
    calculateMutation.mutate(newCount)
  }

  // Eliminados ordenados por posição
  const eliminatedPlayers = entries
    .filter(
      (e) =>
        (e.status === 'Eliminated' || e.status === 'Awarded') && e.finalPosition,
    )
    .sort((a, b) => (a.finalPosition ?? 99) - (b.finalPosition ?? 99))

  // Validação: soma dos prêmios x prize pool
  const totalAlloc = prizes.reduce((s, p) => s + p.amount, 0)
  const netPool = calculation?.netPrizePool ?? 0
  const diff = netPool - totalAlloc

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-muted">Premiação Bruta</p>
          <p className="text-xl font-bold text-text-primary">
            {formatCurrency(calculation?.grossPrizePool ?? tournament.totalPrizePool)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-muted">Custos</p>
          <p className="text-xl font-bold text-accent-red">
            {formatCurrency(calculation?.totalCosts ?? tournament.totalCosts)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-muted">Premiação Líquida</p>
          <p className="text-xl font-bold text-accent-green">
            {formatCurrency(calculation?.netPrizePool ?? tournament.netPrizePool)}
          </p>
        </div>
      </div>

      {/* Calculo — sempre disponivel; confirmar funciona como salvar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">
            Quantidade de premiados
          </label>
          <input
            type="number"
            value={numWinners}
            onChange={(e) => setNumWinners(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="w-32 rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
          />
        </div>
        <Button
          onClick={() => calculateMutation.mutate(numWinners)}
          loading={calculateMutation.isPending}
        >
          <Calculator className="h-4 w-4" />
          Recalcular
        </Button>
      </div>

      {/* Allocations table */}
      {prizes.length > 0 && (
        <div>
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    Posição
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">
                    Valor (R$)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">
                    %
                  </th>
                  {tournament.prizeConfirmed && (
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                      Vencedor
                    </th>
                  )}
                  <th className="px-3 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {prizes.map((prize, index) => {
                  const winner = eliminatedPlayers.find(
                    (e) => e.finalPosition === prize.position,
                  )
                  return (
                    <tr
                      key={prize.position}
                      className="border-t border-border-default"
                    >
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <Medal
                            className={`h-4 w-4 ${
                              prize.position === 1
                                ? 'text-yellow-400'
                                : prize.position === 2
                                  ? 'text-gray-300'
                                  : prize.position === 3
                                    ? 'text-orange-400'
                                    : 'text-text-muted'
                            }`}
                          />
                          {prize.position}º
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="50"
                          value={prize.amount}
                          onChange={(e) =>
                            updatePrize(index, parseFloat(e.target.value) || 0)
                          }
                          className="w-32 rounded border border-border-default bg-bg-input px-2 py-1 text-right text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-text-muted">
                        {prize.percentage.toFixed(1)}%
                      </td>
                      {tournament.prizeConfirmed && (
                        <td className="px-3 py-2">
                          {winner ? (
                            <span className="text-text-primary font-medium">
                              {winner.person.nickname ?? winner.person.fullName}
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs">
                              Aguardando
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removePrize(index)}
                          className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remover"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Total + diff */}
          <div className="mt-2 flex items-center justify-between text-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addPrize}
            >
              <Plus className="h-4 w-4" />
              Adicionar posicao
            </Button>
            <div className="text-text-secondary">
              Total: <strong className="text-text-primary">{formatCurrency(totalAlloc)}</strong>
              {Math.abs(diff) > 0.01 && (
                <span className={diff > 0 ? 'ml-3 text-yellow-400' : 'ml-3 text-red-400'}>
                  {diff > 0
                    ? `Faltam ${formatCurrency(diff)}`
                    : `Excede ${formatCurrency(Math.abs(diff))}`}
                </span>
              )}
            </div>
          </div>

          {/* Confirmar = salvar (sempre disponivel, inclusive apos confirmar) */}
          <div className="flex items-center justify-between gap-3 mt-4">
            {tournament.prizeConfirmed ? (
              <span className="flex items-center gap-2 text-sm text-accent-green">
                <Lock className="h-4 w-4" />
                Premiação confirmada — pode editar e salvar de novo
              </span>
            ) : (
              <span />
            )}
            <Button
              variant="success"
              onClick={() => confirmMutation.mutate()}
              loading={confirmMutation.isPending}
              disabled={Math.abs(diff) > 0.01}
            >
              <Lock className="h-4 w-4" />
              {tournament.prizeConfirmed ? 'Salvar Premiação' : 'Confirmar Premiação'}
            </Button>
          </div>
        </div>
      )}

      {prizes.length === 0 && !calculateMutation.isPending && (
        <div className="text-center py-8">
          <Trophy className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Premiação ainda não calculada.</p>
          <p className="text-sm text-text-muted mt-1">
            Clique em &quot;Calcular Premiação&quot; para gerar a distribuição.
          </p>
        </div>
      )}
    </div>
  )
}
