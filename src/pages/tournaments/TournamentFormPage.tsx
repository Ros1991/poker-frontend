import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Minus, Plus } from 'lucide-react'
import * as tournamentsApi from '../../api/tournaments.api'
import * as homeGamesApi from '../../api/homeGames.api'
import * as rankingsApi from '../../api/rankings.api'
import * as blindStructuresApi from '../../api/blindStructures.api'
import * as costExtrasApi from '../../api/costExtras.api'
import { COST_TYPE_DEFAULT } from '../../types/costExtra.types'
import { isPlanLimitError } from '../../api/client'
import { hasFeature, MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PixKeyInput } from '../../components/pix/PixKeyInput'
import { checkPixKey, toPixKeyPayload, type PixKeyType } from '../../utils/pix'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { tournamentDashboardPath } from '../../constants/routes'

const tournamentSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  date: z.string().min(1, 'Data obrigatória'),
  rankingId: z.string().optional(),
  blindStructureId: z.string().optional(),
  buyInAmount: z.coerce.number().min(0, 'Valor inválido'),
  rebuyAmount: z.coerce.number().min(0, 'Valor inválido'),
  addonAmount: z.coerce.number().min(0, 'Valor inválido'),
  startingStack: z.coerce.number().min(1, 'Stack inválido'),
  rebuyStack: z.coerce.number().min(0, 'Valor inválido'),
  addonStack: z.coerce.number().min(0, 'Valor inválido'),
  maxRebuys: z.coerce.number().min(0, 'Valor inválido'),
  addonAllowed: z.boolean(),
  addonDoubleAllowed: z.boolean(),
  seatsPerTable: z.coerce.number().min(2, 'Mínimo 2').max(12, 'Máximo 12'),
  responsiblePixKey: z.string().optional(),
  staffAmount: z.coerce.number().min(0, 'Valor inválido'),
  rankingContribMode: z.enum(['PerPlayer', 'Percent']),
  rankingContribValue: z.coerce.number().min(0, 'Valor inválido'),
})

type TournamentFormData = z.infer<typeof tournamentSchema>

