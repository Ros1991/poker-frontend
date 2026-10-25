import { useState } from 'react'
import { CheckCircle2, Undo2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import * as historyApi from '../../api/history.api'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { PlayerPicker } from '../players/PlayerPicker'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import { Sheet } from './Sheet'
import { apiErrorMessage, playerName, tableLabel } from './terminalFormat'
import { undoHistoryItem } from './useTerminalActions'

interface AddPlayerSheetProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  /** Inscrições do torneio (o PlayerPicker mostra "já está no torneio") */
  entries: TournamentEntry[] | undefined
  /** Mesas do terminal, para o resumo dizer onde cada um sentou */
  tables?: Table[]
  /** Plano do dono com Tables: o resumo mostra mesa e lugar */
  showTables?: boolean
  /** Inscrições feitas ou desfeitas: quem chama invalida as consultas do terminal */
  onChanged: () => void
}

/** Montado só quando aberto: começa sempre na busca */
export function AddPlayerSheet(props: AddPlayerSheetProps) {
  if (!props.isOpen) return null
  return <AddPlayerContent {...props} />
}

/** "Mesa 2 · lugar 5" / "Sem mesa" */
function seatText(entry: TournamentEntry, tables: Table[] | undefined): string {
  if (!entry.tableId) return 'Sem mesa'
  const table = tables?.find((t) => t.id === entry.tableId)
  const name = table ? tableLabel(table) : 'Mesa'
  return entry.seatNumber ? `${name} · lugar ${entry.seatNumber}` : name
}

/**
 * "Adicionar jogadores" do terminal do dealer (SPEC-20261023-1213): o mesmo PlayerPicker do painel (busca,
 * multi-seleção, cadastrar jogador novo com foto) e, depois de adicionar, o resumo (F14) com quem entrou, onde
 * sentou e "Desfazer" por linha. Sem "buy-in pendente" e sem "Registrar pagamento agora": o "Deve" do card e da
 * ficha continua dizendo o que falta pagar.
 */
function AddPlayerContent({ onClose, tournamentId, entries, tables, showTables = true, onChanged }: AddPlayerSheetProps) {
  const [added, setAdded] = useState<TournamentEntry[] | null>(null)
  const [undone, setUndone] = useState<Set<string>>(new Set())
  const [undoing, setUndoing] = useState<string | null>(null)
  // Remonta o picker (busca e seleção limpas) a cada "Adicionar mais"
  const [round, setRound] = useState(0)

  async function undo(entry: TournamentEntry) {
    setUndoing(entry.id)
    try {
      const items = await historyApi.getHistory(tournamentId, entry.id)
      const buyIn = items.find((i) => i.kind === 'BuyIn' && !i.undone)
      if (!buyIn) {
        toast.error('Não encontrei a inscrição no histórico.')
        return
      }
      if (!buyIn.canUndo) {
        toast.error(buyIn.undoBlockedReason ?? 'Esta inscrição não pode mais ser desfeita.')
        return
      }
      await undoHistoryItem(tournamentId, buyIn)
      setUndone((prev) => new Set(prev).add(entry.id))
      toast.success(`Inscrição desfeita: ${playerName(entry)}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível desfazer.'))
    } finally {
      setUndoing(null)
      onChanged()
    }
  }

  if (added) {
    const kept = added.filter((e) => !undone.has(e.id)).length
    return (
      <Sheet isOpen onClose={onClose} title="Adicionar jogadores">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-7 w-7 shrink-0 text-accent-green" />
            <p className="text-lg font-bold text-text-primary">
              {kept === 1 ? '1 jogador entrou no torneio' : `${kept} jogadores entraram no torneio`}
            </p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {added.map((entry) => {
              const isUndone = undone.has(entry.id)
              return (
                <li
                  key={entry.id}
                  className="flex min-h-[56px] items-center gap-3 rounded-lg border border-border-default bg-bg-card p-2"
                >
                  <Avatar src={entry.person.photoUrl} name={playerName(entry)} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className={isUndone ? 'block truncate text-sm font-semibold text-text-muted line-through' : 'block truncate text-sm font-semibold text-text-primary'}>
                      {playerName(entry)}
                    </span>
                    <span className="block truncate text-xs text-text-secondary">
                      {isUndone ? 'Inscrição desfeita' : showTables ? seatText(entry, tables) : 'No torneio'}
                    </span>
                  </span>
                  {!isUndone && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void undo(entry)}
                      loading={undoing === entry.id}
                      disabled={!!undoing && undoing !== entry.id}
                      className="min-h-[44px]"
                    >
                      <Undo2 className="h-4 w-4" /> Desfazer
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setAdded(null)
              setUndone(new Set())
              setRound((r) => r + 1)
            }}
          >
            <UserPlus className="h-5 w-5" /> Adicionar mais
          </Button>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Voltar à mesa
          </Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet isOpen onClose={onClose} title="Adicionar jogadores" scrollable={false}>
      <PlayerPicker
        key={round}
        tournamentId={tournamentId}
        entries={entries}
        variant="terminal"
        onAdded={(created) => {
          setAdded(created)
          onChanged()
        }}
      />
    </Sheet>
  )
}
