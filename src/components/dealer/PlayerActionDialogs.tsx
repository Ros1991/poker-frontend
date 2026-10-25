import { useCallback, useState } from 'react'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { PaymentModal } from '../tournament/PaymentModal'
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { AddonDialog } from './AddonDialog'
import { EliminateDialog } from './EliminateDialog'
import { formatCurrency, playerName } from './terminalFormat'
import type { useTerminalActions } from './useTerminalActions'

type TerminalActions = ReturnType<typeof useTerminalActions>

interface PlayerActionDialogsOptions {
  tournamentId: string
  tournament: Tournament | undefined
  /** O hook de ações (mutações + toast "Desfazer") de quem usa */
  actions: TerminalActions
  /** Plano do dono com Payments: o PaymentModal só é montado com ele */
  showPayment: boolean
  /** Candidatos a "Quem eliminou?" (terminal: companheiros de mesa; painel: mesa ou, sem mesa, todos os ativos) */
  candidatesFor: (entry: TournamentEntry) => TournamentEntry[]
  /** Depois de eliminar (terminal: avalia quebra/equilíbrio das mesas; o painel não abre nada — L10) */
  onEliminated?: (entry: TournamentEntry) => void
}

/**
 * Diálogos de ação do jogador compartilhados pelo terminal do dealer e pela aba Jogadores do painel
 * (SPEC-20261023-1217, L14): confirmação de rebuy, AddonDialog (simples/duplo), EliminateDialog ("Quem eliminou?"),
 * confirmação de desfazer eliminação e o PaymentModal. Devolve as funções que abrem cada um e o JSX (`dialogs`) para
 * quem usa pôr no fim da tela. Os toasts com "Desfazer" vêm do `useTerminalActions` de quem chama.
 */
export function usePlayerActionDialogs({
  tournamentId,
  tournament,
  actions,
  showPayment,
  candidatesFor,
  onEliminated,
}: PlayerActionDialogsOptions) {
  const [rebuyEntry, setRebuyEntry] = useState<TournamentEntry | null>(null)
  const [addonEntry, setAddonEntry] = useState<TournamentEntry | null>(null)
  const [eliminateEntry, setEliminateEntry] = useState<TournamentEntry | null>(null)
  const [undoElimEntry, setUndoElimEntry] = useState<TournamentEntry | null>(null)

  const askRebuy = useCallback((entry: TournamentEntry) => setRebuyEntry(entry), [])
  const askAddon = useCallback((entry: TournamentEntry) => setAddonEntry(entry), [])
  const askEliminate = useCallback((entry: TournamentEntry) => setEliminateEntry(entry), [])
  const askUndoElimination = useCallback((entry: TournamentEntry) => setUndoElimEntry(entry), [])
  const { openPayment } = actions

  const dialogs = (
    <>
      <ConfirmDialog
        isOpen={!!rebuyEntry}
        onClose={() => setRebuyEntry(null)}
        onConfirm={() =>
          rebuyEntry &&
          actions.rebuyMutation.mutate(rebuyEntry, { onSettled: () => setRebuyEntry(null) })
        }
        title="Rebuy"
        message={
          rebuyEntry
            ? `Rebuy para ${playerName(rebuyEntry)}: ${formatCurrency(tournament?.rebuyAmount ?? 0)}?`
            : ''
        }
        confirmLabel="Confirmar rebuy"
        variant="warning"
        loading={actions.rebuyMutation.isPending}
      />

      <AddonDialog
        entry={addonEntry}
        tournament={tournament}
        loading={actions.addonMutation.isPending}
        onClose={() => setAddonEntry(null)}
        onConfirm={(isDouble) =>
          addonEntry &&
          actions.addonMutation.mutate(
            { entry: addonEntry, isDouble },
            { onSettled: () => setAddonEntry(null) },
          )
        }
      />

      {eliminateEntry && (
        <EliminateDialog
          entry={eliminateEntry}
          tablemates={candidatesFor(eliminateEntry)}
          loading={actions.eliminateMutation.isPending}
          onClose={() => setEliminateEntry(null)}
          onConfirm={(eliminatedByEntryId) =>
            actions.eliminateMutation.mutate(
              { entry: eliminateEntry, eliminatedByEntryId },
              {
                onSuccess: () => {
                  const eliminated = eliminateEntry
                  setEliminateEntry(null)
                  onEliminated?.(eliminated)
                },
              },
            )
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!undoElimEntry}
        onClose={() => setUndoElimEntry(null)}
        onConfirm={() =>
          undoElimEntry &&
          actions.undoEliminationMutation.mutate(undoElimEntry, { onSettled: () => setUndoElimEntry(null) })
        }
        title="Desfazer eliminação"
        message={undoElimEntry ? `Desfazer a eliminação de ${playerName(undoElimEntry)}? Ele volta a jogar.` : ''}
        confirmLabel="Desfazer"
        variant="warning"
        loading={actions.undoEliminationMutation.isPending}
      />

      {showPayment && (
        <PaymentModal
          isOpen={!!actions.paymentEntry}
          onClose={actions.closePayment}
          entry={actions.paymentEntry}
          tournamentId={tournamentId}
        />
      )}
    </>
  )

  return { askRebuy, askAddon, askEliminate, askUndoElimination, openPayment, dialogs }
}
