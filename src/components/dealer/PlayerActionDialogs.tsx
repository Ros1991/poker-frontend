import { useCallback, useState } from 'react'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { PaymentModal } from '../tournament/PaymentModal'
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { AddonDialog } from './AddonDialog'
import { EliminateDialog } from './EliminateDialog'
import { PlayerConfirmHeader } from './PlayerConfirmHeader'
import { formatCurrency, outsideWindowError, playerName } from './terminalFormat'
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
  /**
   * Knockout (SPEC-20261026-1909): todos os outros que ainda jogam — no knockout escolher quem eliminou é obrigatório,
   * então o diálogo deixa escolher alguém de fora da mesa (ou qualquer um, sem mesa). No Normal não é usado.
   */
  othersFor?: (entry: TournamentEntry) => TournamentEntry[]
  /**
   * Depois de eliminar: terminal e painel avaliam a quebra/equilíbrio das mesas com o mesmo `useTableSuggestions`
   * (SPEC-20261026-1908 — antes o painel não abria nada)
   */
  onEliminated?: (entry: TournamentEntry) => void
}

/** Rebuy/add-on recusado por estar fora do período (409 `outside_window`), esperando o "Sim" (SPEC-20261105-1707) */
interface OutsideWindowAsk {
  kind: 'rebuy' | 'addon'
  entry: TournamentEntry
  quantity: number
  /** Frase do servidor: "O período de rebuy acabou no nível 6." */
  message: string
}

/**
 * Diálogos de ação do jogador compartilhados pelo terminal do dealer e pela aba Jogadores do painel
 * (SPEC-20261023-1217, L14): confirmação de rebuy, AddonDialog (quantidade até o máximo — SPEC-20261027-1311), EliminateDialog ("Quem eliminou?"),
 * confirmação de desfazer eliminação e o PaymentModal. Devolve as funções que abrem cada um e o JSX (`dialogs`) para
 * quem usa pôr no fim da tela. Os toasts com "Desfazer" vêm do `useTerminalActions` de quem chama. Toda confirmação abre
 * com a foto redonda e o nome do jogador no topo (SPEC-20261026-2103), para o dealer conferir quem é.
 * Rebuy/add-on esquecido (SPEC-20261105-1707): fora do período o servidor responde 409 `outside_window`; o diálogo vira
 * a pergunta "O período de rebuy acabou no nível N. Lançar mesmo assim?" e o "Sim, lançar" repete o pedido com a
 * confirmação (o histórico marca "fora do período"). Máximo atingido e jogador eliminado continuam sendo erro.
 */
export function usePlayerActionDialogs({
  tournamentId,
  tournament,
  actions,
  showPayment,
  candidatesFor,
  othersFor,
  onEliminated,
}: PlayerActionDialogsOptions) {
  const [rebuyEntry, setRebuyEntry] = useState<TournamentEntry | null>(null)
  const [addonEntry, setAddonEntry] = useState<TournamentEntry | null>(null)
  const [eliminateEntry, setEliminateEntry] = useState<TournamentEntry | null>(null)
  const [undoElimEntry, setUndoElimEntry] = useState<TournamentEntry | null>(null)
  const [outsideAsk, setOutsideAsk] = useState<OutsideWindowAsk | null>(null)

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
        onConfirm={() => {
          if (!rebuyEntry) return
          const entry = rebuyEntry
          actions.rebuyMutation.mutate(
            { entry },
            {
              onSettled: (_data, err) => {
                setRebuyEntry(null)
                const late = err ? outsideWindowError(err) : null
                if (late) setOutsideAsk({ kind: 'rebuy', entry, quantity: 1, message: late.message })
              },
            },
          )
        }}
        title="Rebuy"
        header={rebuyEntry && <PlayerConfirmHeader person={rebuyEntry.person} />}
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
        onConfirm={(quantity) => {
          if (!addonEntry) return
          const entry = addonEntry
          actions.addonMutation.mutate(
            { entry, quantity },
            {
              onSettled: (_data, err) => {
                setAddonEntry(null)
                const late = err ? outsideWindowError(err) : null
                if (late) setOutsideAsk({ kind: 'addon', entry, quantity, message: late.message })
              },
            },
          )
        }}
      />

      {/* Fora do período (SPEC-20261105-1707): o "Sim, lançar" repete o pedido com a confirmação */}
      <ConfirmDialog
        isOpen={!!outsideAsk}
        onClose={() => setOutsideAsk(null)}
        onConfirm={() => {
          if (!outsideAsk) return
          const ask = outsideAsk
          if (ask.kind === 'rebuy')
            actions.rebuyMutation.mutate(
              { entry: ask.entry, confirmOutsideWindow: true },
              { onSettled: () => setOutsideAsk(null) },
            )
          else
            actions.addonMutation.mutate(
              { entry: ask.entry, quantity: ask.quantity, confirmOutsideWindow: true },
              { onSettled: () => setOutsideAsk(null) },
            )
        }}
        title={outsideAsk?.kind === 'addon' ? 'Add-on fora do período' : 'Rebuy fora do período'}
        header={
          outsideAsk && (
            <PlayerConfirmHeader
              person={outsideAsk.entry.person}
              detail={
                outsideAsk.kind === 'rebuy'
                  ? `Rebuy de ${formatCurrency(tournament?.rebuyAmount ?? 0)}`
                  : `${outsideAsk.quantity === 1 ? 'Add-on' : `${outsideAsk.quantity} add-ons`} de ${formatCurrency(
                      (tournament?.addonAmount ?? 0) * outsideAsk.quantity,
                    )}`
              }
            />
          )
        }
        message={outsideAsk ? `${outsideAsk.message} Lançar mesmo assim?` : ''}
        confirmLabel="Sim, lançar"
        cancelLabel="Não"
        variant="warning"
        loading={actions.rebuyMutation.isPending || actions.addonMutation.isPending}
      />

      {eliminateEntry && (
        <EliminateDialog
          entry={eliminateEntry}
          tablemates={candidatesFor(eliminateEntry)}
          others={othersFor?.(eliminateEntry)}
          tournament={tournament}
          loading={actions.eliminateMutation.isPending}
          onClose={() => setEliminateEntry(null)}
          onConfirm={(eliminatedByEntryId) =>
            actions.eliminateMutation.mutate(
              {
                entry: eliminateEntry,
                eliminatedByEntryId,
                // Nome de quem eliminou para o toast do bounty (o servidor devolve o nome completo)
                killerName: (() => {
                  const k = [...candidatesFor(eliminateEntry), ...(othersFor?.(eliminateEntry) ?? [])].find(
                    (e) => e.id === eliminatedByEntryId,
                  )
                  return k ? playerName(k) : undefined
                })(),
              },
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
        header={undoElimEntry && <PlayerConfirmHeader person={undoElimEntry.person} />}
        message={undoElimEntry ? `Desfazer a eliminação de ${playerName(undoElimEntry)}? O jogador volta para o torneio.` : ''}
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
          // "Pago" do card (SPEC-20261105-1707): sem dívida, abre no resumo de como foi pago
          paidSummary
        />
      )}
    </>
  )

  return { askRebuy, askAddon, askEliminate, askUndoElimination, openPayment, dialogs }
}
