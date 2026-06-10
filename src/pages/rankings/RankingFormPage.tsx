import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2, Calculator, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import * as rankingsApi from '../../api/rankings.api'
import * as homeGamesApi from '../../api/homeGames.api'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

// --- Formula evaluation ---

function evaluateFormula(
  formula: string,
  posicao: number,
  jogadores: number,
): number | null {
  try {
    const fn = new Function('posicao', 'jogadores', `return ${formula}`)
    const result = fn(posicao, jogadores) as unknown
    return typeof result === 'number' && isFinite(result)
      ? Math.round((result as number) * 100) / 100
      : null
  } catch {
    return null
  }
}

// --- Table row type ---

interface ScoringRow {
  position: number
  points: number
}

// --- Zod schema ---

const rankingSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  description: z.string().optional(),
})

type RankingFormData = z.infer<typeof rankingSchema>

// --- Component ---

export function RankingFormPage() {
  const { homeGameId, id } = useParams<{ homeGameId?: string; id?: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [initialized, setInitialized] = useState(!isEditing)

  // Scoring mode
  const [scoringMode, setScoringMode] = useState<'Formula' | 'Table'>('Formula')

  // Formula state
  const [formula, setFormula] = useState(
    'jogadores - posicao + 1 + (posicao === 1 ? 3 : posicao === 2 ? 2 : posicao === 3 ? 1 : 0)',
  )
  const [simulatedPlayers, setSimulatedPlayers] = useState(20)

  // Table state
  const [tableRows, setTableRows] = useState<ScoringRow[]>([
    { position: 1, points: 100 },
    { position: 2, points: 70 },
    { position: 3, points: 50 },
    { position: 4, points: 40 },
    { position: 5, points: 32 },
    { position: 6, points: 26 },
    { position: 7, points: 22 },
    { position: 8, points: 19 },
    { position: 9, points: 16 },
    { position: 10, points: 14 },
  ])

  // Accumulated prize (edição)
  const [accumulatedPrize, setAccumulatedPrize] = useState(0)
  const [discardCount, setDiscardCount] = useState(0)

  // Carregar ranking existente
  const { data: existingRanking } = useQuery({
    queryKey: ['ranking', id],
    queryFn: () => rankingsApi.getById(id!),
    enabled: isEditing,
  })

  // Determinar homeGameId real (do URL ou do ranking carregado)
  const effectiveHomeGameId = homeGameId || existingRanking?.homeGameId

  // Preencher form quando ranking carregar
  if (existingRanking && !initialized) {
    setScoringMode(existingRanking.scoringMode || 'Formula')
    setFormula(existingRanking.scoringFormula || '')
    if (existingRanking.scoringTable) {
      try {
        setTableRows(JSON.parse(existingRanking.scoringTable) as ScoringRow[])
      } catch { /* keep defaults */ }
    }
    setAccumulatedPrize(existingRanking.accumulatedPrize || 0)
    setDiscardCount(existingRanking.discardCount || 0)
    setInitialized(true)
  }

  const { data: homeGame } = useQuery({
    queryKey: ['homeGame', effectiveHomeGameId],
    queryFn: () => homeGamesApi.getById(effectiveHomeGameId!),
    enabled: !!effectiveHomeGameId,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RankingFormData>({
    resolver: zodResolver(rankingSchema),
    defaultValues: { name: '', description: '' },
    values: existingRanking
      ? { name: existingRanking.name, description: existingRanking.description ?? '' }
      : undefined,
  })

  // Formula simulation
  const simulation = useMemo(() => {
    if (scoringMode !== 'Formula' || !formula) return { rows: [], error: false }
    const rows: { position: number; points: number | null }[] = []
    let hasError = false
    const limit = Math.min(simulatedPlayers, 15)
    for (let i = 1; i <= limit; i++) {
      const result = evaluateFormula(formula, i, simulatedPlayers)
      if (result === null) hasError = true
      rows.push({ position: i, points: result })
    }
    return { rows, error: hasError }
  }, [formula, simulatedPlayers, scoringMode])

  // Table helpers
  function addTableRow() {
    const nextPos = tableRows.length > 0 ? Math.max(...tableRows.map((r) => r.position)) + 1 : 1
    const lastPoints = tableRows.length > 0 ? tableRows[tableRows.length - 1].points : 10
    setTableRows([...tableRows, { position: nextPos, points: Math.max(1, lastPoints - 2) }])
  }

  function removeTableRow(index: number) {
    setTableRows(tableRows.filter((_, i) => i !== index))
  }

  function updateTableRow(index: number, field: 'position' | 'points', value: number) {
    setTableRows(tableRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  async function onSubmit(data: RankingFormData) {
    if (!effectiveHomeGameId) return

    // Validar
    if (scoringMode === 'Formula' && !formula.trim()) {
      toast.error('Informe a formula de pontuacao.')
      return
    }
    if (scoringMode === 'Table' && tableRows.length === 0) {
      toast.error('Adicione pelo menos uma posicao na tabela.')
      return
    }
    if (scoringMode === 'Formula' && simulation.error) {
      toast.error('A formula contem erros. Corrija antes de salvar.')
      return
    }

    const payload = {
      name: data.name,
      description: data.description,
      scoringMode,
      scoringFormula: scoringMode === 'Formula' ? formula : undefined,
      scoringTable:
        scoringMode === 'Table' ? JSON.stringify(tableRows.sort((a, b) => a.position - b.position)) : undefined,
      accumulatedPrize: isEditing ? accumulatedPrize : undefined,
      discardCount,
    }

    setIsSubmitting(true)
    try {
      if (isEditing && id) {
        await rankingsApi.update(effectiveHomeGameId, id, payload)
        toast.success('Ranking atualizado com sucesso!')
      } else {
        await rankingsApi.create(effectiveHomeGameId, payload)
        toast.success('Ranking criado com sucesso!')
      }
      // B1: invalidar caches para a página de origem refletir a edição (ex.: prêmio acumulado)
      await queryClient.invalidateQueries({ queryKey: ['rankings'] })
      if (id) {
        await queryClient.invalidateQueries({ queryKey: ['ranking', id] })
        await queryClient.invalidateQueries({ queryKey: ['ranking-leaderboard', id] })
      }
      if (effectiveHomeGameId) {
        navigate(`/home-games/${effectiveHomeGameId}?tab=rankings`)
      } else {
        navigate(-1)
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 403) {
        toast.error('Sem permissao para criar ranking. Apenas admins e organizadores.')
      } else {
        toast.error(msg || 'Erro ao criar ranking. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-text-primary">
          {isEditing ? 'Editar Ranking' : 'Novo Ranking'}
        </h1>
        {homeGame && <p className="text-sm text-text-secondary mt-1">{homeGame.name}</p>}
      </div>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-6">
        {/* Info basica */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Informacoes</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Nome *"
              placeholder="Ex: 1o Semestre 2026"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Descricao"
              placeholder="Descricao do ranking"
              error={errors.description?.message}
              {...register('description')}
            />
          </div>
        </div>

        {/* Premio acumulado (só edição) */}
        {isEditing && (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Premio Acumulado</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted">R$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={accumulatedPrize}
                onChange={(e) => setAccumulatedPrize(Number(e.target.value))}
                className="w-40 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                placeholder="0,00"
              />
            </div>
            <p className="text-xs text-text-muted mt-2">
              Valor total acumulado dos torneios para premiacao deste ranking.
            </p>
          </div>
        )}

        {/* Descartes */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Descartes</h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              step={1}
              value={discardCount}
              onChange={(e) => setDiscardCount(Math.max(0, Number(e.target.value) || 0))}
              className="w-28 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
            />
            <span className="text-sm text-text-muted">piores resultados descartados por jogador</span>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Cada jogador pode descartar os N piores resultados ao calcular o total de pontos.
          </p>
        </div>

        {/* Modo de pontuacao */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Pontuacao</h2>

          {/* Tabs Formula / Tabela */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setScoringMode('Formula')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                scoringMode === 'Formula'
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              <Calculator className="h-4 w-4" />
              Formula
            </button>
            <button
              type="button"
              onClick={() => setScoringMode('Table')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                scoringMode === 'Table'
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              <Table2 className="h-4 w-4" />
              Por Posicao
            </button>
          </div>

          {/* Formula mode */}
          {scoringMode === 'Formula' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Formula *
                </label>
                <input
                  type="text"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="jogadores - posicao + 1"
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none font-mono"
                />
                <div className="mt-2 text-xs text-text-muted space-y-1">
                  <p>
                    Variaveis:{' '}
                    <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-text-secondary font-mono">
                      posicao
                    </code>{' '}
                    (posicao final) e{' '}
                    <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-text-secondary font-mono">
                      jogadores
                    </code>{' '}
                    (total de jogadores)
                  </p>
                  <p>Sintaxe JavaScript. Use operadores: +, -, *, /, Math.max(), Math.min(), Math.round()</p>
                  <p>
                    Condicionais:{' '}
                    <code className="bg-bg-tertiary px-1 py-0.5 rounded text-text-secondary font-mono text-[11px]">
                      posicao === 1 ? 100 : 50
                    </code>
                  </p>
                </div>
              </div>

              {/* Exemplos rapidos */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-2">Exemplos rapidos:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: 'Simples',
                      formula: 'jogadores - posicao + 1',
                    },
                    {
                      label: 'x10',
                      formula: '(jogadores - posicao + 1) * 10',
                    },
                    {
                      label: 'Com bonus top 3',
                      formula:
                        'jogadores - posicao + 1 + (posicao === 1 ? 3 : posicao === 2 ? 2 : posicao === 3 ? 1 : 0)',
                    },
                    {
                      label: 'Decrescente fixo',
                      formula: 'Math.max(0, 100 - (posicao - 1) * 10)',
                    },
                  ].map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setFormula(ex.formula)}
                      className="text-xs px-2.5 py-1.5 rounded-md bg-bg-tertiary text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue transition-colors"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulacao */}
              {formula && (
                <div className="border-t border-border-default pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-text-primary">
                      Simulacao ({simulatedPlayers} jogadores)
                    </h3>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={2}
                        max={100}
                        value={simulatedPlayers}
                        onChange={(e) => setSimulatedPlayers(Number(e.target.value))}
                        className="w-20 accent-accent-blue"
                      />
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={simulatedPlayers}
                        onChange={(e) =>
                          setSimulatedPlayers(Math.max(2, Math.min(100, Number(e.target.value))))
                        }
                        className="w-14 rounded-lg border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary text-center focus:border-border-focus focus:outline-none"
                      />
                    </div>
                  </div>

                  {simulation.error && (
                    <p className="text-xs text-accent-red mb-2">
                      Formula invalida. Verifique a sintaxe.
                    </p>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {simulation.rows.map((row) => (
                      <div
                        key={row.position}
                        className={`flex flex-col items-center rounded-lg p-2 ${
                          row.position <= 3 ? 'bg-yellow-500/10' : 'bg-bg-tertiary'
                        }`}
                      >
                        <span
                          className={`text-xs font-bold ${
                            row.position === 1
                              ? 'text-yellow-400'
                              : row.position === 2
                                ? 'text-gray-300'
                                : row.position === 3
                                  ? 'text-amber-600'
                                  : 'text-text-muted'
                          }`}
                        >
                          {row.position}º
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            row.points === null ? 'text-accent-red' : 'text-text-primary'
                          }`}
                        >
                          {row.points !== null ? row.points : 'ERR'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Table mode */}
          {scoringMode === 'Table' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_1fr_44px] gap-3 text-xs font-medium text-text-muted px-1">
                <span>Posicao</span>
                <span>Pontos</span>
                <span></span>
              </div>
              {tableRows.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_44px] gap-3 items-center">
                  <input
                    type="number"
                    min={1}
                    value={row.position}
                    onChange={(e) => updateTableRow(index, 'position', Number(e.target.value))}
                    className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    value={row.points}
                    onChange={(e) => updateTableRow(index, 'points', Number(e.target.value))}
                    className="rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeTableRow(index)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-accent-red hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addTableRow} className="w-fit">
                <Plus className="h-4 w-4" />
                Adicionar Posicao
              </Button>
              <p className="text-xs text-text-muted mt-1">
                Posicoes nao listadas recebem 0 pontos. Ordene da 1a posicao para baixo.
              </p>
            </div>
          )}
        </div>

        {/* Acoes */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar' : 'Criar Ranking'}
          </Button>
        </div>
      </form>
    </div>
  )
}
