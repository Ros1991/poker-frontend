import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Plus, Timer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as blindStructuresApi from '../../../api/blindStructures.api'
import { Button } from '../../../components/ui/Button'
import { blindStructureEditPath, blindStructureNewPath } from '../../../constants/routes'
import { EmptyState, SectionSpinner } from './EmptyState'
import { useHomeGameShell } from './homeGameShell'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/** Seção Estruturas (era a aba Estruturas, `?tab=blinds`; SPEC-20261029-1724) */
export function StructuresSection() {
  const { homeGame, canManage } = useHomeGameShell()
  const homeGameId = homeGame.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: structures, isLoading } = useQuery({
    queryKey: ['blindStructures', homeGameId],
    queryFn: () => blindStructuresApi.getAll({ homeGameId }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blindStructuresApi.remove(id),
    onSuccess: () => {
      toast.success('Estrutura removida!')
      queryClient.invalidateQueries({ queryKey: ['blindStructures', homeGameId] })
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(status === 403 ? 'Sem permissão.' : msg || 'Erro ao remover estrutura.')
    },
  })

  const list = structures ?? []

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => navigate(blindStructureNewPath(homeGameId))}>
            <Plus className="h-4 w-4" />
            Nova Estrutura
          </Button>
        </div>
      )}

      {isLoading && <SectionSpinner />}

      {!isLoading && list.length === 0 && (
        <EmptyState
          icon={Timer}
          title="Nenhuma estrutura de torneio"
          description="Crie uma estrutura de torneio para usar nos torneios."
        />
      )}

      {!isLoading && list.length > 0 && (
        <div className="space-y-2">
          {list.map((bs) => (
            <div
              key={bs.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-4 transition-all hover:border-accent-blue/50 hover:bg-bg-tertiary"
            >
              <div
                className={`flex-1 min-w-0 ${canManage ? 'cursor-pointer' : ''}`}
                onClick={() => canManage && navigate(blindStructureEditPath(homeGameId, bs.id))}
              >
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-accent-blue shrink-0" />
                  <h4 className="font-medium text-text-primary truncate">{bs.name}</h4>
                  {canManage && <Edit className="h-3.5 w-3.5 text-text-muted shrink-0" />}
                </div>
                {bs.description && (
                  <p className="mt-1 text-sm text-text-secondary line-clamp-1 ml-7">{bs.description}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary ml-7">
                  <span>{bs.levelCount ?? bs.levels?.length ?? 0} níveis</span>
                  {(bs.defaultCosts?.length ?? 0) > 0 && (
                    <span className="tabular-nums">
                      {bs.defaultCosts!.length} {bs.defaultCosts!.length === 1 ? 'custo padrão' : 'custos padrão'} ·{' '}
                      {formatCurrency(bs.defaultCosts!.reduce((sum, c) => sum + c.amount, 0))}
                    </span>
                  )}
                  {bs.defaultHasDealer && bs.defaultDealerFee != null && (
                    <span className="tabular-nums">dealer {formatCurrency(bs.defaultDealerFee)} cada</span>
                  )}
                  {bs.defaultBuyIn != null && (
                    <span className="tabular-nums">Buy-in: R$ {bs.defaultBuyIn.toFixed(2)}</span>
                  )}
                  {bs.defaultStartingStack != null && (
                    <span className="tabular-nums">Stack: {bs.defaultStartingStack.toLocaleString('pt-BR')}</span>
                  )}
                  {!bs.homeGameId && <span>(global)</span>}
                </div>
              </div>
              {canManage && (
                <button
                  onClick={() => deleteMutation.mutate(bs.id)}
                  className="p-1.5 rounded-md text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors shrink-0"
                  title="Remover estrutura"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
