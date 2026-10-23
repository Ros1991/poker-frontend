import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, Undo2, UserPlus } from 'lucide-react'
import * as entriesApi from '../../api/entries.api'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'
import { SearchInput } from '../ui/SearchInput'
import { LoadingSpinner } from '../common/LoadingSpinner'
import type {
  AvailablePlayer,
  QuickAddEntryRequest,
  QuickAddEntryResponse,
  TournamentEntry,
} from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { Sheet } from './Sheet'
import { apiErrorMessage, formatCurrency, normalizeText, playerName } from './terminalFormat'

interface AddPlayerSheetProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  tournament: Tournament | undefined
  /** Inscrição feita (quem chama invalida e mostra o "Desfazer") */
  onAdded: (result: QuickAddEntryResponse) => void
  onPay: (entry: TournamentEntry) => void
}

/** Montado só quando aberto: começa sempre na busca */
export function AddPlayerSheet(props: AddPlayerSheetProps) {
  if (!props.isOpen) return null
  return <AddPlayerContent {...props} />
}

function AddPlayerContent({ onClose, tournamentId, tournament, onAdded, onPay }: AddPlayerSheetProps) {
  const [mode, setMode] = useState<'search' | 'new'>('search')
  const [search, setSearch] = useState('')
  const [confirmPerson, setConfirmPerson] = useState<AvailablePlayer | null>(null)
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<QuickAddEntryResponse | null>(null)
  // Quando a inscrição foi feita: só uma consulta de inscrições posterior diz se ela sumiu
  const [resultAt, setResultAt] = useState(0)
  const buyIn = formatCurrency(tournament?.buyInAmount ?? 0)

  const { data: players, isLoading } = useQuery({
    queryKey: ['availablePlayers', tournamentId],
    queryFn: () => entriesApi.getAvailablePlayers(tournamentId),
  })

  // Mesma consulta do terminal: se o "Desfazer" do toast (ou outro aparelho) remover a inscrição, a tela muda
  const { data: entries, dataUpdatedAt: entriesUpdatedAt } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId),
    enabled: !!result,
  })
  const resultUndone =
    !!result && !!entries && entriesUpdatedAt > resultAt && !entries.some((e) => e.id === result.entry.id)

  const filtered = useMemo(() => {
    const term = normalizeText(search.trim())
    if (!players) return []
    if (!term) return players
    return players.filter(
      (p) =>
        normalizeText(p.fullName).includes(term) ||
        (p.nickname && normalizeText(p.nickname).includes(term)),
    )
  }, [players, search])

  const addMutation = useMutation({
    mutationFn: (data: QuickAddEntryRequest) => entriesApi.quickAdd(tournamentId, data),
    onSuccess: (data) => {
      setConfirmPerson(null)
      setFormError(null)
      setResult(data)
      setResultAt(Date.now())
      // Quem chama invalida as inscrições: a próxima consulta já é posterior a esta inscrição
      onAdded(data)
    },
    onError: (err) => {
      setConfirmPerson(null)
      setFormError(apiErrorMessage(err, 'Não foi possível adicionar o jogador.'))
    },
  })

  function restart() {
    setResult(null)
    setMode('search')
    setSearch('')
    setFullName('')
    setNickname('')
    setFormError(null)
  }

  function submitNew() {
    const name = fullName.trim()
    if (name.length < 2) {
      setFormError('Informe o nome do jogador.')
      return
    }
    addMutation.mutate({ fullName: name, nickname: nickname.trim() || undefined })
  }

  const confirmName = confirmPerson ? confirmPerson.nickname?.trim() || confirmPerson.fullName : ''

  if (result && resultUndone) {
    return (
      <Sheet isOpen onClose={onClose} title="Adicionar jogador">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Undo2 className="h-12 w-12 text-accent-yellow" />
          <p className="text-xl font-bold text-text-primary">Inscrição desfeita</p>
          <p className="text-base text-text-secondary">{playerName(result.entry)} não está mais no torneio.</p>
          <Button size="lg" className="w-full" onClick={restart}>
            <UserPlus className="h-5 w-5" /> Voltar à busca
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </Sheet>
    )
  }

  if (result) {
    const name = playerName(result.entry)
    return (
      <Sheet isOpen onClose={onClose} title="Adicionar jogador">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-accent-green" />
          <p className="text-xl font-bold text-text-primary">{name} entrou no torneio</p>
          <p className="text-base text-text-secondary">
            {result.tableId && result.seatNumber
              ? `Sentou na ${result.tableName ?? 'mesa'}, lugar ${result.seatNumber}`
              : 'Ainda sem mesa'}
          </p>
          <p className="text-sm text-accent-red">Buy-in de {buyIn} pendente.</p>
          <Button size="lg" variant="success" className="w-full" onClick={() => onPay(result.entry)}>
            <CreditCard className="h-5 w-5" /> Registrar pagamento agora
          </Button>
          <Button variant="secondary" className="w-full" onClick={restart}>
            <UserPlus className="h-4 w-4" /> Adicionar outro
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </Sheet>
    )
  }

  if (mode === 'new') {
    return (
      <Sheet isOpen onClose={() => setMode('search')} title="Cadastrar novo jogador">
        <div className="flex flex-col gap-3">
          <Input
            label="Nome completo"
            value={fullName}
            maxLength={120}
            autoFocus
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Apelido (opcional)"
            value={nickname}
            maxLength={60}
            onChange={(e) => setNickname(e.target.value)}
          />
          <p className="text-sm text-text-muted">Buy-in de {buyIn} fica pendente.</p>
          {formError && <p className="rounded-lg bg-accent-red/10 p-2.5 text-sm text-accent-red">{formError}</p>}
          <Button size="lg" className="w-full" loading={addMutation.isPending} onClick={submitNew}>
            <UserPlus className="h-5 w-5" />
            {fullName.trim() ? `Adicionar ${nickname.trim() || fullName.trim()}` : 'Adicionar ao torneio'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setMode('search')} disabled={addMutation.isPending}>
            Voltar para a lista
          </Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title="Adicionar jogador"
      toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Buscar pelo nome ou apelido" debounceMs={150} />}
    >
      {formError && <p className="mb-3 rounded-lg bg-accent-red/10 p-2.5 text-sm text-accent-red">{formError}</p>}
      {isLoading ? (
        <LoadingSpinner size="md" text="Carregando jogadores..." className="py-8" />
      ) : (
        <>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              {search.trim() ? 'Ninguém com esse nome.' : 'Todos os jogadores do home game já estão no torneio.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null)
                      setConfirmPerson(p)
                    }}
                    className="flex min-h-[56px] w-full items-center gap-2.5 rounded-lg border border-border-default bg-bg-secondary p-2 text-left"
                  >
                    <Avatar src={p.photoUrl} name={p.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">
                        {p.nickname?.trim() || p.fullName}
                      </span>
                      {p.nickname?.trim() && (
                        <span className="block truncate text-xs text-text-muted">{p.fullName}</span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-accent-blue">Adicionar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => {
              setFormError(null)
              setFullName(search.trim())
              setMode('new')
            }}
          >
            <UserPlus className="h-4 w-4" /> Não achou? Cadastrar novo
          </Button>
        </>
      )}

      <ConfirmDialog
        isOpen={!!confirmPerson}
        onClose={() => setConfirmPerson(null)}
        onConfirm={() => confirmPerson && addMutation.mutate({ personId: confirmPerson.id })}
        title="Adicionar jogador"
        message={`Adicionar ${confirmName} ao torneio? Buy-in de ${buyIn} fica pendente.`}
        confirmLabel="Adicionar"
        variant="warning"
        loading={addMutation.isPending}
      />
    </Sheet>
  )
}
