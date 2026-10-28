import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Check, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import * as entriesApi from '../../api/entries.api'
import * as tournamentPlayersApi from '../../api/tournamentPlayers.api'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/SearchInput'
import { SubmitCheckButton } from '../ui/FormTopBar'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { EditablePhotoAvatar } from '../photo/EditablePhotoAvatar'
import type { AvailablePlayer, BulkCreateEntriesResult, TournamentEntry } from '../../types/entry.types'
import { cn } from '../../utils/cn'
import { cleanWhatsapp } from '../../utils/phone'
import { normalizeSpaces, normalizeText } from '../../utils/text'
import { PlayerFormFields } from './PlayerFormFields'
import { EMPTY_PLAYER_FORM, findSameName, validatePlayerForm } from './playerForm'
import type { PlayerFormErrors, PlayerFormValue } from './playerForm'
import { usePickerLayout } from './usePickerLayout'

interface PlayerPickerProps {
  tournamentId: string
  /** Inscrições do torneio: "Fulano já está no torneio" e nome repetido */
  entries: TournamentEntry[] | undefined
  /** `terminal`: tela cheia do dealer (alvos maiores); `panel`: modal do painel */
  variant: 'panel' | 'terminal'
  /** Resposta inteira do lote: inscrições criadas e onde cada um sentou / quem mudou de lugar (SPEC-20261023-1214) */
  onAdded: (result: BulkCreateEntriesResult) => void
  /**
   * Fechar de quem abriga (X da Modal no painel, "Voltar" do Sheet no terminal). Só é desenhado aqui no layout mínimo
   * (teclado aberto e área visível < 300 px), quando quem abriga esconde o próprio cabeçalho (usePickerLayout).
   */
  onClose: () => void
}

const label = (p: { fullName: string; nickname: string | null }) => p.nickname?.trim() || p.fullName
const matches = (term: string, p: { fullName: string; nickname: string | null }) =>
  normalizeText(p.fullName).includes(term) || (!!p.nickname && normalizeText(p.nickname).includes(term))

function serverMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message
}

/**
 * Busca e campos do cadastro com fonte de 16 px no celular: abaixo disso o iPhone dá zoom ao focar e o campo passa da
 * borda da tela (o "Evandro" do print). A partir de `sm` volta ao tamanho do resto do painel.
 */
const SEARCH_TEXT = '[&_input]:text-base sm:[&_input]:text-sm'

/**
 * "Adicionar jogadores" — o MESMO componente no painel (AddPlayerModal) e no terminal do dealer (AddPlayerSheet)
 * (SPEC-20261023-1213, F8–F12): busca sem acento, lista com foto e multi-seleção, "Selecionar todos"/"Limpar",
 * rodapé fixo com "Adicionar selecionados (N)" e, separado da busca, "Cadastrar jogador novo". Inscreve pelo lote (POST
 * entries/bulk): toda inscrição nasce Pendente, sem "buy-in pago". SPEC-20261027-2133: qualquer "Cadastrar jogador novo"
 * ("Novo", o botão do rodapé e o "Cadastrar 'Fulano'" do estado vazio) abre o formulário com o texto da busca como nome
 * (espaços normalizados, editável, cursor no fim; busca vazia = formulário vazio). Cadastrar com NINGUÉM selecionado
 * ("Cadastrar e adicionar") cria no home game, envia a foto e já inscreve pelo mesmo lote — quem abriga fecha com o
 * mesmo resultado do "Adicionar selecionados" (assentos, avisos de mudança de lugar); se a inscrição falhar, ele fica
 * cadastrado e selecionado com a mensagem do servidor para tentar de novo. Com selecionados ("Cadastrar e selecionar"),
 * volta para a lista selecionado junto com os demais. Ocupa a coluna flex de quem o monta (Sheet sem rolagem no terminal,
 * Modal `fill` no painel), que já acompanha a área visível com o teclado aberto: só a lista/o formulário rola e o
 * rodapé (com os avisos de nome repetido e de erro do servidor) fica sempre à vista. Com pouca altura (teclado aberto —
 * SPEC-20261027-1311) o layout fica compacto: rodapé numa linha só ("Novo" + "Adicionar (N)"; no cadastro, só o botão
 * principal) e o "Voltar para a lista" vira o ícone do topo, para a lista e o formulário não ficarem espremidos; o campo
 * em foco volta para a vista (com folga embaixo) quando o teclado muda a altura. Altura baixa sem teclado (computador com
 * a janela baixa, celular deitado) fica com o rodapé completo. Com menos de 300 px visíveis (celular deitado com o
 * teclado: sobram 150–240 px) o layout é mínimo: quem abriga esconde o cabeçalho, o fechar dele vem para a barra de cima
 * daqui e, com largura de sobra, os botões sobem para a mesma linha da busca/do título (sem rodapé) — usePickerLayout.
 * A busca e os campos do cadastro ficam no mesmo lugar da árvore em todos os layouts: trocar de layout com o teclado
 * aberto não tira o foco do campo (o teclado não fecha). No celular em pé (< sm) o cadastro segue o X/✓ dos formulários
 * (SPEC-20261027-2132, integração da onda 15): barra de cima com o voltar, o título e o ✓ (nome acessível com o verbo:
 * "Cadastrar e adicionar ao torneio" / "Cadastrar e selecionar"), sem rodapé e com os avisos logo abaixo da barra.
 */
