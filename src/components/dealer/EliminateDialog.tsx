import { useState } from 'react'
import { ChevronDown, ChevronRight, Crosshair, Skull } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { isKnockout, isProgressive, splitBounty } from '../../utils/knockout'
import { PlayerConfirmHeader } from './PlayerConfirmHeader'
import { formatCurrency, playerName } from './terminalFormat'

interface EliminateDialogProps {
  entry: TournamentEntry
  /** Jogadores ativos da mesma mesa (candidatos a "quem eliminou") */
  tablemates: TournamentEntry[]
  /**
   * Knockout (SPEC-20261026-1909): os outros jogadores que ainda jogam, para escolher alguém de fora da mesa (ou todos,
   * quando o jogador não tem mesa). Só aparece no knockout — no Normal a tela é a de sempre.
   */
  others?: TournamentEntry[]
  /** Torneio: no knockout some o "Pular" e a escolha de quem eliminou é obrigatória (o bounty precisa de dono) */
  tournament?: Pick<Tournament, 'knockoutType' | 'bountyAmount'>
  loading: boolean
  onConfirm: (eliminatedByEntryId?: string) => void
  onClose: () => void
}

/**
 * Montado só quando aberto. Torneio Normal: a escolha começa em "Pular" (quem eliminou é opcional). Knockout: sem
 * "Pular" — escolher quem eliminou é obrigatório (o servidor também recusa sem) e o rodapé mostra para onde vai o
 * bounty (simples: tudo para quem eliminou; PKO: metade em dinheiro e metade na cabeça dele). Nos dois, o topo traz a
 * foto redonda e o nome de quem sai (SPEC-20261026-2103), para o dealer conferir que é a pessoa certa.
 */
export function EliminateDialog({ entry, tablemates, others, tournament, loading, onConfirm, onClose }: EliminateDialogProps) {
  const knockout = isKnockout(tournament)
  const [killerId, setKillerId] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const name = playerName(entry)
  // Knockout: fora da mesa (ou sem mesa) também vale; sem colegas de mesa a lista inteira já aparece
  const outside = knockout
    ? (others ?? []).filter((e) => e.id !== entry.id && !tablemates.some((t) => t.id === e.id))
    : []
  const mainList = knockout && tablemates.length === 0 ? outside : tablemates
  const extraList = knockout && tablemates.length > 0 ? outside : []
  const candidates = [...mainList, ...extraList]
  const killer = candidates.find((e) => e.id === killerId)
  const head = entry.bountyHead ?? 0
  const split = splitBounty(tournament, head)

  const option = (id: string | null, label: string) => (
    <button
      key={id ?? 'skip'}
      type="button"
      onClick={() => setKillerId(id)}
      aria-pressed={killerId === id}
      className={cn(
        'min-h-[44px] truncate rounded-lg border px-2 text-sm font-medium transition-colors',
        killerId === id
          ? 'border-accent-red bg-accent-red-soft text-text-primary'
          : 'border-border-default bg-bg-primary text-text-secondary',
      )}
    >
      {label}
    </button>
  )

  let footerText: string
  if (!knockout) footerText = killer ? `Quem eliminou: ${playerName(killer)}` : 'Sem informar quem eliminou'
  else if (!killer) footerText = 'Escolha quem eliminou: o bounty vai para essa pessoa.'
  else if (isProgressive(tournament))
    footerText = `Quem eliminou: ${playerName(killer)} · ${formatCurrency(split.cash)} em dinheiro + ${formatCurrency(split.toHead)} na cabeça`
  else footerText = `Quem eliminou: ${playerName(killer)} · leva ${formatCurrency(split.cash)} de bounty`

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Eliminar ${name}`}
      size="sm"
      footer={
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-text-secondary" data-eliminate-footer>
            {footerText}
          </p>
          <Button
            size="lg"
            variant="danger"
            className="w-full"
            loading={loading}
            disabled={knockout && !killer}
            onClick={() => onConfirm(killerId ?? undefined)}
          >
            <Skull className="h-5 w-5" />
            Eliminar {name}
          </Button>
          <Button variant="ghost" className="w-full" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <PlayerConfirmHeader person={entry.person} />
      {knockout && (
        <p
          className="mb-3 flex items-center gap-1.5 rounded-lg bg-accent-purple-soft px-3 py-2 text-sm text-accent-purple-deep"
          data-eliminate-bounty
        >
          <Crosshair className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Bounty de {name}: <span className="font-semibold tabular-nums">{formatCurrency(head)}</span>
          </span>
        </p>
      )}
      <p className="mb-2 text-sm font-medium text-text-secondary">
        {knockout ? 'Quem eliminou? (obrigatório no knockout)' : 'Quem eliminou? (opcional)'}
      </p>
      <div className="grid grid-cols-2 gap-1.5" data-eliminate-options>
        {!knockout && option(null, 'Pular')}
        {mainList.map((e) => option(e.id, playerName(e)))}
      </div>
      {knockout && mainList.length === 0 && (
        <p className="py-2 text-sm text-text-secondary">Nenhum outro jogador está jogando.</p>
      )}
      {extraList.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            aria-expanded={showOthers}
            className="mt-3 flex min-h-[44px] w-full items-center gap-1.5 text-sm font-medium text-accent-blue"
          >
            {showOthers ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Outro jogador (fora da mesa)
          </button>
          {showOthers && (
            <div className="grid grid-cols-2 gap-1.5" data-eliminate-others>
              {extraList.map((e) => option(e.id, playerName(e)))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
