import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as homeGamesApi from '../../api/homeGames.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import type { HomeGameDeletionSummary } from '../../types/homeGame.types'
import { errorMessage } from '../../utils/httpErrors'

/** Mesma regra do servidor: sem diferenciar maiúsculas e ignorando espaços nas pontas (Unicode em NFC). */
function homeGameNameMatches(typed: string, name: string): boolean {
  const canonical = (value: string) => value.trim().normalize('NFC').toLocaleUpperCase('pt-BR')
  return typed.trim() !== '' && canonical(typed) === canonical(name)
}

function count(n: number, one: string, many: string) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

interface DeleteHomeGameModalProps {
  isOpen: boolean
  onClose: () => void
  homeGameId: string
  /** Nome conhecido de quem abriu (aparece enquanto o resumo carrega) */
  homeGameName: string
  /**
   * Depois de excluir (o toast "Home game excluído" já saiu e as listas foram invalidadas aqui): quem abriu troca o
   * home game ativo (refreshHomeGames do HomeGameContext) e decide para onde a tela vai. O modal fecha em seguida.
   */
  onDeleted?: (summary: HomeGameDeletionSummary) => void | Promise<void>
}

/**
 * Excluir home game (SPEC-20261026-1126) — o mesmo modal na página do home game e na ficha do usuário da
 * Administração. Fecha só no X/Cancelar. Mostra quantos torneios, jogadores e rankings somem (e os membros que perdem
 * o acesso); com torneio em andamento só mostra a recusa; o botão só habilita com o nome do home game digitado (o
 * servidor confere de novo).
 */
export function DeleteHomeGameModal(props: DeleteHomeGameModalProps) {
  if (!props.isOpen) return null
  return <OpenDeleteHomeGameModal {...props} />
}

function OpenDeleteHomeGameModal({ onClose, homeGameId, homeGameName, onDeleted }: DeleteHomeGameModalProps) {
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    data: summary,
    isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ['homeGameDeletionSummary', homeGameId],
    queryFn: () => homeGamesApi.getDeletionSummary(homeGameId),
    // Sempre a contagem de agora (torneio pode ter começado desde a última vez)
    staleTime: 0,
    gcTime: 0,
  })

  const name = summary?.name ?? homeGameName
  const blocked = !!summary?.blockedMessage
  const matches = homeGameNameMatches(typed, name)
  const canDelete = !!summary && !blocked && matches && !deleting

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!summary || blocked) return
    if (!matches) {
      setError('Digite o nome do home game exatamente como aparece acima.')
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await homeGamesApi.remove(homeGameId, typed)
    } catch (err) {
      setError(errorMessage(err) ?? 'Não foi possível excluir o home game. Tente de novo.')
      setDeleting(false)
      // A recusa por torneio em andamento muda o resumo: busca de novo para mostrar o bloqueio
      void refetch()
      return
    }

    toast.success('Home game excluído')
    // Listas e contagens que mostravam o home game (inclusive o uso do plano e a ficha da Administração). O resumo
    // deste modal some sozinho ao fechar (gcTime 0).
    void queryClient.invalidateQueries({ queryKey: ['homeGames'] })
    void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-user'] })
    try {
      await onDeleted?.(summary)
    } finally {
      onClose()
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Excluir home game"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          {!blocked && (
            <Button
              variant="danger"
              type="submit"
              form="excluir-home-game-form"
              loading={deleting}
              disabled={!canDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir home game
            </Button>
          )}
        </div>
      }
    >
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-label="Carregando" />
        </div>
      )}

      {isError && !summary && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-text-secondary" role="alert">
            {errorMessage(loadError) ?? 'Não foi possível carregar o que será excluído.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {summary && (
        <form id="excluir-home-game-form" className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <p className="break-words text-sm text-text-secondary">
            O home game <strong className="font-bold text-text-primary">{name}</strong> sai de todas as telas junto
            com tudo o que está nele:
          </p>

          <ul className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-bg-secondary p-3 text-sm text-text-primary">
            <li className="tabular-nums">{count(summary.tournaments, 'torneio', 'torneios')}</li>
            <li className="tabular-nums">{count(summary.players, 'jogador', 'jogadores')}</li>
            <li className="tabular-nums">
              {count(summary.rankings, 'ranking', 'rankings')}
              {summary.rankings > 0 && (
                <span className="text-text-secondary">
                  {' '}
                  (o link público {summary.rankings === 1 ? 'deixa' : 'deixam'} de abrir)
                </span>
              )}
            </li>
            {summary.members > 0 && (
              <li className="tabular-nums">
                {count(summary.members, 'membro perde', 'membros perdem')} o acesso
              </li>
            )}
          </ul>

          <p className="text-sm text-text-secondary">
            Telões e acessos de dealer dos torneios são desconectados. Não dá para desfazer por aqui.
          </p>

          {blocked ? (
            <p
              className="flex items-start gap-2 rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3 text-sm text-text-primary"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-gold-deep" aria-hidden="true" />
              <span className="break-words">{summary.blockedMessage}</span>
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="break-words text-sm text-text-secondary">
                Para confirmar, digite <strong className="font-bold text-text-primary">{name}</strong>.
              </p>
              <Input
                id="excluir-home-game-nome"
                aria-label="Nome do home game"
                value={typed}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={deleting}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setError(null)
                }}
              />
            </div>
          )}

          {error && (
            <p
              className="break-words rounded-lg border border-accent-red/40 bg-accent-red-soft p-3 text-sm text-accent-red-deep"
              role="alert"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
