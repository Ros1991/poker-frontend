import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Coffee } from 'lucide-react'
import * as blindStructuresApi from '../../api/blindStructures.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { homeGameDetailPath } from '../../constants/routes'
import type { BlindLevel } from '../../types/blind.types'

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
  const [defaultAddonDoubleAllowed, setDefaultAddonDoubleAllowed] = useState(false)
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

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['blindStructure', id],
    queryFn: () => blindStructuresApi.getById(id!),
    enabled: !!id,
  })

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
      setDefaultAddonDoubleAllowed(existing.defaultAddonDoubleAllowed ?? false)
      setDefaultLateRegistrationLevel(existing.defaultLateRegistrationLevel != null ? String(existing.defaultLateRegistrationLevel) : '')
      setDefaultRebuyUntilLevel(existing.defaultRebuyUntilLevel != null ? String(existing.defaultRebuyUntilLevel) : '')
      setDefaultStaffAmount(existing.defaultStaffAmount != null ? String(existing.defaultStaffAmount) : '')
      setDefaultRankingContribMode(
        (existing.defaultRankingContribMode as 'PerPlayer' | 'Percent') ?? 'PerPlayer',
      )
      setDefaultRankingContribValue(existing.defaultRankingContribValue != null ? String(existing.defaultRankingContribValue) : '')
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toNum = (v: string) => v === '' ? undefined : Number(v)
      const payload = {
        name,
        description: description || undefined,
        homeGameId: homeGameId ?? undefined,
        defaultBuyIn: toNum(defaultBuyIn),
        defaultRebuy: toNum(defaultRebuy),
        defaultAddon: toNum(defaultAddon),
        defaultStartingStack: toNum(defaultStartingStack),
        defaultRebuyStack: toNum(defaultRebuyStack),
        defaultAddonStack: toNum(defaultAddonStack),
        defaultMaxRebuys: toNum(defaultMaxRebuys),
        defaultAddonAllowed: defaultAddonAllowed,
        defaultAddonDoubleAllowed: defaultAddonDoubleAllowed,
        defaultLateRegistrationLevel: toNum(defaultLateRegistrationLevel),
        defaultRebuyUntilLevel: toNum(defaultRebuyUntilLevel),
        defaultStaffAmount: toNum(defaultStaffAmount),
        defaultRankingContribMode: defaultRankingContribMode,
        defaultRankingContribValue: toNum(defaultRankingContribValue),
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
        navigate(`${homeGameDetailPath(homeGameId)}?tab=blinds`)
      } else {
        navigate(-1)
      }
    },
    onError: () => {
      toast.error('Erro ao salvar estrutura de blinds.')
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nome e obrigatorio.')
      return
    }
    if (levels.length === 0) {
      toast.error('Adicione pelo menos um nivel.')
      return
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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-text-primary">
          {isEdit ? 'Editar Estrutura de Torneio' : 'Nova Estrutura de Torneio'}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 rounded-xl border border-border-default bg-bg-secondary p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Padrao 20min"
          />
          <Input
            label="Descricao"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descricao opcional"
          />
        </div>

        {/* Valores Padrao */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Valores Padrao
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
              label="Addon (R$)"
              type="number"
              step="0.01"
              value={defaultAddon}
              onChange={(e) => setDefaultAddon(e.target.value)}
              placeholder="Ex: 50.00"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            <Input
              label="Stack Inicial"
              type="number"
              value={defaultStartingStack}
              onChange={(e) => setDefaultStartingStack(e.target.value)}
              placeholder="Ex: 10000"
            />
            <Input
              label="Stack Rebuy"
              type="number"
              value={defaultRebuyStack}
              onChange={(e) => setDefaultRebuyStack(e.target.value)}
              placeholder="Ex: 10000"
            />
            <Input
              label="Stack Addon"
              type="number"
              value={defaultAddonStack}
              onChange={(e) => setDefaultAddonStack(e.target.value)}
              placeholder="Ex: 10000"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            <Input
              label="Max Rebuys (0 = ilimitado)"
              type="number"
              value={defaultMaxRebuys}
              onChange={(e) => setDefaultMaxRebuys(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Late Registration ate nivel"
              type="number"
              value={defaultLateRegistrationLevel}
              onChange={(e) => setDefaultLateRegistrationLevel(e.target.value)}
              placeholder="Ex: 6"
            />
            <Input
              label="Rebuy ate nivel"
              type="number"
              value={defaultRebuyUntilLevel}
              onChange={(e) => setDefaultRebuyUntilLevel(e.target.value)}
              placeholder="Ex: 6"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={defaultAddonAllowed}
                onChange={(e) => setDefaultAddonAllowed(e.target.checked)}
                className="h-5 w-5 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
              />
              <span className="text-sm text-text-primary">Addon Permitido</span>
            </label>
            {defaultAddonAllowed && (
              <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultAddonDoubleAllowed}
                  onChange={(e) => setDefaultAddonDoubleAllowed(e.target.checked)}
                  className="h-5 w-5 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
                />
                <span className="text-sm text-text-primary">Addon Duplo Permitido</span>
              </label>
            )}
          </div>

          {/* Staff e Ranking padrao */}
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
                Contribuicao p/ ranking
              </label>
              <select
                value={defaultRankingContribMode}
                onChange={(e) =>
                  setDefaultRankingContribMode(
                    e.target.value as 'PerPlayer' | 'Percent',
                  )
                }
                className="min-h-[44px] w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
              >
                <option value="PerPlayer">Valor fixo por jogador</option>
                <option value="Percent">% do liquido</option>
              </select>
            </div>
            <Input
              label={
                defaultRankingContribMode === 'Percent'
                  ? '% do liquido'
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

        {/* Levels Table */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Niveis
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-text-muted">
                  <th className="px-2 py-2 w-16">Nivel</th>
                  <th className="px-2 py-2">Small Blind</th>
                  <th className="px-2 py-2">Big Blind</th>
                  <th className="px-2 py-2">Ante</th>
                  <th className="px-2 py-2 w-24">Duracao (min)</th>
                  <th className="px-2 py-2 w-24">Intervalo?</th>
                  <th className="px-2 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => (
                  <tr
                    key={level.key}
                    className={`border-b border-border-default ${level.isBreak ? 'bg-accent-blue/5' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <span className="text-text-muted font-mono text-xs">
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
                          className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                        />
                      ) : (
                        <input
                          type="number"
                          value={level.smallBlind}
                          onChange={(e) =>
                            updateLevel(level.key, 'smallBlind', Number(e.target.value))
                          }
                          className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
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
                          className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
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
                          className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
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
                        className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
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
                        className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-red-500/10 transition-colors"
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

          <div className="flex gap-2 mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={addLevel}>
              <Plus className="h-4 w-4" />
              Adicionar Nivel
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={addBreak}>
              <Coffee className="h-4 w-4" />
              Adicionar Intervalo
            </Button>
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t border-border-default pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
            disabled={saveMutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={saveMutation.isPending}>
            {isEdit ? 'Salvar' : 'Criar Estrutura'}
          </Button>
        </div>
      </form>
    </div>
  )
}