/** Mesmo limite do backend (TournamentService.MaxDealerCount). */
const MAX_DEALERS = 20

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function TournamentFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const queryClient = useQueryClient()

  // Modo edicao: /tournaments/:id/edit (id e o tournamentId)
  // Modo criacao: /home-games/:id/tournaments/new (id e o homeGameId)
  const isEditMode = location.pathname.endsWith('/edit')
  const tournamentId = isEditMode ? id : undefined

  // Em modo criacao, homeGameId vem da URL. Em edicao, virá do torneio carregado.
  const { data: existingTournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId!),
    enabled: !!tournamentId,
  })

  const homeGameId = isEditMode ? existingTournament?.homeGameId : id

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<TournamentFormData>({
    resolver: zodResolver(tournamentSchema) as Resolver<TournamentFormData>,
    defaultValues: {
      name: '',
      date: '',
      rankingId: '',
      blindStructureId: '',
      buyInAmount: 0,
      rebuyAmount: 0,
      addonAmount: 0,
      startingStack: 0,
      rebuyStack: 0,
      addonStack: 0,
      maxRebuys: 0,
      addonAllowed: true,
      addonDoubleAllowed: false,
      seatsPerTable: 9,
      responsiblePixKey: '',
      staffAmount: 0,
      rankingContribMode: 'PerPlayer',
      rankingContribValue: 0,
    },
  })

  const selectedBlindStructureId = watch('blindStructureId')
  // PIX do dia (SPEC-20261023-1218): texto do campo no form; o tipo escolhido (null = automático) fica aqui
  const pixKeyValue = watch('responsiblePixKey') ?? ''
  const [pixKeyType, setPixKeyType] = useState<PixKeyType | null>(null)
  // Em modo edicao, nao queremos sobrescrever os valores carregados quando
  // o formulario faz reset() com o blindStructureId original. Guardamos esse
  // id inicial para ignorar a primeira execucao do prefill.
  const initialLoadedStructureIdRef = useRef<string | null>(null)

  // Home game info (para mostrar o nome)
  const { data: homeGame } = useQuery({
    queryKey: ['homeGame', homeGameId],
    queryFn: () => homeGamesApi.getById(homeGameId!),
    enabled: !!homeGameId,
  })

  // Recursos do plano do DONO do home game (SPEC-20261023-1205). Só decide com o home game
  // carregado: sem Payments somem staff, contribuição/ranking e PIX do dia (no Mesa o torneio não
  // cria custos automáticos — D3); sem Rankings a lista nem é consultada (daria 402); sem Tables
  // some "Jogadores por mesa".
  const planKnown = !!homeGame
  const canPay = planKnown && hasFeature(homeGame?.planFeatures, 'Payments')
  const canRank = planKnown && hasFeature(homeGame?.planFeatures, 'Rankings')
  const canTables = planKnown && hasFeature(homeGame?.planFeatures, 'Tables')
  // Custos padrão da estrutura e custo de dealer só com CostExtras (no Mesa o backend não copia nada)
  const canCosts = planKnown && hasFeature(homeGame?.planFeatures, 'CostExtras')
  const showRanking = canPay && canRank
  // "Quantos dealers neste torneio?" (SPEC-20261023-1215): de 0 a 20, começa em 1
  const [dealerCount, setDealerCount] = useState(1)

  // Rankings do home game
  const { data: rankings } = useQuery({
    queryKey: ['rankings', homeGameId],
    queryFn: () => rankingsApi.getAll(homeGameId!),
    enabled: !!homeGameId && canRank,
  })

  // Estruturas do home game (+ globais)
  const { data: blindStructures } = useQuery({
    queryKey: ['blindStructures', homeGameId],
    queryFn: () => blindStructuresApi.getAll({ homeGameId }),
    enabled: !!homeGameId,
  })

  // Custos padrão da estrutura escolhida (SPEC-20261023-1215). Na criação todos entram (prévia só leitura);
  // na edição só no caso "rascunho sem estrutura recebe a primeira" e se o torneio ainda não tem custo Padrão
  // (o backend aplica a mesma regra); trocar de estrutura não mexe nos custos já lançados.
  const selectedStructure = blindStructures?.find((bs) => bs.id === selectedBlindStructureId)
  const hadNoStructure = isEditMode && !!existingTournament && !existingTournament.blindStructureId
  const { data: existingCosts } = useQuery({
    queryKey: ['costExtras', tournamentId],
    queryFn: () => costExtrasApi.getAll(tournamentId!),
    enabled: hadNoStructure && canCosts && !!tournamentId,
  })
  const alreadyHasDefaults = (existingCosts ?? []).some((c) => c.costType === COST_TYPE_DEFAULT)
  const structureCosts = [...(selectedStructure?.defaultCosts ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )
  const structureDealerFee =
    selectedStructure?.defaultHasDealer && (selectedStructure.defaultDealerFee ?? 0) > 0
      ? (selectedStructure.defaultDealerFee as number)
      : null
  const defaultsApply =
    canCosts &&
    !!selectedStructure &&
    (!isEditMode || (hadNoStructure && existingCosts !== undefined && !alreadyHasDefaults))
  const showDefaultsPreview = defaultsApply && (structureCosts.length > 0 || structureDealerFee != null)
  const askDealers = defaultsApply && structureDealerFee != null
  const isSwitchingStructure =
    isEditMode &&
    !!existingTournament?.blindStructureId &&
    !!selectedBlindStructureId &&
    selectedBlindStructureId !== existingTournament.blindStructureId
  const fixedCostsTotal = structureCosts.reduce((sum, c) => sum + c.amount, 0)
  const dealerTotal = askDealers ? dealerCount * (structureDealerFee ?? 0) : 0
  const previewTotal = fixedCostsTotal + dealerTotal

  // Pre-preencher valores ao selecionar estrutura
  useEffect(() => {
    if (!selectedBlindStructureId) return
    // Em modo edicao, pula o prefill quando o id e o mesmo que foi carregado
    // inicialmente do torneio (para nao sobrescrever overrides do usuario).
    if (
      isEditMode &&
      initialLoadedStructureIdRef.current === selectedBlindStructureId
    ) {
      return
    }
    const structure = blindStructures?.find(
      (bs) => bs.id === selectedBlindStructureId,
    )
    if (!structure) return

    if (structure.defaultBuyIn != null)
      setValue('buyInAmount', structure.defaultBuyIn)
    if (structure.defaultRebuy != null)
      setValue('rebuyAmount', structure.defaultRebuy)
    if (structure.defaultAddon != null)
      setValue('addonAmount', structure.defaultAddon)
    if (structure.defaultStartingStack != null)
      setValue('startingStack', structure.defaultStartingStack)
    if (structure.defaultRebuyStack != null)
      setValue('rebuyStack', structure.defaultRebuyStack)
    if (structure.defaultAddonStack != null)
      setValue('addonStack', structure.defaultAddonStack)
    if (structure.defaultMaxRebuys != null)
      setValue('maxRebuys', structure.defaultMaxRebuys)
    if (structure.defaultAddonAllowed != null)
      setValue('addonAllowed', structure.defaultAddonAllowed)
    if (structure.defaultAddonDoubleAllowed != null)
      setValue('addonDoubleAllowed', structure.defaultAddonDoubleAllowed)
    if (structure.defaultSeatsPerTable != null)
      setValue('seatsPerTable', structure.defaultSeatsPerTable)
    if (structure.defaultStaffAmount != null)
      setValue('staffAmount', structure.defaultStaffAmount)
    if (structure.defaultRankingContribMode)
      setValue(
        'rankingContribMode',
        structure.defaultRankingContribMode as 'PerPlayer' | 'Percent',
      )
    if (structure.defaultRankingContribValue != null)
      setValue('rankingContribValue', structure.defaultRankingContribValue)
  }, [selectedBlindStructureId, blindStructures, setValue])

  // O <select> só mostra o valor quando a opção já existe: se o torneio carregou antes da lista de estruturas, o
  // campo aparecia como "Selecione..." (o formulário guardava o id certo). Reaplica o valor quando a lista chega.
  useEffect(() => {
    if (!isEditMode || !blindStructures) return
    const current = getValues('blindStructureId')
    if (current) setValue('blindStructureId', current)
  }, [isEditMode, blindStructures, getValues, setValue])

  // Pre-preencher campos em modo edicao
  useEffect(() => {
    if (!isEditMode || !existingTournament) return
    // Formato datetime-local: yyyy-MM-ddTHH:mm
    const dateStr = existingTournament.date
      ? new Date(existingTournament.date).toISOString().slice(0, 16)
      : ''
    initialLoadedStructureIdRef.current =
      existingTournament.blindStructureId ?? null
    reset({
      name: existingTournament.name,
      date: dateStr,
      rankingId: existingTournament.rankingId ?? '',
      blindStructureId: existingTournament.blindStructureId ?? '',
      buyInAmount: existingTournament.buyInAmount,
      rebuyAmount: existingTournament.rebuyAmount,
      addonAmount: existingTournament.addonAmount,
      startingStack: existingTournament.startingStack,
      rebuyStack: existingTournament.rebuyStack ?? 0,
      addonStack: existingTournament.addonStack ?? 0,
      maxRebuys: existingTournament.maxRebuys,
      addonAllowed: existingTournament.addonAllowed,
      addonDoubleAllowed: existingTournament.addonDoubleAllowed,
      seatsPerTable: existingTournament.seatsPerTable,
      responsiblePixKey: existingTournament.responsiblePixKey ?? '',
      staffAmount: existingTournament.staffAmount ?? 0,
      rankingContribMode:
        (existingTournament.rankingContribMode as 'PerPlayer' | 'Percent') ??
        'PerPlayer',
      rankingContribValue: existingTournament.rankingContribValue ?? 0,
    })
  }, [isEditMode, existingTournament, reset])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      tournamentsApi.create(
        homeGameId!,
        data as unknown as Parameters<typeof tournamentsApi.create>[1],
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      // Uso da semana (torneios nos últimos 7 dias) mudou
      void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
      toast.success('Torneio criado com sucesso!')
      navigate(tournamentDashboardPath(data.id))
    },
    onError: (err: unknown) => {
      // 402 (ex.: limite de torneios da semana): o modal de upgrade já abriu com a contagem regressiva
      if (isPlanLimitError(err)) {
        void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
        return
      }
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      const msg = resp?.data?.message
      console.error('Erro ao criar torneio:', resp?.status, msg, err)
      toast.error(msg || `Erro ao criar torneio (${resp?.status || 'desconhecido'}).`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      tournamentsApi.update(
        homeGameId!,
        tournamentId!,
        data as unknown as Parameters<typeof tournamentsApi.update>[2],
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      toast.success('Torneio atualizado com sucesso!')
      navigate(tournamentDashboardPath(data.id))
    },
    onError: (err: unknown) => {
      if (isPlanLimitError(err)) return
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      const msg = resp?.data?.message
      console.error('Erro ao atualizar torneio:', resp?.status, msg, err)
      toast.error(msg || `Erro ao atualizar torneio (${resp?.status || 'desconhecido'}).`)
    },
  })

  function onSubmit(data: TournamentFormData) {
    const hasRanking = showRanking && !!data.rankingId
    // Chave do dia no formato dos bancos: inválida ou ambígua (CPF × celular sem escolha) não deixa salvar
    const savedPix = existingTournament?.responsiblePixKey ?? null
    if (canPay) {
      const pixCheck = checkPixKey(data.responsiblePixKey, pixKeyType, savedPix)
      if (pixCheck.error) {
        setError('responsiblePixKey', { message: pixCheck.error }, { shouldFocus: true })
        toast.error(pixCheck.error)
        return
      }
    }
    const pix = toPixKeyPayload(data.responsiblePixKey, pixKeyType, savedPix)
    const payload = {
      ...data,
      rankingId: hasRanking ? data.rankingId : undefined,
      blindStructureId: data.blindStructureId || undefined,
      // 0 = "não informado" → backend guarda null e o telão usa o stack inicial
      rebuyStack: data.rebuyStack || undefined,
      addonStack: data.addonStack || undefined,
      // Sem ranking vinculado, não faz sentido contribuição acumulada.
      rankingContribMode: hasRanking ? data.rankingContribMode : undefined,
      rankingContribValue: hasRanking ? data.rankingContribValue : 0,
      // Sem Payments no plano: nada de staff nem PIX do dia (o backend também força nulo)
      staffAmount: canPay ? data.staffAmount : undefined,
      responsiblePixKey: canPay ? pix.key : undefined,
      responsiblePixKeyType: canPay ? pix.type : undefined,
      // Só quando a pergunta aparece (estrutura com dealer pago e plano com custos); vira "Dealers (N × R$ X)"
      dealerCount: askDealers ? dealerCount : undefined,
    }
    if (isEditMode) {
      updateMutation.mutate(payload as Record<string, unknown>)
    } else {
      createMutation.mutate(payload as Record<string, unknown>)
    }
  }

  if (isEditMode && tournamentLoading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando torneio..." />
      </div>
    )
  }

  if (!homeGameId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-text-secondary">Home game não encontrado.</p>
      </div>
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isEditMode ? 'Editar Torneio' : 'Novo Torneio'}
          </h1>
          {homeGame && (
            <p className="text-sm text-text-secondary">{homeGame.name}</p>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6 rounded-xl border border-border-default bg-bg-secondary p-6"
      >
        {/* Nome e Data */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome *"
            {...register('name')}
            error={errors.name?.message}
            placeholder="Torneio Sexta-Feira"
          />
          <Input
            label="Data *"
            type="datetime-local"
            {...register('date')}
            error={errors.date?.message}
          />
        </div>

        {/* PIX do responsável pelo torneio no dia (opcional) — só com Payments no plano. Aceita do jeito que a
            pessoa digita e grava no formato dos bancos (SPEC-20261023-1218) */}
        {canPay && (
          <PixKeyInput
            id="responsible-pix-key"
            label="PIX do responsável no dia (opcional)"
            value={pixKeyValue}
            onChange={(v) => {
              setValue('responsiblePixKey', v, { shouldDirty: true })
              clearErrors('responsiblePixKey')
            }}
            type={pixKeyType}
            onTypeChange={(t) => {
              setPixKeyType(t)
              clearErrors('responsiblePixKey')
            }}
            savedKey={existingTournament?.responsiblePixKey ?? null}
            error={errors.responsiblePixKey?.message}
          />
        )}

        {/* Estrutura e Ranking */}
        <div className={`grid gap-4 ${showRanking ? 'sm:grid-cols-2' : ''}`}>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Estrutura de Torneio
            </label>
            <select
              {...register('blindStructureId')}
              className="min-h-[44px] w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <option value="">Selecione...</option>
              {blindStructures?.map((bs) => (
                <option key={bs.id} value={bs.id}>
                  {bs.name}
                  {bs.defaultBuyIn
                    ? ` (R$ ${bs.defaultBuyIn.toFixed(0)})`
                    : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary">
              Ao selecionar, os valores abaixo serão preenchidos automaticamente
            </p>
          </div>

          {showRanking && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                Ranking
              </label>
              <select
                {...register('rankingId')}
                className="min-h-[44px] w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
              >
                <option value="">Nenhum</option>
                {rankings?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Custos padrão da estrutura + dealers (SPEC-20261023-1215) */}
        {showDefaultsPreview && (
          <div className="rounded-lg border border-border-default bg-bg-primary p-4">
            <h2 className="text-sm font-semibold text-text-primary">
              {isEditMode ? 'Custos que serão adicionados ao torneio' : 'Custos que entram neste torneio'}
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {structureCosts.map((c, i) => (
                <li key={c.id ?? i} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 wrap-anywhere text-text-primary">
                    {c.description}
                    {c.beneficiary && <span className="text-text-secondary"> · Para: {c.beneficiary}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-text-primary">{formatCurrency(c.amount)}</span>
                </li>
              ))}
              {askDealers && dealerCount > 0 && (
                <li className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-text-primary">
                    {dealerCount === 1 ? 'Dealer' : `Dealers (${dealerCount} × ${formatCurrency(structureDealerFee ?? 0)})`}
                  </span>
                  <span className="shrink-0 tabular-nums text-text-primary">{formatCurrency(dealerTotal)}</span>
                </li>
              )}
            </ul>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border-default pt-2 text-sm font-semibold text-text-primary">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(previewTotal)}</span>
            </div>

            {askDealers && (
              <div className="mt-4 flex flex-col gap-1.5">
                <label htmlFor="quantidade-dealers" className="text-sm font-medium text-text-secondary">
                  Quantos dealers neste torneio?
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDealerCount((n) => Math.max(0, n - 1))}
                      disabled={dealerCount <= 0}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-input bg-bg-input text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:text-text-muted"
                      aria-label="Menos um dealer"
                    >
                      <Minus className="h-4 w-4" aria-hidden />
                    </button>
                    <input
                      id="quantidade-dealers"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_DEALERS}
                      value={dealerCount}
                      onChange={(e) => {
                        const n = Math.trunc(Number(e.target.value))
                        setDealerCount(Number.isFinite(n) ? Math.min(MAX_DEALERS, Math.max(0, n)) : 0)
                      }}
                      className="min-h-[44px] w-16 rounded-lg border border-border-input bg-bg-input px-2 text-center text-sm text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-border-focus"
                    />
                    <button
                      type="button"
                      onClick={() => setDealerCount((n) => Math.min(MAX_DEALERS, n + 1))}
                      disabled={dealerCount >= MAX_DEALERS}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-input bg-bg-input text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:text-text-muted"
                      aria-label="Mais um dealer"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <span className="text-sm text-text-secondary tabular-nums" aria-live="polite">
                    {dealerCount === 0
                      ? 'Sem custo de dealer'
                      : `${dealerCount} × ${formatCurrency(structureDealerFee ?? 0)} = ${formatCurrency(dealerTotal)}`}
                  </span>
                </div>
              </div>
            )}

            <p className="mt-3 text-xs text-text-secondary">
              {isEditMode
                ? 'Você pode editar ou excluir na aba Custos depois de salvar.'
                : 'Você pode editar ou excluir na aba Custos depois de criar.'}
            </p>
          </div>
        )}
        {isSwitchingStructure && canCosts && (
          <p className="text-xs text-text-secondary">
            Trocar a estrutura não altera os custos já lançados (aba Custos).
          </p>
        )}

        {/* Valores */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Valores
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Buy-in (R$) *"
              type="number"
              step="0.01"
              {...register('buyInAmount')}
              error={errors.buyInAmount?.message}
            />
            <Input
              label="Rebuy (R$) *"
              type="number"
              step="0.01"
              {...register('rebuyAmount')}
              error={errors.rebuyAmount?.message}
            />
            <Input
              label="Add-on (R$) *"
              type="number"
              step="0.01"
              {...register('addonAmount')}
              error={errors.addonAmount?.message}
            />
          </div>
          {canPay && (
            <p className="mt-2 text-xs text-text-secondary">
              O valor cobrado de cada jogador é buy-in + staff
              {showRanking && watch('rankingId') && watch('rankingContribMode') === 'PerPlayer'
                ? ' + ranking'
                : ''}
              . Tudo entra como receita; staff e ranking saem como custo do prêmio.
            </p>
          )}
        </div>

        {/* Staff e Ranking (custos automáticos) — só com Payments no plano do dono */}
        {canPay && (
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Staff e Ranking
          </h2>
          <Input
            label="Staff por jogador (R$)"
            type="number"
            step="0.01"
            {...register('staffAmount')}
            error={errors.staffAmount?.message}
          />
          {!showRanking ? null : watch('rankingId') ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  Contribuição p/ ranking
                </label>
                <select
                  {...register('rankingContribMode')}
                  className="min-h-[44px] w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
                >
                  <option value="PerPlayer">Valor fixo por jogador</option>
                  <option value="Percent">% do líquido</option>
                </select>
              </div>
              <Input
                label={
                  watch('rankingContribMode') === 'Percent'
                    ? '% do líquido (arredonda p/ múltiplo de 10)'
                    : 'Valor por jogador (R$)'
                }
                type="number"
                step="0.01"
                {...register('rankingContribValue')}
                error={errors.rankingContribValue?.message}
              />
            </div>
          ) : (
            <p className="mt-2 text-xs text-text-secondary">
              Selecione um ranking acima para definir a contribuição acumulada.
            </p>
          )}
        </div>
        )}

        {/* Stack e Regras */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Stack e Regras
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Stack Inicial"
              type="number"
              {...register('startingStack')}
              error={errors.startingStack?.message}
            />
            <Input
              label="Fichas do Rebuy (0 = igual ao inicial)"
              type="number"
              {...register('rebuyStack')}
              error={errors.rebuyStack?.message}
            />
            <Input
              label="Fichas do Add-on (0 = igual ao inicial)"
              type="number"
              {...register('addonStack')}
              error={errors.addonStack?.message}
            />
            <Input
              label="Max Rebuys (0 = ilimitado)"
              type="number"
              {...register('maxRebuys')}
              error={errors.maxRebuys?.message}
            />
            {canTables && (
              <Input
                label="Jogadores por Mesa"
                type="number"
                min={2}
                max={12}
                {...register('seatsPerTable')}
                error={errors.seatsPerTable?.message}
              />
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('addonAllowed')}
                className="h-5 w-5 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
              />
              <span className="text-sm text-text-primary">
                Permitir add-on
              </span>
            </label>
            {watch('addonAllowed') && (
              <label className="flex items-center gap-2 cursor-pointer ml-7">
                <input
                  type="checkbox"
                  {...register('addonDoubleAllowed')}
                  className="h-5 w-5 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
                />
                <span className="text-sm text-text-primary">
                  Permitir addon duplo
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Botoes */}
        <div className="flex gap-3 justify-end border-t border-border-default pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditMode ? 'Salvar alterações' : 'Criar torneio'}
          </Button>
        </div>
      </form>
    </div>
  )
}
