import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Coffee } from 'lucide-react'
import * as blindStructuresApi from '../../api/blindStructures.api'
import * as homeGamesApi from '../../api/homeGames.api'
import { Button } from '../../components/ui/Button'
import { FormPageBar } from '../../components/ui/FormTopBar'
import { Input } from '../../components/ui/Input'
import { PixKeyInput } from '../../components/pix/PixKeyInput'
import { KnockoutFields } from '../../components/tournament/KnockoutFields'
import { TimebankFields } from '../../components/tournament/TimebankFields'
import { TIMEBANK_DEFAULT_SECONDS, timebankFieldErrors } from '../../utils/timebank'
import { checkPixKey, toPixKeyPayload, type PixKeyType } from '../../utils/pix'
import { bountyError, knockoutTypeOf, type KnockoutType } from '../../utils/knockout'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { AccessDeniedState } from '../../components/common/AccessDeniedState'
import { PlanLock, requiredPlanFor } from '../../components/plan'
import { hasFeature } from '../../hooks/usePlan'
import { usePlanCatalog } from '../../hooks/usePlanCatalog'
import { isForbiddenError } from '../../utils/httpErrors'
import { homeGameSectionPath } from '../../constants/routes'
import type { BlindLevel, BlindStructureDefaultCost } from '../../types/blind.types'

interface LevelRow {
  key: number
  levelNumber: number
  smallBlind: number
  bigBlind: number
  ante: number
  durationMinutes: number
  isBreak: boolean
  breakDescription: string
}

const DEFAULT_LEVELS: LevelRow[] = [
  { key: 1, levelNumber: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 2, levelNumber: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 3, levelNumber: 3, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 4, levelNumber: 4, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 5, levelNumber: 5, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true, breakDescription: 'Intervalo' },
  { key: 6, levelNumber: 6, smallBlind: 150, bigBlind: 300, ante: 25, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 7, levelNumber: 7, smallBlind: 200, bigBlind: 400, ante: 50, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 8, levelNumber: 8, smallBlind: 300, bigBlind: 600, ante: 75, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 9, levelNumber: 9, smallBlind: 400, bigBlind: 800, ante: 100, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 10, levelNumber: 10, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true, breakDescription: 'Intervalo' },
  { key: 11, levelNumber: 11, smallBlind: 500, bigBlind: 1000, ante: 100, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 12, levelNumber: 12, smallBlind: 700, bigBlind: 1400, ante: 200, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 13, levelNumber: 13, smallBlind: 1000, bigBlind: 2000, ante: 300, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 14, levelNumber: 14, smallBlind: 1500, bigBlind: 3000, ante: 400, durationMinutes: 20, isBreak: false, breakDescription: '' },
  { key: 15, levelNumber: 15, smallBlind: 2000, bigBlind: 4000, ante: 500, durationMinutes: 20, isBreak: false, breakDescription: '' },
]

let nextKey = 100

/** Custo padrão em edição (valor como texto, igual aos outros campos numéricos da página). */
interface CostRow {
  key: number
  description: string
  amount: string
  beneficiary: string
  pixKey: string
  /** Tipo escolhido no campo da chave (null = automático) — SPEC-20261023-1218 */
  pixType: PixKeyType | null
  /** Chave já gravada neste custo (edição): enquanto o texto for igual, vale o tipo dela */
  savedPixKey: string | null
}

/** Mesmo teto do backend (BlindStructuresController.MaxDefaultCosts). */
const MAX_DEFAULT_COSTS = 20

const emptyCostRow = (): CostRow => ({
  key: ++nextKey,
  description: '',
  amount: '',
  beneficiary: '',
  pixKey: '',
  pixType: null,
  savedPixKey: null,
})

