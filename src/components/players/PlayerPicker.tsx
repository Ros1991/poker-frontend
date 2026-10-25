import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Check, UserCheck, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import * as entriesApi from '../../api/entries.api'
import * as tournamentPlayersApi from '../../api/tournamentPlayers.api'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/SearchInput'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { EditablePhotoAvatar } from '../photo/EditablePhotoAvatar'
import type { AvailablePlayer, TournamentEntry } from '../../types/entry.types'
import { cn } from '../../utils/cn'
import { cleanWhatsapp } from '../../utils/phone'
import { normalizeSpaces, normalizeText } from '../../utils/text'
import { PlayerFormFields } from './PlayerFormFields'
import { EMPTY_PLAYER_FORM, findSameName, validatePlayerForm } from './playerForm'
import type { PlayerFormErrors, PlayerFormValue } from './playerForm'

interface PlayerPickerProps {
  tournamentId: string
  /** Inscrições do torneio: "Fulano já está no torneio" e nome repetido */
  entries: TournamentEntry[] | undefined
  /** `terminal`: tela cheia do dealer (alvos maiores); `panel`: modal do painel */
  variant: 'panel' | 'terminal'
  /** Inscrições criadas pelo lote (ponto único de leitura da resposta — a SPEC-20261023-1214 muda o retorno) */
  onAdded: (created: TournamentEntry[]) => void
}

const label = (p: { fullName: string; nickname: string | null }) => p.nickname?.trim() || p.fullName
const matches = (term: string, p: { fullName: string; nickname: string | null }) =>
  normalizeText(p.fullName).includes(term) || (!!p.nickname && normalizeText(p.nickname).includes(term))

function serverMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message
}

/**
 * "Adicionar jogadores" — o MESMO componente no painel (AddPlayerModal) e no terminal do dealer (AddPlayerSheet)
 * (SPEC-20261023-1213, F8–F12): busca sem acento, lista com foto e multi-seleção, "Selecionar todos"/"Limpar",
 * rodapé fixo com "Adicionar selecionados (N)" e, separado da busca, "Cadastrar jogador novo" (formulário vazio;
 * o texto da busca só vira nome pelo "Cadastrar 'Fulano'" do estado vazio). Inscreve pelo lote (POST entries/bulk):
 * toda inscrição nasce Pendente, sem "buy-in pago". Ocupa a coluna flex de quem o monta (Sheet sem rolagem no terminal,
 * Modal `fill` no painel), que já acompanha a área visível com o teclado aberto: só a lista/o formulário rola e o
 * rodapé (com os avisos de nome repetido e de erro do servidor) fica sempre à vista.
 */
