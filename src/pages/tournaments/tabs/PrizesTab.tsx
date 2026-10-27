import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trophy, Calculator, Crosshair, Lock, Medal, Plus, Minus } from 'lucide-react'
import * as prizesApi from '../../../api/prizes.api'
import type { PrizeItem } from '../../../api/prizes.api'
import { Button } from '../../../components/ui/Button'
import type { Tournament } from '../../../types/tournament.types'
import type { TournamentEntry } from '../../../types/entry.types'
import { bountyToReceive, isKnockout, keepsOwnHead } from '../../../utils/knockout'

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

/** Texto do estado neutro (SPEC-20261026-1907): prize pool ≤ 0 no começo do torneio não é erro. */
const PRIZE_POOL_WAITING_TEXT = 'A premiação aparece quando a arrecadação passar dos custos.'

/**
 * Aba Premiação. SPEC-20261026-1907: com o prize pool líquido zero ou negativo (custos maiores que a arrecadação
 * até agora — torneio recém-criado com custos padrão) a API devolve os totais sem distribuição e a aba mostra um
 * texto neutro no lugar da tabela, sem toast de erro; quando a arrecadação muda (inscrição, pagamento, custo), a
 * aba recalcula sozinha e volta ao normal assim que o líquido fica positivo.
 */