export function PlayerPicker({ tournamentId, entries, variant, onAdded, onClose }: PlayerPickerProps) {
  const queryClient = useQueryClient()
  const terminal = variant === 'terminal'
  const { short, compact, minimal, row, phone, visibleHeight } = usePickerLayout()
  // Cadastro no celular (< sm, 640 px) — fora da linha única do layout mínimo largo, que já tem o botão principal escrito
  // na barra de cima —: X/✓ no topo (padrão dos formulários no celular, SPEC-20261027-2132). O ✓ ao lado do título faz o
  // mesmo que o botão principal (mesma função, validação e estado girando) e o rodapé some; os avisos vão para baixo da
  // barra. No computador nada muda.
  const checkTop = phone && !row
  // Cadastro com a linha única "voltar + título" no topo (e só o botão principal no rodapé): teclado aberto ou pouca
  // altura (celular deitado, mesmo sem teclado — senão o formulário fica sem altura entre o topo e o rodapé); no celular
  // em pé, sempre (é a barra do X/✓)
  const titleRow = compact || short || checkTop
  // Área que rola (lista ou formulário): o campo em foco volta para a vista quando o teclado abre/fecha ou o layout muda
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement) || !scrollRef.current?.contains(el)) return
    const timer = setTimeout(() => {
      if (el.isConnected) el.scrollIntoView({ block: 'nearest' })
    }, 60)
    return () => clearTimeout(timer)
  }, [visibleHeight, compact, minimal, row])
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
  // Cadastro com ninguém selecionado: o jogador novo já entra no torneio ("Cadastrar e adicionar")
  const direct = selectedIds.length === 0
  // Barra da busca: o texto do campo na hora do toque (o onChange da busca chega com 150 ms de atraso)
  const searchBarRef = useRef<HTMLDivElement>(null)

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

  // O texto da busca vira a sugestão de nome em qualquer "Cadastrar jogador novo" (SPEC-20261027-2133)
  function openNew() {
    const live = searchBarRef.current?.querySelector<HTMLInputElement>('input')?.value
    setForm({ ...EMPTY_PLAYER_FORM, fullName: normalizeSpaces(live ?? search) })
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
    setCreated((prev) => [player, ...prev.filter((p) => p.id !== player.id)])
    void queryClient.invalidateQueries({ queryKey: ['availablePlayers', tournamentId] })
    if (direct) {
      // Ninguém selecionado: entra direto no torneio pelo mesmo lote do "Adicionar selecionados"; deu certo → quem abriga
      // fecha/mostra o resultado (onAdded). Falhou → o onError do lote já pôs a mensagem do servidor (addError) e ele fica
      // cadastrado e selecionado na lista para tentar de novo
      try {
        await addMutation.mutateAsync([player.id])
        setSaving(false)
        return
      } catch {
        /* mensagem no addError */
      }
    }
    setSaving(false)
    toast.success(`${label(player)} cadastrado`)
    setSelected((prev) => (prev.includes(player.id) ? prev : [...prev, player.id]))
    setSearch('')
    setMode('list')
  }

  const addMutation = useMutation({
    mutationFn: (ids: string[]) => entriesApi.bulkCreate(tournamentId, ids),
    onSuccess: (result) => {
      setAddError(null)
      setSelected([])
      onAdded(result)
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

  // Layout mínimo (quem abriga escondeu o cabeçalho): o fechar dele vem para cá — X "Fechar" à direita no painel (como
  // no cabeçalho da Modal), "Voltar" à esquerda no terminal (como no Sheet); alvo de 44 px
  const exitButton = terminal ? (
    <button
      type="button"
      onClick={onClose}
      data-picker-exit
      className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-accent-blue hover:bg-bg-tertiary"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only">Voltar</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={onClose}
      data-picker-exit
      aria-label="Fechar"
      className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
    >
      <X className="h-5 w-5" />
    </button>
  )

  // ------------------------------------------------------------------ passo "novo jogador"
  if (mode === 'new') {
    const hasAlerts = !!(duplicate || formError)
    // Nome repetido e erro do servidor ficam junto do botão principal — "Cadastrar e adicionar" ou "Cadastrar e selecionar" — (no rodapé fixo; no layout em linha, logo
    // abaixo da barra de cima): a área do formulário rola e um aviso desenhado lá embaixo ficaria fora da vista
    const alerts = hasAlerts && (
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
    )
    const primary = (
      <Button
        size={terminal ? 'lg' : 'md'}
        className={row ? 'shrink-0 whitespace-nowrap' : undefined}
        onClick={() => void submitNew()}
        loading={saving}
        data-picker-primary
      >
        <UserPlus className="h-4 w-4" /> {direct ? 'Cadastrar e adicionar' : 'Cadastrar e selecionar'}
      </Button>
    )
    // ✓ do topo no celular: o verbo do caso no nome acessível (o ícone sozinho não diz que o jogador já entra no torneio)
    const check = checkTop && (
      <SubmitCheckButton
        action={{
          label: direct ? 'Cadastrar e adicionar ao torneio' : 'Cadastrar e selecionar',
          onClick: () => void submitNew(),
          loading: saving,
        }}
        data-picker-primary
      />
    )
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-player-picker="new" data-picker-compact={compact || undefined} data-picker-minimal={minimal || undefined}>
        {titleRow ? (
          // Teclado aberto, pouca altura ou celular em pé: voltar (ícone, 44 px) e o título numa linha só; no celular em pé
          // também o ✓; no layout mínimo também o X da modal e, com largura de sobra (celular deitado), o botão principal
          // escrito — o formulário fica com o resto
          <div className={cn('flex shrink-0 items-center gap-2 pb-2', pad)} data-dialog-toolbar={minimal || undefined}>
            <button
              type="button"
              onClick={backToList}
              disabled={saving}
              aria-label="Voltar para a lista"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-accent-blue hover:bg-bg-tertiary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            {/* Até 2 linhas, sem cortar (a 320–375 px, com voltar, X e ✓ na barra, não cabe numa linha); 2 linhas de
                leading-tight (40 px) cabem na altura dos botões de 44 px, então a barra não cresce */}
            <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold leading-tight text-text-primary">Cadastrar jogador novo</h3>
            {row && primary}
            {/* X antes do ✓, que fica no canto: a mesma ordem do Modal com submitAction e da FormPageBar ([X][✓]) — quem
                salva no canto de cima à direita não fecha o picker sem querer (revisão da onda 15) */}
            {minimal && !terminal && exitButton}
            {check}
          </div>
        ) : (
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
        )}
        {/* Sem rodapé (linha única larga ou X/✓ do celular): os avisos ficam logo abaixo da barra de cima */}
        {(row || checkTop) && alerts && <div className={cn('shrink-0', pad)}>{alerts}</div>}
        {/* scroll-py-3: o campo rolado para a vista (teclado abre/fecha) fica com folga embaixo — borda e anel de foco inteiros */}
        <div ref={scrollRef} className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-py-3 pb-3', pad)} data-picker-scroll>
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
              // Também com o nome sugerido pela busca: o foco fica no Nome (cursor no fim) para corrigir ou seguir
              autoFocusName
              disabled={saving}
              idPrefix={`novo-${variant}`}
              whatsappHint={terminal ? 'Opcional. Fica só com o organizador.' : 'Opcional.'}
            />
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
        </div>
        {!row && !checkTop && (
          <div
            className={cn('shrink-0 border-t border-border-default pt-3', pad)}
            style={terminal ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined}
          >
            {alerts}
            <div className="flex flex-col gap-2 min-[560px]:flex-row-reverse min-[560px]:justify-between">
              {primary}
              {/* Com o teclado aberto ou pouca altura o "Voltar" fica só no topo: o formulário precisa da altura */}
              {!titleRow && (
                <Button variant="secondary" onClick={backToList} disabled={saving}>
                  Voltar para a lista
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------------ lista
  const emptyHomeGame = !isLoading && !isError && available.length === 0 && (entries?.length ?? 0) === 0 && !term
  const allIn = !isLoading && !isError && available.length === 0 && (entries?.length ?? 0) > 0 && !term

  // Teclado aberto: "Novo" + "Adicionar (N)" numa linha (a contagem vai no botão; "Selecionar todos" e "Limpar" voltam
  // quando o teclado fecha). No rodapé (cabe a 320 px) ou, no layout mínimo com largura de sobra, na linha da busca
  const compactButtons = (
    <>
      <Button
        variant="secondary"
        size={terminal ? 'lg' : 'md'}
        className="shrink-0 whitespace-nowrap"
        onClick={() => openNew()}
        disabled={addMutation.isPending}
        aria-label="Cadastrar jogador novo"
      >
        <UserPlus className="h-4 w-4" /> Novo
      </Button>
      <Button
        size={terminal ? 'lg' : 'md'}
        className={row ? 'shrink-0 whitespace-nowrap' : 'min-w-0 flex-1 whitespace-nowrap'}
        onClick={() => addMutation.mutate(selectedIds)}
        loading={addMutation.isPending}
        disabled={count === 0}
        data-picker-primary
        aria-label={`Adicionar selecionados (${count})`}
      >
        <UserPlus className="h-4 w-4" /> Adicionar ({count})
      </Button>
    </>
  )
  const addErrorBox = addError && <p className="mb-2 rounded-lg bg-accent-red-soft p-2.5 text-sm text-accent-red-deep">{addError}</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-player-picker="list" data-picker-compact={compact || undefined} data-picker-minimal={minimal || undefined}>
      {/* Barra de cima: a busca (sempre no mesmo lugar da árvore — trocar de layout não tira o foco) e, no layout mínimo,
          o fechar de quem abriga e (com largura de sobra) os botões; no mínimo ela faz as vezes de cabeçalho
          (data-dialog-toolbar: o toast desvia dela antes de desviar da lista — useToasterPlacement) */}
      <div ref={searchBarRef} className={cn('flex shrink-0 items-center gap-2 pb-2', pad)} data-dialog-toolbar={minimal || undefined}>
        {minimal && terminal && exitButton}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar pelo nome ou apelido"
          debounceMs={150}
          className={cn('min-w-0 flex-1', SEARCH_TEXT)}
        />
        {row && compactButtons}
        {minimal && !terminal && exitButton}
      </div>
      {row && addErrorBox && <div className={cn('shrink-0', pad)}>{addErrorBox}</div>}

      <div ref={scrollRef} className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-py-3', pad)} data-picker-scroll>
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
                <Button variant="secondary" onClick={() => openNew()}>
                  <UserPlus className="h-4 w-4" /> Cadastrar “{normalizeSpaces(search)}”
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      {!row && (
        <div
          className={cn('shrink-0 border-t border-border-default pt-2', pad)}
          style={terminal ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined}
        >
          {compact && addErrorBox}
          {compact ? (
            <div className="flex gap-2">{compactButtons}</div>
          ) : (
            <>
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
              {addErrorBox}
              {/* Lado a lado a partir de 560 px (celular deitado inclusive): empilhados, a lista ficava sem altura */}
              <div className="flex flex-col gap-2 min-[560px]:flex-row-reverse min-[560px]:justify-between">
                <Button
                  size={terminal ? 'lg' : 'md'}
                  className="whitespace-nowrap"
                  onClick={() => addMutation.mutate(selectedIds)}
                  loading={addMutation.isPending}
                  disabled={count === 0}
                  data-picker-primary
                >
                  <UserPlus className="h-4 w-4" /> Adicionar selecionados ({count})
                </Button>
                <Button variant="secondary" className="whitespace-nowrap" onClick={() => openNew()} disabled={addMutation.isPending}>
                  <UserPlus className="h-4 w-4" /> Cadastrar jogador novo
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