export function PlayerPicker({ tournamentId, entries, variant, onAdded }: PlayerPickerProps) {
  const queryClient = useQueryClient()
  const terminal = variant === 'terminal'
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  // Cadastrados aqui: fixados no topo com "novo" (e visíveis antes de a lista recarregar)
  const [created, setCreated] = useState<AvailablePlayer[]>([])
  const [mode, setMode] = useState<'list' | 'new'>('list')
  const [form, setForm] = useState<PlayerFormValue>(EMPTY_PLAYER_FORM)
  const [formErrors, setFormErrors] = useState<PlayerFormErrors>({})
  const [duplicate, setDuplicate] = useState<{ kind: 'available' | 'entry'; id: string; name: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const { data: players, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['availablePlayers', tournamentId],
    queryFn: () => entriesApi.getAvailablePlayers(tournamentId),
  })

  const enrolledPersonIds = useMemo(() => new Set((entries ?? []).map((e) => e.personId)), [entries])

  // Lista base: cadastrados aqui (no topo, os mais recentes primeiro) + os do servidor; quem já entrou no torneio sai
  const available = useMemo(() => {
    const createdIds = new Set(created.map((p) => p.id))
    const fresh = new Map((players ?? []).map((p) => [p.id, p]))
    const pinned = created.map((p) => fresh.get(p.id) ?? p)
    return [...pinned, ...(players ?? []).filter((p) => !createdIds.has(p.id))].filter((p) => !enrolledPersonIds.has(p.id))
  }, [players, created, enrolledPersonIds])

  const availableIds = useMemo(() => new Set(available.map((p) => p.id)), [available])
  const newIds = useMemo(() => new Set(created.map((p) => p.id)), [created])
  const selectedIds = selected.filter((id) => availableIds.has(id))
  const selectedSet = new Set(selectedIds)

  const term = normalizeText(search.trim())
  const filtered = term ? available.filter((p) => matches(term, p)) : available
  const enrolledMatches = term ? (entries ?? []).filter((e) => matches(term, e.person)).slice(0, 5) : []

  function toggle(id: string) {
    setAddError(null)
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAllVisible() {
    setAddError(null)
    setSelected((prev) => [...prev, ...filtered.map((p) => p.id).filter((id) => !prev.includes(id))])
  }

  function openNew(prefill = '') {
    setForm({ ...EMPTY_PLAYER_FORM, fullName: prefill })
    setFormErrors({})
    setDuplicate(null)
    setFormError(null)
    setMode('new')
  }

  function backToList() {
    setMode('list')
    setDuplicate(null)
    setFormError(null)
  }

  function patchForm(p: Partial<PlayerFormValue>) {
    setForm((v) => ({ ...v, ...p }))
    if ('fullName' in p) setDuplicate(null)
    setFormError(null)
    setFormErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(p)) delete next[k as keyof PlayerFormErrors]
      return next
    })
  }

  function selectExisting(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setSearch('')
    backToList()
  }

  // Campo com erro fora da área que rola (teclado aberto, foto no topo): traz para a vista depois de pintar
  function showFieldError(errors: PlayerFormErrors) {
    const first = (['fullName', 'nickname', 'whatsapp'] as const).find((k) => errors[k])
    if (!first) return
    const id = `novo-${variant}-${{ fullName: 'nome', nickname: 'apelido', whatsapp: 'whatsapp' }[first]}`
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  async function submitNew() {
    const errors = validatePlayerForm(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      showFieldError(errors)
      return
    }
    // F11: nome repetido no home game (lista carregada) ou já inscrito → não cadastra de novo
    const inList = findSameName(available, form.fullName)
    if (inList) {
      setDuplicate({ kind: 'available', id: inList.id, name: label(inList) })
      return
    }
    const inEntries = (entries ?? []).find((e) => findSameName([e.person], form.fullName))
    if (inEntries) {
      setDuplicate({ kind: 'entry', id: inEntries.personId, name: label(inEntries.person) })
      return
    }

    setSaving(true)
    let player: AvailablePlayer
    try {
      player = await tournamentPlayersApi.create(tournamentId, {
        fullName: normalizeSpaces(form.fullName),
        nickname: normalizeSpaces(form.nickname) || undefined,
        whatsapp: cleanWhatsapp(form.whatsapp),
      })
    } catch (err) {
      setSaving(false)
      const msg = serverMessage(err) ?? 'Não foi possível cadastrar o jogador.'
      if (/WhatsApp/i.test(msg)) {
        setFormErrors({ whatsapp: msg })
        showFieldError({ whatsapp: msg })
      } else setFormError(msg)
      return
    }

    if (form.photo) {
      try {
        player = await tournamentPlayersApi.uploadPhoto(tournamentId, player.id, form.photo)
      } catch {
        toast.error('Jogador cadastrado, mas a foto não foi enviada. Toque na câmera da linha para tentar de novo.')
      }
    }
    setSaving(false)
    toast.success(`${label(player)} cadastrado`)
    setCreated((prev) => [player, ...prev.filter((p) => p.id !== player.id)])
    setSelected((prev) => (prev.includes(player.id) ? prev : [...prev, player.id]))
    setSearch('')
    setMode('list')
    void queryClient.invalidateQueries({ queryKey: ['availablePlayers', tournamentId] })
  }

  const addMutation = useMutation({
    mutationFn: (ids: string[]) => entriesApi.bulkCreate(tournamentId, ids),
    onSuccess: (createdEntries) => {
      setAddError(null)
      setSelected([])
      onAdded(createdEntries)
    },
    // A seleção fica: dá para corrigir e tentar de novo
    onError: (err) => setAddError(serverMessage(err) ?? 'Não foi possível adicionar os jogadores.'),
  })

  function photoUpdated(updated: AvailablePlayer) {
    setCreated((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    queryClient.setQueryData<AvailablePlayer[]>(['availablePlayers', tournamentId], (old) =>
      old?.map((p) => (p.id === updated.id ? updated : p)),
    )
    void queryClient.invalidateQueries({ queryKey: ['availablePlayers', tournamentId] })
    void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
  }

  const count = selectedIds.length
  const pad = terminal ? 'px-3' : 'px-0'

  // ------------------------------------------------------------------ passo "novo jogador"
  if (mode === 'new') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={cn('shrink-0 pb-2', pad)}>
          <button
            type="button"
            onClick={backToList}
            disabled={saving}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-accent-blue hover:bg-bg-tertiary"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para a lista
          </button>
          <h3 className="mt-1 text-base font-semibold text-text-primary">Cadastrar jogador novo</h3>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3', pad)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submitNew()
            }}
          >
            <PlayerFormFields
              value={form}
              onChange={patchForm}
              errors={formErrors}
              autoFocusName={!form.fullName}
              disabled={saving}
              idPrefix={`novo-${variant}`}
              whatsappHint={terminal ? 'Opcional. Fica só com o organizador.' : 'Opcional.'}
            />
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
        </div>
        <div
          className={cn('shrink-0 border-t border-border-default pt-3', pad)}
          style={terminal ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined}
        >
          {/* Nome repetido e erro do servidor ficam no rodapé fixo, logo acima de "Cadastrar e selecionar": a área
              do formulário rola e um aviso desenhado lá embaixo ficaria fora da vista no celular */}
          {(duplicate || formError) && (
            <div role="alert" className="mb-2 flex flex-col gap-2">
              {duplicate && (
                <div className="flex flex-col gap-2 rounded-lg border border-accent-yellow bg-accent-yellow-soft p-3 sm:flex-row sm:items-center">
                  <p className="flex-1 text-sm text-text-primary">
                    {duplicate.kind === 'available'
                      ? `Já existe ${duplicate.name} no home game.`
                      : `${duplicate.name} já está no torneio.`}
                  </p>
                  {duplicate.kind === 'available' && (
                    <Button variant="secondary" className="min-h-[44px]" onClick={() => selectExisting(duplicate.id)}>
                      <UserCheck className="h-4 w-4" /> Selecionar o existente
                    </Button>
                  )}
                </div>
              )}
              {formError && <p className="rounded-lg bg-accent-red-soft p-2.5 text-sm text-accent-red-deep">{formError}</p>}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-between">
            <Button size={terminal ? 'lg' : 'md'} onClick={() => void submitNew()} loading={saving}>
              <UserPlus className="h-4 w-4" /> Cadastrar e selecionar
            </Button>
            <Button variant="secondary" onClick={backToList} disabled={saving}>
              Voltar para a lista
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ lista
  const emptyHomeGame = !isLoading && !isError && available.length === 0 && (entries?.length ?? 0) === 0 && !term
  const allIn = !isLoading && !isError && available.length === 0 && (entries?.length ?? 0) > 0 && !term

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn('shrink-0 pb-2', pad)}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar pelo nome ou apelido" debounceMs={150} />
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', pad)}>
        {isLoading ? (
          <LoadingSpinner size="md" text="Carregando jogadores..." className="py-8" />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-accent-red" />
            <p className="text-sm text-text-secondary">Não foi possível carregar os jogadores. Verifique a conexão.</p>
            <Button variant="secondary" onClick={() => void refetch()} loading={isFetching}>
              Tentar novamente
            </Button>
          </div>
        ) : emptyHomeGame ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Users className="h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-secondary">Nenhum jogador cadastrado ainda.</p>
            <Button variant="secondary" onClick={() => openNew()}>
              <UserPlus className="h-4 w-4" /> Cadastrar jogador novo
            </Button>
          </div>
        ) : allIn ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-secondary">Todos os jogadores do home game já estão no torneio.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5 pb-2">
            {filtered.map((p) => {
              const isSelected = selectedSet.has(p.id)
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex min-h-[56px] items-center gap-1 rounded-lg border transition-colors',
                    isSelected ? 'border-accent-blue bg-accent-blue-soft' : 'border-border-default bg-bg-card hover:bg-bg-tertiary',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={isSelected}
                    className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left"
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        isSelected ? 'border-accent-blue bg-accent-blue text-white' : 'border-border-input bg-bg-card',
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <Avatar src={p.photoUrl} name={label(p)} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text-primary">{label(p)}</span>
                        {newIds.has(p.id) && <Badge color="green">novo</Badge>}
                      </span>
                      {p.nickname?.trim() && p.nickname.trim() !== p.fullName && (
                        <span className="block truncate text-xs text-text-secondary">{p.fullName}</span>
                      )}
                    </span>
                  </button>
                  {!p.photoUrl && (
                    <EditablePhotoAvatar
                      variant="button"
                      src={p.photoUrl}
                      name={label(p)}
                      upload={async (blob) => photoUpdated(await tournamentPlayersApi.uploadPhoto(tournamentId, p.id, blob))}
                      className="mr-1"
                    />
                  )}
                </li>
              )
            })}

            {enrolledMatches.map((e) => (
              <li
                key={`inscrito-${e.id}`}
                className="flex min-h-[56px] items-center gap-3 rounded-lg border border-border-default bg-bg-tertiary p-2"
              >
                <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                <Avatar src={e.person.photoUrl} name={label(e.person)} size="md" />
                <span className="min-w-0 flex-1 text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">{label(e.person)}</span> já está no torneio
                </span>
              </li>
            ))}

            {/* F12: quem bate com um inscrito aparece como "já está no torneio", sem sugerir cadastrar de novo */}
            {term && filtered.length === 0 && enrolledMatches.length === 0 && (
              <li className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-text-secondary">
                  Nenhum jogador encontrado para “{search.trim()}”.
                </p>
                <Button variant="secondary" onClick={() => openNew(normalizeSpaces(search))}>
                  <UserPlus className="h-4 w-4" /> Cadastrar “{normalizeSpaces(search)}”
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      <div
        className={cn('shrink-0 border-t border-border-default pt-2', pad)}
        style={terminal ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined}
      >
        {/* Alvos de toque ≥ 44 px (o dealer usa em pé, com o celular na mão) */}
        <div className="mb-2 flex min-h-[44px] items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-1 text-text-secondary">
            {count === 0 ? (
              'Nenhum selecionado'
            ) : (
              <>
                <span className="font-semibold text-accent-blue">
                  {count} {count === 1 ? 'selecionado' : 'selecionados'}
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="min-h-[44px] rounded-lg px-2 font-medium text-text-secondary underline underline-offset-2 hover:bg-bg-tertiary hover:text-text-primary"
                >
                  Limpar
                </button>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={selectAllVisible}
            disabled={filtered.length === 0 || filtered.every((p) => selectedSet.has(p.id))}
            className="min-h-[44px] shrink-0 rounded-lg px-2 font-medium text-accent-blue hover:bg-accent-blue-soft disabled:cursor-not-allowed disabled:text-text-secondary disabled:hover:bg-transparent"
          >
            Selecionar todos
          </button>
        </div>
        {addError && <p className="mb-2 rounded-lg bg-accent-red-soft p-2.5 text-sm text-accent-red-deep">{addError}</p>}
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-between">
          <Button
            size={terminal ? 'lg' : 'md'}
            className="whitespace-nowrap"
            onClick={() => addMutation.mutate(selectedIds)}
            loading={addMutation.isPending}
            disabled={count === 0}
          >
            <UserPlus className="h-4 w-4" /> Adicionar selecionados ({count})
          </Button>
          <Button variant="secondary" className="whitespace-nowrap" onClick={() => openNew()} disabled={addMutation.isPending}>
            <UserPlus className="h-4 w-4" /> Cadastrar jogador novo
          </Button>
        </div>
      </div>
    </div>
  )
}