export function PrizesTab({ tournament, entries }: PrizesTabProps) {
  const queryClient = useQueryClient()
  const [numWinners, setNumWinners] = useState(3)
  const [prizes, setPrizes] = useState<PrizeItem[]>([])
  const [calculation, setCalculation] = useState<{
    grossPrizePool: number
    totalCosts: number
    netPrizePool: number
    /** Knockout (SPEC-20261026-1909): bounties à parte — o líquido já vem sem eles */
    totalBounties: number
  } | null>(null)

  // Toasts: 'user' (Recalcular, +/− posição) avisa sucesso e erro; 'open' (ao abrir a aba) só o erro; 'background'
  // (recálculo automático do estado neutro) nenhum — prize pool ≤ 0 não é erro e não vira toast em nenhum caso
  const calculateMutation = useMutation({
    mutationFn: (vars: { count: number; mode?: 'user' | 'open' | 'background' }) =>
      prizesApi.calculate(tournament.id, vars.count),
    onSuccess: (data, vars) => {
      setPrizes(data.prizes)
      setCalculation({
        grossPrizePool: data.grossPrizePool,
        totalCosts: data.totalCosts,
        netPrizePool: data.netPrizePool,
        totalBounties: data.totalBounties ?? 0,
      })
      if ((vars.mode ?? 'user') === 'user' && data.netPrizePool > 0) toast.success('Premiação calculada!')
      // Arrecadação/custos mudaram por fora (o cálculo é a leitura mais nova): relê o torneio para o cabeçalho
      // do painel (Jogadores, Premiação) acompanhar o que a aba mostra
      if (data.grossPrizePool !== tournament.totalPrizePool || data.totalCosts !== tournament.totalCosts) {
        void queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
        void queryClient.invalidateQueries({ queryKey: ['entries', tournament.id] })
      }
    },
    onError: (err: unknown, vars) => {
      if (vars.mode === 'background') return
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
        totalBounties: tournament.totalBounties ?? 0,
      })
    },
  })

  // Ao montar: se a premiação foi confirmada, lê os prêmios salvos; senão, calcula
  useEffect(() => {
    if (prizes.length > 0) return
    if (tournament.prizeConfirmed) {
      if (!savedMutation.isPending) savedMutation.mutate()
    } else if (!calculateMutation.isPending) {
      calculateMutation.mutate({ count: numWinners, mode: 'open' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Estado neutro: prize pool líquido ≤ 0 e premiação ainda não confirmada (nada a distribuir por enquanto)
  const currentNet = calculation?.netPrizePool ?? tournament.netPrizePool
  const waitingPool = !tournament.prizeConfirmed && currentNet <= 0

  // Arrecadação/custos mudaram (inscrição, pagamento, custo novo — o torneio é relido pelas outras abas ou ao voltar o foco):
  // no estado neutro recalcula sozinho, e a tabela aparece assim que o líquido fica positivo.
  const totalsKey = `${tournament.totalPrizePool}|${tournament.totalCosts}|${tournament.netPrizePool}|${tournament.totalEntries}|${tournament.totalBounties ?? 0}`
  const lastTotalsKey = useRef(totalsKey)
  useEffect(() => {
    if (lastTotalsKey.current === totalsKey) return
    lastTotalsKey.current = totalsKey
    if (waitingPool && !calculateMutation.isPending) {
      calculateMutation.mutate({ count: numWinners, mode: 'background' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalsKey])

  // Inscrição/pagamento feitos em outro aparelho (terminal do dealer) não avisam esta tela: enquanto espera a
  // arrecadação passar dos custos, a aba confere de novo a cada 10 s (para ao sair do estado neutro ou da aba)
  const { mutate: recalculate } = calculateMutation
  useEffect(() => {
    if (!waitingPool) return
    const timer = window.setInterval(() => recalculate({ count: numWinners, mode: 'background' }), 10_000)
    return () => window.clearInterval(timer)
  }, [waitingPool, numWinners, recalculate])

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
    calculateMutation.mutate({ count: newCount })
  }

  function removePrize(index: number) {
    const removed = prizes[index]
    if (!removed) return
    const newCount = Math.max(1, numWinners - 1)
    setNumWinners(newCount)
    calculateMutation.mutate({ count: newCount })
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
  // Quanto ainda falta arrecadar para cobrir os custos (só no estado neutro com líquido negativo)
  const missingToCover = waitingPool && currentNet < 0 ? -currentNet : 0

  // Knockout (SPEC-20261026-1909): bounties fora do prize pool e o acerto final (prêmio + bounties por jogador)
  const knockout = isKnockout(tournament)
  const totalBounties = knockout ? (calculation?.totalBounties ?? tournament.totalBounties ?? 0) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className={knockout ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-3 sm:grid-cols-3'}>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-secondary">Premiação Bruta</p>
          <p className="text-xl font-bold text-text-primary tabular-nums">
            {formatCurrency(calculation?.grossPrizePool ?? tournament.totalPrizePool)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-secondary">Custos</p>
          <p className="text-xl font-bold text-accent-red-deep tabular-nums">
            {formatCurrency(calculation?.totalCosts ?? tournament.totalCosts)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-secondary">Premiação Líquida</p>
          {/* Valor real, mesmo negativo (custos padrão antes das inscrições, SPEC-20261023-1215): negativo em vermelho */}
          <p
            className={`text-xl font-bold tabular-nums ${currentNet < 0 ? 'text-accent-red-deep' : 'text-accent-green-deep'}`}
          >
            {formatCurrency(currentNet)}
          </p>
        </div>
        {knockout && (
          <div className="rounded-lg bg-bg-primary p-4" data-prizes-bounties-card>
            <p className="text-xs text-text-secondary">Bounties (à parte)</p>
            <p className="text-xl font-bold text-accent-purple-deep tabular-nums">{formatCurrency(totalBounties)}</p>
          </div>
        )}
      </div>
      {knockout && (
        <p className="-mt-3 text-xs text-text-secondary">
          A premiação líquida não inclui os bounties: eles vão para quem eliminou (e o campeão fica com o próprio).
        </p>
      )}

      {/* Estado neutro (SPEC-20261026-1907): texto, não erro; some sozinho quando a arrecadação passa dos custos */}
      {waitingPool && (
        <div
          role="status"
          data-premiacao-neutra=""
          className="flex flex-col items-center gap-2 rounded-lg border border-border-default bg-bg-primary px-4 py-8 text-center"
        >
          <Trophy className="h-10 w-10 text-text-muted" aria-hidden="true" />
          <p className="text-text-primary">{PRIZE_POOL_WAITING_TEXT}</p>
          {missingToCover > 0 && (
            <p className="text-sm text-text-secondary">
              Faltam <span className="tabular-nums">{formatCurrency(missingToCover)}</span> de arrecadação para cobrir os custos.
            </p>
          )}
        </div>
      )}

      {/* Cálculo — disponível com prize pool positivo (ou premiação já confirmada); confirmar funciona como salvar */}
      {!waitingPool && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="premiacao-quantidade" className="text-sm font-medium text-text-secondary">
              Quantidade de premiados
            </label>
            <input
              id="premiacao-quantidade"
              type="number"
              value={numWinners}
              onChange={(e) => setNumWinners(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="w-32 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
            />
          </div>
          <Button
            onClick={() => calculateMutation.mutate({ count: numWinners })}
            loading={calculateMutation.isPending}
          >
            <Calculator className="h-4 w-4" />
            Recalcular
          </Button>
        </div>
      )}

      {/* Allocations table */}
      {!waitingPool && prizes.length > 0 && (
        <div>
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">
                    Posição
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary">
                    Valor (R$)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary">
                    %
                  </th>
                  {tournament.prizeConfirmed && (
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">
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
                                ? 'text-accent-gold-deep'
                                : prize.position === 2
                                  ? 'text-text-secondary'
                                  : prize.position === 3
                                    ? 'text-accent-orange-deep'
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
                          aria-label={`Valor do ${prize.position}º lugar`}
                          onChange={(e) =>
                            updatePrize(index, parseFloat(e.target.value) || 0)
                          }
                          className="w-32 rounded border border-border-input bg-bg-input px-2 py-1 text-right text-sm text-text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-border-focus"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary tabular-nums">
                        {prize.percentage.toFixed(1)}%
                      </td>
                      {tournament.prizeConfirmed && (
                        <td className="px-3 py-2">
                          {winner ? (
                            <span className="text-text-primary font-medium">
                              {winner.person.nickname ?? winner.person.fullName}
                            </span>
                          ) : (
                            <span className="text-text-secondary text-xs">
                              Aguardando
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removePrize(index)}
                          className="p-1 rounded text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
                          title="Remover"
                          aria-label={`Remover o ${prize.position}º lugar`}
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
              Adicionar posição
            </Button>
            <div className="text-text-secondary">
              Total: <strong className="text-text-primary tabular-nums">{formatCurrency(totalAlloc)}</strong>
              {Math.abs(diff) > 0.01 && (
                <span className={diff > 0 ? 'ml-3 text-accent-gold-deep tabular-nums' : 'ml-3 text-accent-red-deep tabular-nums'}>
                  {diff > 0
                    ? `Faltam ${formatCurrency(diff)}`
                    : `Excede ${formatCurrency(Math.abs(diff))}`}
                </span>
              )}
            </div>
          </div>

          {/* Confirmar = salvar (sempre disponível, inclusive após confirmar) */}
          <div className="flex items-center justify-between gap-3 mt-4">
            {tournament.prizeConfirmed ? (
              <span className="flex items-center gap-2 text-sm text-accent-green-deep">
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

      {knockout && (
        <KnockoutSettlement
          tournament={tournament}
          entries={entries}
          prizes={prizes}
          totalBounties={totalBounties}
        />
      )}

      {!waitingPool && prizes.length === 0 && !calculateMutation.isPending && !savedMutation.isPending && (
        <div className="text-center py-8">
          <Trophy className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Premiação ainda não calculada.</p>
          <p className="text-sm text-text-secondary mt-1">
            Clique em &quot;Recalcular&quot; para gerar a distribuição.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Acerto final do torneio knockout (SPEC-20261026-1909): por jogador, prêmio da posição + bounties a receber (o que
 * ganhou eliminando e, de quem não foi eliminado — o campeão —, a própria cabeça). Enquanto o torneio corre, as
 * cabeças de quem ainda joga ficam "em jogo". A conferência mostra que prêmios + bounties fecham com o prize pool
 * líquido + os bounties arrecadados.
 */
function KnockoutSettlement({
  tournament,
  entries,
  prizes,
  totalBounties,
}: {
  tournament: Tournament
  entries: TournamentEntry[]
  prizes: PrizeItem[]
  totalBounties: number
}) {
  const finished = tournament.status === 'Finished'
  const prizeOf = (e: TournamentEntry) => {
    if (!e.finalPosition) return 0
    const p = prizes.find((x) => x.position === e.finalPosition)
    return p ? p.amount : (e.prizeAmount ?? 0)
  }
  // Durante o jogo a cabeça de quem ainda joga não é de ninguém: só no fim (ou do campeão, já definido) entra no acerto
  const bountyOf = (e: TournamentEntry) =>
    finished || (e.finalPosition === 1 && !e.eliminatedAt) ? bountyToReceive(e) : (e.bountyWon ?? 0)
  const rows = entries
    .map((e) => ({ e, prize: prizeOf(e), bounty: bountyOf(e), ownHead: keepsOwnHead(e) && (finished || e.finalPosition === 1) }))
    .filter((r) => r.prize > 0 || r.bounty > 0)
    .sort((a, b) => (a.e.finalPosition ?? 999) - (b.e.finalPosition ?? 999) || b.prize + b.bounty - (a.prize + a.bounty))
  const sumPrize = rows.reduce((s, r) => s + r.prize, 0)
  const sumBounty = rows.reduce((s, r) => s + r.bounty, 0)
  const inPlay = Math.round(
    entries
      .filter((e) => !e.eliminatedAt && !(finished || e.finalPosition === 1))
      .reduce((s, e) => s + (e.bountyHead ?? 0), 0) * 100,
  ) / 100
  const bountyDiff = Math.round((totalBounties - sumBounty - inPlay) * 100) / 100

  return (
    <section className="rounded-lg border border-border-default bg-bg-primary p-4" data-acerto>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-secondary">
        <Crosshair className="h-4 w-4 text-accent-purple" aria-hidden />
        Acerto final: prêmio + bounties
      </h3>
      <p className="mb-3 text-xs text-text-secondary">
        {finished
          ? 'Quanto cada jogador recebe: o prêmio da posição mais os bounties (o campeão fica com a própria cabeça).'
          : 'Parcial: as cabeças de quem ainda joga vão para quem eliminar; o campeão fica com a dele no fim.'}
      </p>
      {rows.length === 0 ? (
        <p className="py-1 text-sm text-text-secondary">Ninguém tem prêmio ou bounty a receber ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-secondary">
                <th className="py-1.5 text-left font-medium">Jogador</th>
                <th className="py-1.5 text-right font-medium">Prêmio</th>
                <th className="py-1.5 text-right font-medium">Bounties</th>
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, prize, bounty, ownHead }) => (
                <tr key={e.id} className="border-t border-border-default" data-acerto-row={e.person.nickname ?? e.person.fullName}>
                  <td className="py-1.5 text-text-primary">
                    {e.finalPosition ? <span className="mr-1 tabular-nums text-text-secondary">{e.finalPosition}º</span> : null}
                    {e.person.nickname ?? e.person.fullName}
                    {ownHead && (
                      <span className="block text-xs text-accent-purple-deep">inclui a própria cabeça</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-text-primary" data-acerto-prize={prize}>
                    {prize > 0 ? formatCurrency(prize) : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-accent-purple-deep" data-acerto-bounty={bounty}>
                    {bounty > 0 ? formatCurrency(bounty) : '—'}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-text-primary" data-acerto-total={prize + bounty}>
                    {formatCurrency(prize + bounty)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-default font-semibold">
                <td className="py-1.5 text-text-primary">Total</td>
                <td className="py-1.5 text-right tabular-nums text-text-primary">{formatCurrency(sumPrize)}</td>
                <td className="py-1.5 text-right tabular-nums text-accent-purple-deep">{formatCurrency(sumBounty)}</td>
                <td className="py-1.5 text-right tabular-nums text-text-primary" data-acerto-sum={sumPrize + sumBounty}>
                  {formatCurrency(sumPrize + sumBounty)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs tabular-nums text-text-secondary" data-acerto-check>
        Bounties: {formatCurrency(sumBounty)} no acerto
        {inPlay > 0 ? ` + ${formatCurrency(inPlay)} em jogo` : ''} = {formatCurrency(sumBounty + inPlay)}
        {Math.abs(bountyDiff) > 0.005 ? (
          <span className="ml-1 font-semibold text-accent-red-deep">
            — diferença de {formatCurrency(Math.abs(bountyDiff))} para os {formatCurrency(totalBounties)} arrecadados
          </span>
        ) : (
          <span className="ml-1 font-semibold text-accent-green-deep">= bounties arrecadados</span>
        )}
      </p>
    </section>
  )
}
