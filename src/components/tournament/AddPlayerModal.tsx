import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as entriesApi from '../../api/entries.api'
import { Modal } from '../ui/Modal'
import { PlayerPicker } from '../players/PlayerPicker'
import { SeatingChangesDialog } from './SeatingChangesDialog'
import { seatCountsText } from './seatingText'
import type { BulkCreateEntriesResult, SeatingResult, TournamentEntry } from '../../types/entry.types'

interface AddPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  /** Inscrições já carregadas pela aba (senão o modal consulta) */
  entries?: TournamentEntry[]
}

/** "3 jogadores adicionados — Mesa 1: 2, Mesa 2: 1"; sem mesas no plano, só a contagem */
function addedToast({ entries, seating }: BulkCreateEntriesResult): string {
  const n = entries.length
  const count = n === 1 ? '1 jogador adicionado' : `${n} jogadores adicionados`
  if (!seating.tablesEnabled) return count
  const ids = new Set(entries.map((e) => e.id))
  const seated = seating.seated.filter((s) => ids.has(s.entryId))
  if (seated.length === 0) return count
  if (n === 1) return `${count} — ${seated[0].tableName}, lugar ${seated[0].seatNumber}`
  return `${count} — ${seatCountsText(seated)}`
}

/**
 * "Adicionar jogadores" do painel (SPEC-20261023-1213): casca do PlayerPicker (o mesmo do terminal do dealer).
 * Sem "buy-in pago": toda inscrição nasce Pendente e o pagamento é registrado na aba Pagamentos. A inscrição já senta
 * (SPEC-20261023-1214): o toast diz onde ficaram e, se a inscrição abriu mesa e mudou gente de lugar, o aviso com a
 * lista abre depois de fechar o modal (só fecha no "Feito"/X).
 */
export function AddPlayerModal({ isOpen, onClose, tournamentId, entries }: AddPlayerModalProps) {
  const queryClient = useQueryClient()
  const [changes, setChanges] = useState<SeatingResult | null>(null)
  const { data: fetched } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId),
    enabled: isOpen && !entries,
  })

  function handleAdded(result: BulkCreateEntriesResult) {
    void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['availablePlayers', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
    toast.success(addedToast(result))
    onClose()
    if (result.seating.moves.length > 0) setChanges(result.seating)
  }

  return (
    <>
      {/* fill: a altura acompanha a área visível (teclado aberto inclusive); 40rem é só a altura preferida — o
          contêiner encolhe junto com a modal e só a lista do PlayerPicker rola, com o rodapé dele sempre à vista */}
      <Modal isOpen={isOpen} onClose={onClose} title="Adicionar jogadores" size="xl" fill>
        <div className="flex h-[40rem] min-h-0 flex-col">
          <PlayerPicker tournamentId={tournamentId} entries={entries ?? fetched} variant="panel" onAdded={handleAdded} />
        </div>
      </Modal>
      <SeatingChangesDialog seating={changes} onClose={() => setChanges(null)} />
    </>
  )
}
