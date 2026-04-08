import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserCog, Plus, X } from 'lucide-react'
import * as tournamentDealersApi from '../../../api/tournamentDealers.api'
import * as personsApi from '../../../api/persons.api'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { Avatar } from '../../../components/ui/Avatar'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import type { Tournament } from '../../../types/tournament.types'

interface DealersTabProps {
  tournament: Tournament
}

export function DealersTab({ tournament }: DealersTabProps) {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)

  const { data: tournamentDealers = [], isLoading } = useQuery({
    queryKey: ['tournamentDealers', tournament.id],
    queryFn: () => tournamentDealersApi.getAll(tournament.id),
  })

  const { data: homeGameDealers = [] } = useQuery({
    queryKey: ['persons', tournament.homeGameId, 'Dealer'],
    queryFn: () => personsApi.getByHomeGame(tournament.homeGameId, 'Dealer'),
    enabled: showAddModal,
  })

  const availableDealers = useMemo(() => {
    const usedIds = new Set(tournamentDealers.map((td) => td.personId))
    return homeGameDealers.filter((d) => !usedIds.has(d.id))
  }, [homeGameDealers, tournamentDealers])

  const addMutation = useMutation({
    mutationFn: (personId: string) => tournamentDealersApi.add(tournament.id, personId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentDealers', tournament.id] })
      toast.success('Dealer adicionado!')
    },
    onError: () => toast.error('Erro ao adicionar dealer.'),
  })

  const removeMutation = useMutation({
    mutationFn: (dealerId: string) => tournamentDealersApi.remove(tournament.id, dealerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentDealers', tournament.id] })
      toast.success('Dealer removido!')
    },
    onError: () => toast.error('Erro ao remover dealer.'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner text="Carregando dealers..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">
          Dealers do Torneio ({tournamentDealers.length})
        </h2>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Adicionar Dealer
        </Button>
      </div>

      {tournamentDealers.length === 0 && (
        <div className="text-center py-12">
          <UserCog className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Nenhum dealer cadastrado neste torneio.</p>
          <p className="text-sm text-text-muted mt-1">
            Clique em &quot;Adicionar Dealer&quot; para registrar quem irá trabalhar.
          </p>
        </div>
      )}

      {tournamentDealers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournamentDealers.map((dealer) => (
            <div
              key={dealer.id}
              className="flex items-center gap-3 rounded-xl border border-border-default bg-bg-primary p-3"
            >
              <Avatar src={dealer.photoUrl} name={dealer.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {dealer.nickname ?? dealer.name}
                </p>
                {dealer.nickname && (
                  <p className="text-xs text-text-muted truncate">{dealer.name}</p>
                )}
              </div>
              <button
                onClick={() => removeMutation.mutate(dealer.id)}
                className="p-2 rounded-lg text-text-muted hover:text-accent-red hover:bg-bg-tertiary transition-colors"
                title="Remover dealer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Adicionar Dealer ao Torneio"
        size="md"
      >
        <div className="flex flex-col gap-3">
          {availableDealers.length === 0 && (
            <p className="text-sm text-text-muted text-center py-6">
              Não há dealers disponíveis no home game.
            </p>
          )}
          {availableDealers.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-primary p-3"
            >
              <Avatar src={d.photoUrl} name={d.fullName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {d.nickname ?? d.fullName}
                </p>
                {d.nickname && (
                  <p className="text-xs text-text-muted truncate">{d.fullName}</p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => addMutation.mutate(d.id)}
                loading={addMutation.isPending}
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          ))}
          <div className="flex justify-end mt-2">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
