import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as entriesApi from '../../api/entries.api'
import { Modal } from '../ui/Modal'
import { PlayerPicker } from '../players/PlayerPicker'
import type { TournamentEntry } from '../../types/entry.types'

interface AddPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  /** Inscrições já carregadas pela aba (senão o modal consulta) */
  entries?: TournamentEntry[]
}

/**
 * "Adicionar jogadores" do painel (SPEC-20261023-1213): casca do PlayerPicker (o mesmo do terminal do dealer).
 * Sem "buy-in pago": toda inscrição nasce Pendente e o pagamento é registrado na aba Pagamentos.
 */
export function AddPlayerModal({ isOpen, onClose, tournamentId, entries }: AddPlayerModalProps) {
  const queryClient = useQueryClient()
  const { data: fetched } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId),
    enabled: isOpen && !entries,
  })

  function handleAdded(created: TournamentEntry[]) {
    void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['availablePlayers', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
    const n = created.length
    toast.success(n === 1 ? '1 jogador adicionado' : `${n} jogadores adicionados`)
    onClose()
  }

  return (
    // fill: a altura acompanha a área visível (teclado aberto inclusive); 40rem é só a altura preferida — o contêiner
    // encolhe junto com a modal e só a lista do PlayerPicker rola, com o rodapé dele sempre à vista
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar jogadores" size="xl" fill>
      <div className="flex h-[40rem] min-h-0 flex-col">
        <PlayerPicker tournamentId={tournamentId} entries={entries ?? fetched} variant="panel" onAdded={handleAdded} />
      </div>
    </Modal>
  )
}
