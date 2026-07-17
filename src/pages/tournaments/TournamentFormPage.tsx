import { useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import * as tournamentsApi from '../../api/tournaments.api'
import * as homeGamesApi from '../../api/homeGames.api'
import * as rankingsApi from '../../api/rankings.api'
import * as blindStructuresApi from '../../api/blindStructures.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { tournamentDashboardPath } from '../../constants/routes'

const tournamentSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  date: z.string().min(1, 'Data obrigatoria'),
  rankingId: z.string().optional(),
  blindStructureId: z.string().optional(),
  buyInAmount: z.coerce.number().min(0, 'Valor invalido'),
  rebuyAmount: z.coerce.number().min(0, 'Valor invalido'),
  addonAmount: z.coerce.number().min(0, 'Valor invalido'),
  startingStack: z.coerce.number().min(1, 'Stack invalido'),
  rebuyStack: z.coerce.number().min(0, 'Valor invalido'),
  addonStack: z.coerce.number().min(0, 'Valor invalido'),
  maxRebuys: z.coerce.number().min(0, 'Valor invalido'),
  addonAllowed: z.boolean(),
  addonDoubleAllowed: z.boolean(),
  seatsPerTable: z.coerce.number().min(2, 'Mínimo 2').max(12, 'Máximo 12'),
  responsiblePixKey: z.string().optional(),
  staffAmount: z.coerce.number().min(0, 'Valor invalido'),
  rankingContribMode: z.enum(['PerPlayer', 'Percent']),
  rankingContribValue: z.coerce.number().min(0, 'Valor invalido'),
})

type TournamentFormData = z.infer<typeof tournamentSchema>

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
    watch,
    reset,
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

  // Rankings do home game
  const { data: rankings } = useQuery({
    queryKey: ['rankings', homeGameId],
    queryFn: () => rankingsApi.getAll(homeGameId!),
    enabled: !!homeGameId,
  })

  // Estruturas do home game (+ globais)
  const { data: blindStructures } = useQuery({
    queryKey: ['blindStructures', homeGameId],
    queryFn: () => blindStructuresApi.getAll({ homeGameId }),
    enabled: !!homeGameId,
  })

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
      toast.success('Torneio criado com sucesso!')
      navigate(tournamentDashboardPath(data.id))
    },
    onError: (err: unknown) => {
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
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      const msg = resp?.data?.message
      console.error('Erro ao atualizar torneio:', resp?.status, msg, err)
      toast.error(msg || `Erro ao atualizar torneio (${resp?.status || 'desconhecido'}).`)
    },
  })

  function onSubmit(data: TournamentFormData) {
    const hasRanking = !!data.rankingId
    const payload = {
      ...data,
      rankingId: data.rankingId || undefined,
      blindStructureId: data.blindStructureId || undefined,
      // 0 = "não informado" → backend guarda null e o telão usa o stack inicial
      rebuyStack: data.rebuyStack || undefined,
      addonStack: data.addonStack || undefined,
      // Sem ranking vinculado, não faz sentido contribuição acumulada.
      rankingContribMode: hasRanking ? data.rankingContribMode : undefined,
      rankingContribValue: hasRanking ? data.rankingContribValue : 0,
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
        <p className="text-text-secondary">Home Game nao encontrado.</p>
      </div>
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
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

        {/* PIX do responsável pelo torneio no dia (opcional) */}
        <Input
          label="PIX do responsável (no dia) — opcional"
          {...register('responsiblePixKey')}
          error={errors.responsiblePixKey?.message}
          placeholder="CPF, e-mail, telefone ou chave aleatória"
        />

        {/* Estrutura e Ranking */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Estrutura de Torneio
            </label>
            <select
              {...register('blindStructureId')}
              className="min-h-[44px] w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
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
            <p className="text-xs text-text-muted">
              Ao selecionar, os valores abaixo serao preenchidos automaticamente
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Ranking
            </label>
            <select
              {...register('rankingId')}
              className="min-h-[44px] w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <option value="">Nenhum</option>
              {rankings?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

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
          <p className="mt-2 text-xs text-text-muted">
            O valor cobrado de cada jogador é buy-in + staff
            {watch('rankingId') && watch('rankingContribMode') === 'PerPlayer'
              ? ' + ranking'
              : ''}
            . Tudo entra como receita; staff e ranking saem como custo do prêmio.
          </p>
        </div>

        {/* Staff e Ranking (custos automáticos) */}
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
          {watch('rankingId') ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  Contribuição p/ ranking
                </label>
                <select
                  {...register('rankingContribMode')}
                  className="min-h-[44px] w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
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
            <p className="mt-2 text-xs text-text-muted">
              Selecione um ranking acima para definir a contribuição acumulada.
            </p>
          )}
        </div>

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
            <Input
              label="Jogadores por Mesa"
              type="number"
              min={2}
              max={12}
              {...register('seatsPerTable')}
              error={errors.seatsPerTable?.message}
            />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('addonAllowed')}
                className="h-5 w-5 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
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
                  className="h-5 w-5 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
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
            {isEditMode ? 'Salvar Alteracoes' : 'Criar Torneio'}
          </Button>
        </div>
      </form>
    </div>
  )
}