const isBlankCost = (c: CostRow) =>
  !c.description.trim() && !c.amount.trim() && !c.beneficiary.trim() && !c.pixKey.trim()

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function BlindStructureFormPage() {
  const navigate = useNavigate()
  const { homeGameId, id } = useParams<{ homeGameId: string; id?: string }>()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [defaultBuyIn, setDefaultBuyIn] = useState<string>('')
  const [defaultRebuy, setDefaultRebuy] = useState<string>('')
  const [defaultAddon, setDefaultAddon] = useState<string>('')
  const [defaultStartingStack, setDefaultStartingStack] = useState<string>('')
  const [defaultRebuyStack, setDefaultRebuyStack] = useState<string>('')
  const [defaultAddonStack, setDefaultAddonStack] = useState<string>('')
  const [defaultMaxRebuys, setDefaultMaxRebuys] = useState<string>('')
  const [defaultAddonAllowed, setDefaultAddonAllowed] = useState(true)
  // Máximo de add-ons padrão (SPEC-20261027-1311): texto do campo; 0 = ilimitado, padrão 1
  const [defaultMaxAddons, setDefaultMaxAddons] = useState<string>('1')
  const [maxAddonsError, setMaxAddonsError] = useState<string | null>(null)
  const [defaultLateRegistrationLevel, setDefaultLateRegistrationLevel] = useState<string>('')
  const [defaultRebuyUntilLevel, setDefaultRebuyUntilLevel] = useState<string>('')
  const [defaultStaffAmount, setDefaultStaffAmount] = useState<string>('')
  const [defaultRankingContribMode, setDefaultRankingContribMode] = useState<
    'PerPlayer' | 'Percent'
  >('PerPlayer')
  const [defaultRankingContribValue, setDefaultRankingContribValue] = useState<string>('')
  const [levels, setLevels] = useState<LevelRow[]>(() =>
    DEFAULT_LEVELS.map((l) => ({ ...l })),
  )
  // Custos padrão do torneio e dealer pago (SPEC-20261023-1215)
  const [costs, setCosts] = useState<CostRow[]>([])
  const [hasDealer, setHasDealer] = useState(false)
  const [dealerFee, setDealerFee] = useState<string>('')
  // Knockout padrão (SPEC-20261026-1909): o torneio criado com a estrutura herda (em qualquer plano)
  const [knockoutType, setKnockoutType] = useState<KnockoutType>('None')
  const [bountyAmount, setBountyAmount] = useState<string>('')
  const [bountyFieldError, setBountyFieldError] = useState<string | null>(null)
  // Timebank padrão (SPEC-20261029-1722): o torneio criado com a estrutura herda (em qualquer plano)
  const [timebankOn, setTimebankOn] = useState(false)
  const [timebankCount, setTimebankCount] = useState<string>('3')
  const [timebankSecs, setTimebankSecs] = useState<string>(String(TIMEBANK_DEFAULT_SECONDS))
  const [timebankErrors, setTimebankErrors] = useState<{ count: string | null; seconds: string | null }>({ count: null, seconds: null })

  const {
    data: existing,
    isLoading: loadingExisting,
    error: existingError,
  } = useQuery({
    queryKey: ['blindStructure', id],
    queryFn: () => blindStructuresApi.getById(id!),
    enabled: !!id,
  })

  // Plano do DONO do home game da estrutura (SPEC-20261023-1205): sem CostExtras (Mesa) a seção de custos
  // padrão fica com cadeado e só leitura, e o payload OMITE defaultCosts/defaultHasDealer/defaultDealerFee
  // (PUT sem os campos = manter; queda de plano nunca apaga nada). Estrutura global (template do Admin, sem
  // home game) fica liberada. Mesma chave de cache do TournamentFormPage.
  const isGlobal = isEdit && !!existing && !existing.homeGameId
  const structureHomeGameId = isEdit ? (existing?.homeGameId ?? undefined) : homeGameId
  const { data: homeGame } = useQuery({
    queryKey: ['homeGame', structureHomeGameId],
    queryFn: () => homeGamesApi.getById(structureHomeGameId!),
    enabled: !!structureHomeGameId,
  })
  const { plans } = usePlanCatalog()
  const canEditCosts = isGlobal || (!!homeGame && hasFeature(homeGame.planFeatures, 'CostExtras'))
  const costsLocked = !isGlobal && !!homeGame && !hasFeature(homeGame.planFeatures, 'CostExtras')
  const requiredPlan = requiredPlanFor('CostExtras', plans)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setDefaultBuyIn(existing.defaultBuyIn != null ? String(existing.defaultBuyIn) : '')
      setDefaultRebuy(existing.defaultRebuy != null ? String(existing.defaultRebuy) : '')
      setDefaultAddon(existing.defaultAddon != null ? String(existing.defaultAddon) : '')
      setDefaultStartingStack(existing.defaultStartingStack != null ? String(existing.defaultStartingStack) : '')
      setDefaultRebuyStack(existing.defaultRebuyStack != null ? String(existing.defaultRebuyStack) : '')
      setDefaultAddonStack(existing.defaultAddonStack != null ? String(existing.defaultAddonStack) : '')
      setDefaultMaxRebuys(existing.defaultMaxRebuys != null ? String(existing.defaultMaxRebuys) : '')
      setDefaultAddonAllowed(existing.defaultAddonAllowed ?? true)
      setDefaultMaxAddons(String(existing.defaultMaxAddons ?? 1))
      setDefaultLateRegistrationLevel(existing.defaultLateRegistrationLevel != null ? String(existing.defaultLateRegistrationLevel) : '')
      setDefaultRebuyUntilLevel(existing.defaultRebuyUntilLevel != null ? String(existing.defaultRebuyUntilLevel) : '')
      setDefaultStaffAmount(existing.defaultStaffAmount != null ? String(existing.defaultStaffAmount) : '')
      setDefaultRankingContribMode(
        (existing.defaultRankingContribMode as 'PerPlayer' | 'Percent') ?? 'PerPlayer',
      )
      setDefaultRankingContribValue(existing.defaultRankingContribValue != null ? String(existing.defaultRankingContribValue) : '')
      setCosts(
        [...(existing.defaultCosts ?? [])]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((c: BlindStructureDefaultCost) => ({
            key: ++nextKey,
            description: c.description,
            amount: String(c.amount),
            beneficiary: c.beneficiary ?? '',
            pixKey: c.pixKey ?? '',
            pixType: null,
            savedPixKey: c.pixKey ?? null,
          })),
      )
      setHasDealer(existing.defaultHasDealer ?? false)
      setDealerFee(existing.defaultDealerFee != null ? String(existing.defaultDealerFee) : '')
      setKnockoutType(knockoutTypeOf({ knockoutType: existing.defaultKnockoutType }))
      setBountyAmount(existing.defaultBountyAmount != null ? String(existing.defaultBountyAmount) : '')
      setTimebankOn((existing.defaultTimebankCount ?? 0) > 0)
      setTimebankCount(String(existing.defaultTimebankCount ?? 3))
      setTimebankSecs(String(existing.defaultTimebankSeconds ?? TIMEBANK_DEFAULT_SECONDS))
      setLevels(
        existing.levels.map((l: BlindLevel, i: number) => ({
          key: i + 1,
          levelNumber: l.levelNumber,
          smallBlind: l.smallBlind,
          bigBlind: l.bigBlind,
          ante: l.ante,
          durationMinutes: l.durationMinutes,
          isBreak: l.isBreak,
          breakDescription: l.breakDescription ?? '',
        })),
      )
    }
  }, [existing])

  // Máximo de add-ons como número: inteiro de 0 (ilimitado) a 99, o mesmo limite do servidor; null = vazio ou inválido
  const maxAddonsValue = (() => {
    const n = Number(defaultMaxAddons)
    return defaultMaxAddons.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 99 ? n : null
  })()

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toNum = (v: string) => v === '' ? undefined : Number(v)
      // Ao editar, o vínculo é o da própria estrutura (template global → campo omitido, e o
      // backend mantém nulo), nunca o home game da rota; ao criar, o da rota.
      const payloadHomeGameId = isEdit
        ? (existing?.homeGameId ?? undefined)
        : (homeGameId ?? undefined)
      const payload = {
        name,
        description: description || undefined,
        homeGameId: payloadHomeGameId,
        defaultBuyIn: toNum(defaultBuyIn),
        defaultRebuy: toNum(defaultRebuy),
        defaultAddon: toNum(defaultAddon),
        defaultStartingStack: toNum(defaultStartingStack),
        defaultRebuyStack: toNum(defaultRebuyStack),
        defaultAddonStack: toNum(defaultAddonStack),
        defaultMaxRebuys: toNum(defaultMaxRebuys),
        defaultAddonAllowed: defaultAddonAllowed,
        // Vazio ou inválido → o servidor mantém (edição) ou usa 1 (criação)
        defaultMaxAddons: maxAddonsValue ?? undefined,
        defaultLateRegistrationLevel: toNum(defaultLateRegistrationLevel),
        defaultRebuyUntilLevel: toNum(defaultRebuyUntilLevel),
        defaultStaffAmount: toNum(defaultStaffAmount),
        defaultRankingContribMode: defaultRankingContribMode,
        defaultRankingContribValue: toNum(defaultRankingContribValue),
        // Knockout padrão (SPEC-20261026-1909): sempre explícito; Normal apaga o valor
        defaultKnockoutType: knockoutType,
        defaultBountyAmount: knockoutType !== 'None' ? Number(bountyAmount) : null,
        // Timebank padrão (SPEC-20261029-1722): sempre explícito; 0 = sem timebank
        defaultTimebankCount: timebankOn ? Number(timebankCount) : 0,
        defaultTimebankSeconds: timebankOn ? Number(timebankSecs) : undefined,
        levels: levels.map((l, i) => ({
          levelNumber: i + 1,
          smallBlind: l.isBreak ? 0 : l.smallBlind,
          bigBlind: l.isBreak ? 0 : l.bigBlind,
          ante: l.isBreak ? 0 : l.ante,
          bigBlindAnte: 0,
          durationMinutes: l.durationMinutes,
          isBreak: l.isBreak,
          breakDescription: l.isBreak ? (l.breakDescription || 'Intervalo') : undefined,
        })),
        // Custos padrão e dealer só quando o plano libera (ou template global); senão o campo nem vai e o
        // backend mantém o que já estava gravado. Cartão totalmente vazio é ignorado.
        ...(canEditCosts
          ? {
              defaultCosts: costs
                .filter((c) => !isBlankCost(c))
                .map((c) => {
                  // Chave no formato dos bancos + o tipo dela (a API normaliza e confere de novo)
                  const pix = toPixKeyPayload(c.pixKey, c.pixType, c.savedPixKey)
                  return {
                    description: c.description.trim(),
                    amount: Number(c.amount),
                    beneficiary: c.beneficiary.trim() || null,
                    pixKey: pix.key,
                    pixKeyType: pix.type,
                  }
                }),
              defaultHasDealer: hasDealer,
              defaultDealerFee: hasDealer ? Number(dealerFee) : null,
            }
          : {}),
      }
      if (isEdit) {
        return blindStructuresApi.update(id!, payload)
      }
      return blindStructuresApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blindStructures'] })
      if (id) queryClient.invalidateQueries({ queryKey: ['blindStructure', id] })
      toast.success(isEdit ? 'Estrutura atualizada!' : 'Estrutura criada!')
      if (homeGameId) {
        navigate(homeGameSectionPath(homeGameId, 'estruturas'))
      } else {
        navigate(-1)
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao salvar estrutura de blinds.')
    },
  })

  function renumberLevels(rows: LevelRow[]): LevelRow[] {
    return rows.map((r, i) => ({ ...r, levelNumber: i + 1 }))
  }

  function addLevel() {
    const last = levels.filter((l) => !l.isBreak).pop()
    const newLevel: LevelRow = {
      key: ++nextKey,
      levelNumber: levels.length + 1,
      smallBlind: last ? last.bigBlind : 100,
      bigBlind: last ? last.bigBlind * 2 : 200,
      ante: last ? last.ante : 0,
      durationMinutes: last ? last.durationMinutes : 20,
      isBreak: false,
      breakDescription: '',
    }
    setLevels(renumberLevels([...levels, newLevel]))
  }

  function addBreak() {
    const newBreak: LevelRow = {
      key: ++nextKey,
      levelNumber: levels.length + 1,
      smallBlind: 0,
      bigBlind: 0,
      ante: 0,
      durationMinutes: 10,
      isBreak: true,
      breakDescription: 'Intervalo',
    }
    setLevels(renumberLevels([...levels, newBreak]))
  }

  function removeLevel(key: number) {
    setLevels(renumberLevels(levels.filter((l) => l.key !== key)))
  }

  function updateLevel(key: number, field: keyof LevelRow, value: number | string | boolean) {
    setLevels(
      levels.map((l) => {
        if (l.key !== key) return l
        const updated = { ...l, [field]: value }
        // Ao mudar Small Blind, auto-preencher Big Blind com o dobro
        if (field === 'smallBlind' && typeof value === 'number') {
          updated.bigBlind = value * 2
        }
        return updated
      }),
    )
  }

  function addCost() {
    if (costs.length >= MAX_DEFAULT_COSTS) return
    setCosts([...costs, emptyCostRow()])
  }

  function removeCost(key: number) {
    setCosts(costs.filter((c) => c.key !== key))
  }

  function updateCost(key: number, field: 'description' | 'amount' | 'beneficiary' | 'pixKey', value: string) {
    setCosts(costs.map((c) => (c.key === key ? { ...c, [field]: value } : c)))
  }

  function updateCostPixType(key: number, pixType: PixKeyType | null) {
    setCosts(costs.map((c) => (c.key === key ? { ...c, pixType } : c)))
  }

  const filledCosts = costs.filter((c) => !isBlankCost(c))
  const costsTotal = filledCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nome é obrigatório.')
      return
    }
    if (levels.length === 0) {
      toast.error('Adicione pelo menos um nível.')
      return
    }
    if (defaultAddonAllowed && maxAddonsValue === null) {
      const msg = 'Max add-ons: use de 0 (ilimitado) a 99.'
      setMaxAddonsError(msg)
      toast.error(msg)
      document.getElementById('estrutura-max-addons')?.focus()
      return
    }
    // Timebank padrão (SPEC-20261029-1722): ligado, 1 a 99 por jogador e 5 a 300 segundos
    if (timebankOn) {
      const tb = timebankFieldErrors(timebankCount, timebankSecs)
      if (tb.count || tb.seconds) {
        setTimebankErrors(tb)
        toast.error(`Timebank: ${(tb.count ?? tb.seconds ?? '').toLowerCase()}.`)
        document.getElementById(tb.count ? 'estrutura-timebank-quantidade' : 'estrutura-timebank-segundos')?.focus()
        return
      }
    }
    // Knockout padrão: bounty obrigatório e, com buy-in padrão, menor que ele (e até o rebuy padrão)
    if (knockoutType !== 'None') {
      const bounty = Number(bountyAmount) || 0
      const buyIn = Number(defaultBuyIn) || 0
      const koError = buyIn > 0
        ? bountyError(knockoutType, bounty, buyIn, Number(defaultRebuy) || 0)
        : bountyError(knockoutType, bounty, Number.POSITIVE_INFINITY, null)
      if (koError) {
        setBountyFieldError(koError)
        toast.error(koError)
        document.getElementById('estrutura-bounty')?.focus()
        return
      }
    }
    if (canEditCosts) {
      const invalid = filledCosts.some((c) => !c.description.trim() || !(Number(c.amount) > 0))
      if (invalid) {
        toast.error('Preencha descrição e valor de cada custo padrão.')
        return
      }
      // Chave PIX de cada custo no formato dos bancos (SPEC-20261023-1218): inválida ou ambígua não deixa salvar
      for (const c of filledCosts) {
        const pixError = checkPixKey(c.pixKey, c.pixType, c.savedPixKey).error
        if (pixError) {
          toast.error(`Chave PIX de "${c.description.trim() || 'custo padrão'}": ${pixError}`)
          document.getElementById(`custo-${c.key}-pix`)?.focus()
          return
        }
      }
      if (filledCosts.length > MAX_DEFAULT_COSTS) {
        toast.error(`Uma estrutura pode ter no máximo ${MAX_DEFAULT_COSTS} custos padrão.`)
        return
      }
      if (hasDealer && !(Number(dealerFee) > 0)) {
        toast.error('Informe o valor por dealer.')
        return
      }
    }
    saveMutation.mutate()
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando estrutura..." />
      </div>
    )
  }

  // 403: estrutura de um home game de que o usuário não é dono, membro nem Admin
  if (isEdit && isForbiddenError(existingError)) {
    return <AccessDeniedState />
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Celular (< sm, SPEC-20261027-2132): barra fixa no topo com X (= Cancelar), título e ✓ (= Salvar / Criar estrutura); o cabeçalho e o
          rodapé da página somem e os campos ganham o espaço. Do sm para cima, como antes */}
      <FormPageBar
        title={isEdit ? 'Editar estrutura de torneio' : 'Nova estrutura de torneio'}
        onCancel={() => navigate(-1)}
        cancelDisabled={saveMutation.isPending}
        submit={{ label: isEdit ? 'Salvar' : 'Criar estrutura', form: 'blind-structure-form', loading: saveMutation.isPending }}
      />
      <div className="mb-6 hidden items-center gap-3 sm:flex">
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-text-primary">
          {isEdit ? 'Editar estrutura de torneio' : 'Nova estrutura de torneio'}
        </h1>
      </div>

      <form
        id="blind-structure-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 rounded-xl border border-border-default bg-bg-secondary p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Padrão 20 min"
          />
          <Input
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição opcional"
          />
        </div>

        {/* Valores padrão */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Valores padrão
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Buy-in (R$)"
              type="number"
              step="0.01"
              value={defaultBuyIn}
              onChange={(e) => setDefaultBuyIn(e.target.value)}
              placeholder="Ex: 50.00"
            />
            <Input
              label="Rebuy (R$)"
              type="number"
              step="0.01"
              value={defaultRebuy}
              onChange={(e) => setDefaultRebuy(e.target.value)}
              placeholder="Ex: 50.00"
            />
            <Input
              label="Add-on (R$)"
              type="number"
              step="0.01"
              value={defaultAddon}
              onChange={(e) => setDefaultAddon(e.target.value)}
              placeholder="Ex: 50.00"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            <Input
              label="Stack inicial"
              type="number"
              value={defaultStartingStack}
              onChange={(e) => setDefaultStartingStack(e.target.value)}
              placeholder="Ex: 10000"
            />
            <Input
              label="Stack do rebuy"
              type="number"
              value={defaultRebuyStack}
              onChange={(e) => setDefaultRebuyStack(e.target.value)}
              placeholder="Ex: 10000"
            />
            <Input
              label="Stack do add-on"
              type="number"
              value={defaultAddonStack}
              onChange={(e) => setDefaultAddonStack(e.target.value)}
              placeholder="Ex: 10000"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            <Input
              label="Máx. de rebuys (0 = ilimitado)"
              type="number"
              value={defaultMaxRebuys}
              onChange={(e) => setDefaultMaxRebuys(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Late registration até o nível"
              type="number"
              value={defaultLateRegistrationLevel}
              onChange={(e) => setDefaultLateRegistrationLevel(e.target.value)}
              placeholder="Ex: 6"
            />
            <Input
              label="Rebuy até o nível"
              type="number"
              value={defaultRebuyUntilLevel}
              onChange={(e) => setDefaultRebuyUntilLevel(e.target.value)}
              placeholder="Ex: 6"
            />
          </div>
          {/* Add-on padrão (SPEC-20261027-1311): "Permitir add-on" e, marcado, o máximo por jogador como o de rebuys */}
          <div className="grid gap-4 sm:grid-cols-3 mt-4" data-addon-rules>
            <label className="flex items-center gap-2 min-h-[44px] cursor-pointer sm:col-span-3">
              <input
                type="checkbox"
                checked={defaultAddonAllowed}
                onChange={(e) => {
                  setDefaultAddonAllowed(e.target.checked)
                  setMaxAddonsError(null)
                }}
                className="h-5 w-5 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
              />
              <span className="text-sm text-text-primary">Permitir add-on</span>
            </label>
            {defaultAddonAllowed && (
              <Input
                id="estrutura-max-addons"
                label="Max add-ons (0 = ilimitado)"
                type="number"
                min={0}
                max={99}
                step={1}
                inputMode="numeric"
                value={defaultMaxAddons}
                onChange={(e) => {
                  setDefaultMaxAddons(e.target.value)
                  setMaxAddonsError(null)
                }}
                placeholder="1"
                error={maxAddonsError ?? undefined}
              />
            )}
          </div>

          {/* Staff e ranking padrão */}
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            <Input
              label="Staff por jogador (R$)"
              type="number"
              step="0.01"
              value={defaultStaffAmount}
              onChange={(e) => setDefaultStaffAmount(e.target.value)}
              placeholder="Ex: 10.00"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                Contribuição p/ ranking
              </label>
              <select
                value={defaultRankingContribMode}
                onChange={(e) =>
                  setDefaultRankingContribMode(
                    e.target.value as 'PerPlayer' | 'Percent',
                  )
                }
                className="min-h-[44px] w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
              >
                <option value="PerPlayer">Valor fixo por jogador</option>
                <option value="Percent">% do líquido</option>
              </select>
            </div>
            <Input
              label={
                defaultRankingContribMode === 'Percent'
                  ? '% do líquido'
                  : 'Ranking por jogador (R$)'
              }
              type="number"
              step="0.01"
              value={defaultRankingContribValue}
              onChange={(e) => setDefaultRankingContribValue(e.target.value)}
              placeholder={defaultRankingContribMode === 'Percent' ? 'Ex: 10' : 'Ex: 5.00'}
            />
          </div>
        </div>

        {/* Knockout padrão (SPEC-20261026-1909) */}
        <KnockoutFields
          idPrefix="estrutura"
          description="Padrão dos torneios criados com esta estrutura (dá para trocar no torneio)."
          type={knockoutType}
          onTypeChange={(k) => {
            setKnockoutType(k)
            setBountyFieldError(null)
          }}
          bounty={bountyAmount}
          onBountyChange={(v) => {
            setBountyAmount(v)
            setBountyFieldError(null)
          }}
          buyIn={Number(defaultBuyIn) || 0}
          rebuy={Number(defaultRebuy) || 0}
          error={bountyFieldError}
        />

        {/* Timebank padrão (SPEC-20261029-1722) */}
        <TimebankFields
          idPrefix="estrutura"
          description="Padrão dos torneios criados com esta estrutura (dá para trocar no torneio). O dealer conta o tempo no celular, pelo terminal."
          enabled={timebankOn}
          onEnabledChange={(v) => {
            setTimebankOn(v)
            setTimebankErrors({ count: null, seconds: null })
          }}
          count={timebankCount}
          onCountChange={(v) => {
            setTimebankCount(v)
            setTimebankErrors((e) => ({ ...e, count: null }))
          }}
          seconds={timebankSecs}
          onSecondsChange={(v) => {
            setTimebankSecs(v)
            setTimebankErrors((e) => ({ ...e, seconds: null }))
          }}
          countError={timebankErrors.count}
          secondsError={timebankErrors.seconds}
        />

        {/* Custos padrão do torneio (SPEC-20261023-1215) */}
        <section aria-labelledby="custos-padrao-titulo">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2
              id="custos-padrao-titulo"
              className="text-sm font-semibold text-text-secondary uppercase tracking-wider"
            >
              Custos padrão do torneio
            </h2>
            {filledCosts.length > 0 && (
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                Total: {formatCurrency(costsTotal)}
              </span>
            )}
          </div>

          {costsLocked ? (
            <div className="mt-3 flex flex-col gap-4">
              <PlanLock
                feature="CostExtras"
                title="Custos padrão"
                description={`Custos padrão estão disponíveis ${requiredPlan ? `a partir do plano ${requiredPlan}` : 'nos planos pagos'}. Os que já estão nesta estrutura ficam guardados.`}
                currentPlan={homeGame?.ownerPlan ?? null}
                homeGameName={homeGame?.name ?? null}
                className="w-full"
              />
              {(filledCosts.length > 0 || hasDealer) && (
                <div className="rounded-lg border border-border-default bg-bg-primary p-3">
                  <p className="mb-2 text-xs font-medium text-text-secondary">Guardados nesta estrutura (só leitura)</p>
                  <ul className="flex flex-col gap-1.5">
                    {filledCosts.map((c) => (
                      <li key={c.key} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0 wrap-anywhere text-text-primary">
                          {c.description}
                          {c.beneficiary && <span className="text-text-secondary"> · Para: {c.beneficiary}</span>}
                        </span>
                        <span className="shrink-0 tabular-nums text-text-primary">{formatCurrency(Number(c.amount) || 0)}</span>
                      </li>
                    ))}
                    {hasDealer && (
                      <li className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-text-primary">Dealer pago (por dealer)</span>
                        <span className="shrink-0 tabular-nums text-text-primary">{formatCurrency(Number(dealerFee) || 0)}</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-text-secondary">
                Cada torneio criado com esta estrutura já nasce com estes custos (valor fixo por torneio). Dá para
                editar ou excluir na aba Custos do torneio. Staff é por jogador e fica no campo acima.
              </p>

              {costs.length > 0 && (
                <div className="flex flex-col gap-3">
                  {costs.map((c, i) => (
                    <div
                      key={c.key}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-border-default bg-bg-primary p-3 sm:grid-cols-[2fr_1fr_1.5fr_auto] sm:items-end"
                    >
                      <Input
                        id={`custo-${c.key}-descricao`}
                        label="Descrição *"
                        value={c.description}
                        onChange={(e) => updateCost(c.key, 'description', e.target.value)}
                        placeholder="Ex.: Churrasqueiro"
                        maxLength={200}
                        disabled={!canEditCosts}
                      />
                      <Input
                        id={`custo-${c.key}-valor`}
                        label="Valor (R$) *"
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={c.amount}
                        onChange={(e) => updateCost(c.key, 'amount', e.target.value)}
                        placeholder="Ex.: 330"
                        disabled={!canEditCosts}
                      />
                      <Input
                        id={`custo-${c.key}-para-quem`}
                        label="Para quem (opcional)"
                        value={c.beneficiary}
                        onChange={(e) => updateCost(c.key, 'beneficiary', e.target.value)}
                        placeholder="Ex.: Zé do churrasco"
                        maxLength={200}
                        disabled={!canEditCosts}
                      />
                      {/* Chave PIX numa linha própria (a detecção/escolha do tipo aparece embaixo do campo) */}
                      <div className="sm:col-span-3 sm:col-start-1 sm:row-start-2">
                        <PixKeyInput
                          id={`custo-${c.key}-pix`}
                          label="Chave PIX (opcional)"
                          value={c.pixKey}
                          onChange={(v) => updateCost(c.key, 'pixKey', v)}
                          type={c.pixType}
                          onTypeChange={(t) => updateCostPixType(c.key, t)}
                          savedKey={c.savedPixKey}
                          disabled={!canEditCosts}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCost(c.key)}
                        disabled={!canEditCosts}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 justify-self-end rounded-lg text-sm text-text-secondary transition-colors hover:bg-accent-red-soft hover:text-accent-red disabled:cursor-not-allowed sm:col-start-4 sm:row-start-1"
                        title="Remover custo"
                        aria-label={`Remover custo ${c.description.trim() || i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sm:hidden">Remover</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addCost}
                  disabled={!canEditCosts || costs.length >= MAX_DEFAULT_COSTS}
                  className="min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar custo
                </Button>
                {costs.length >= MAX_DEFAULT_COSTS && (
                  <span className="text-xs text-text-secondary">Máximo de {MAX_DEFAULT_COSTS} custos padrão.</span>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-border-default pt-4">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasDealer}
                    onChange={(e) => setHasDealer(e.target.checked)}
                    disabled={!canEditCosts}
                    className="h-5 w-5 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
                  />
                  <span className="text-sm text-text-primary">Este torneio tem dealer pago</span>
                </label>
                {hasDealer && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      id="valor-por-dealer"
                      label="Valor por dealer (R$) *"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={dealerFee}
                      onChange={(e) => setDealerFee(e.target.value)}
                      placeholder="Ex.: 150"
                      disabled={!canEditCosts}
                    />
                    <p className="text-xs text-text-secondary sm:col-span-2 sm:self-end sm:pb-3">
                      Ao criar o torneio, o sistema pergunta quantos dealers e lança o custo (quantidade × valor).
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Levels Table */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Níveis
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border-default text-left text-text-secondary">
                  <th className="px-2 py-2 w-16">Nível</th>
                  <th className="px-2 py-2">Small Blind</th>
                  <th className="px-2 py-2">Big Blind</th>
                  <th className="px-2 py-2">Ante</th>
                  <th className="px-2 py-2 w-24">Duração (min)</th>
                  <th className="px-2 py-2 w-24">Intervalo?</th>
                  <th className="px-2 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => (
                  <tr
                    key={level.key}
                    className={`border-b border-border-default ${level.isBreak ? 'bg-accent-blue-soft' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <span className="text-text-secondary font-mono text-xs">
                        {level.levelNumber}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {level.isBreak ? (
                        <input
                          type="text"
                          value={level.breakDescription}
                          onChange={(e) =>
                            updateLevel(level.key, 'breakDescription', e.target.value)
                          }
                          placeholder="Intervalo"
                          className="w-full rounded border border-border-input bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                        />
                      ) : (
                        <input
                          type="number"
                          value={level.smallBlind}
                          onChange={(e) =>
                            updateLevel(level.key, 'smallBlind', Number(e.target.value))
                          }
                          className="w-full rounded border border-border-input bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {level.isBreak ? (
                        <span className="text-text-muted text-xs">-</span>
                      ) : (
                        <input
                          type="number"
                          value={level.bigBlind}
                          onChange={(e) =>
                            updateLevel(level.key, 'bigBlind', Number(e.target.value))
                          }
                          className="w-full rounded border border-border-input bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {level.isBreak ? (
                        <span className="text-text-muted text-xs">-</span>
                      ) : (
                        <input
                          type="number"
                          value={level.ante}
                          onChange={(e) =>
                            updateLevel(level.key, 'ante', Number(e.target.value))
                          }
                          className="w-full rounded border border-border-input bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={level.durationMinutes}
                        onChange={(e) =>
                          updateLevel(level.key, 'durationMinutes', Number(e.target.value))
                        }
                        className="w-full rounded border border-border-input bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {level.isBreak ? (
                        <Coffee className="h-4 w-4 text-accent-blue mx-auto" />
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeLevel(level.key)}
                        className="p-1 rounded text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row" data-blinds-add-buttons>
            <Button type="button" variant="secondary" className="w-full whitespace-nowrap sm:w-auto" onClick={addLevel}>
              <Plus className="h-4 w-4" />
              Adicionar nível
            </Button>
            <Button type="button" variant="secondary" className="w-full whitespace-nowrap sm:w-auto" onClick={addBreak}>
              <Coffee className="h-4 w-4" />
              Adicionar intervalo
            </Button>
          </div>
        </div>

        {/* No celular, o X e o ✓ da barra do topo */}
        <div className="hidden gap-3 justify-end border-t border-border-default pt-4 sm:flex">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
            disabled={saveMutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={saveMutation.isPending}>
            {isEdit ? 'Salvar' : 'Criar estrutura'}
          </Button>
        </div>
      </form>
    </div>
  )
}
