import { useState } from 'react'
import { ArrowRightLeft, CheckCircle2, Undo2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import * as historyApi from '../../api/history.api'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { PlayerPicker } from '../players/PlayerPicker'
import { usePickerLayout } from '../players/usePickerLayout'
import { SeatingMovesList } from '../tournament/SeatingChangesDialog'
import { seatingAdvice, seatingTitle } from '../tournament/seatingText'
import type { Table } from '../../api/tables.api'
import type { BulkCreateEntriesResult, SeatingResult, TournamentEntry } from '../../types/entry.types'
import { Sheet } from './Sheet'
import { apiErrorMessage, playerName, tableLabel } from './terminalFormat'
import { undoHistoryItem } from './useTerminalActions'

interface AddPlayerSheetProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  /** Inscrições do torneio (o PlayerPicker mostra "já está no torneio") */
  entries: TournamentEntry[] | undefined
  /** Mesas do terminal (reserva para o resumo, se o resultado do lote não trouxer o lugar de alguém) */
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

/** "Mesa 2 · lugar 5" (lido do resultado do lote — SPEC-20261023-1214) / "Sem mesa" */
function seatText(entry: TournamentEntry, seating: SeatingResult, tables: Table[] | undefined): string {
  const seat = seating.seated.find((s) => s.entryId === entry.id)
  if (seat) return `${seat.tableName} · lugar ${seat.seatNumber}`
  if (!entry.tableId) return 'Sem mesa'
  const table = tables?.find((t) => t.id === entry.tableId)
  const name = table ? tableLabel(table) : 'Mesa'
  return entry.seatNumber ? `${name} · lugar ${entry.seatNumber}` : name
}

/**
 * "Adicionar jogadores" do terminal do dealer (SPEC-20261023-1213): o mesmo PlayerPicker do painel (busca,
 * multi-seleção, cadastrar jogador novo com foto) e, depois de adicionar, o resumo (F14) com quem entrou, onde
 * sentou e "Desfazer" por linha. Sem "buy-in pendente" e sem "Registrar pagamento agora": o "Deve" do card e da
 * ficha continua dizendo o que falta pagar. A inscrição já senta (SPEC-20261023-1214): se ela abriu mesa e mudou
 * gente de lugar, o topo do resumo mostra "Mesa 2 aberta — avise quem muda" com a lista "Fulano: Mesa 1, lugar 3 →
 * Mesa 2, lugar 5" (a mesma do aviso do painel) e os botões só aparecem abaixo dela. Sem mesas no plano (tablesEnabled
 * falso), o resumo não fala de mesa.
 */
function AddPlayerContent({ onClose, tournamentId, entries, tables, showTables = true, onChanged }: AddPlayerSheetProps) {
  const [result, setResult] = useState<BulkCreateEntriesResult | null>(null)
  const [undone, setUndone] = useState<Set<string>>(new Set())
  const [undoing, setUndoing] = useState<string | null>(null)
  // Remonta o picker (busca e seleção limpas) a cada "Adicionar mais"
  const [round, setRound] = useState(0)
  // Celular deitado com o teclado aberto (< 300 px visíveis): sem o cabeçalho do Sheet; o "Voltar" vem para a barra de
  // cima do PlayerPicker (o mesmo usePickerLayout dos dois lados — SPEC-20261027-1311)
  const { minimal } = usePickerLayout()

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

  if (result) {
    const added = result.entries
    const { seating } = result
    const withTables = showTables && seating.tablesEnabled
    const moves = withTables ? seating.moves : []
    const kept = added.filter((e) => !undone.has(e.id)).length
    return (
      <Sheet isOpen onClose={onClose} title="Adicionar jogadores">
        <div className="flex flex-col gap-3">
          {moves.length > 0 && (
            <section
              aria-label={`${seatingTitle(seating)} — avise quem muda`}
              className="flex flex-col gap-2 rounded-xl border border-accent-yellow bg-accent-yellow-soft p-3"
            >
              <p className="flex items-center gap-2 text-lg font-bold text-text-primary">
                <ArrowRightLeft className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
                {seatingTitle(seating)} — avise quem muda
              </p>
              <p className="text-sm text-text-primary">{seatingAdvice(seating)}</p>
              <SeatingMovesList moves={moves} />
            </section>
          )}
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
                      {isUndone ? 'Inscrição desfeita' : withTables ? seatText(entry, seating, tables) : 'No torneio'}
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
              setResult(null)
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
    <Sheet isOpen onClose={onClose} title="Adicionar jogadores" scrollable={false} chrome={minimal ? 'none' : 'normal'}>
      <PlayerPicker
        key={round}
        tournamentId={tournamentId}
        entries={entries}
        variant="terminal"
        onAdded={(res) => {
          setResult(res)
          onChanged()
        }}
        onClose={onClose}
      />
    </Sheet>
  )
}
