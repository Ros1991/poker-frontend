import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, MessageCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import * as dealerAccessApi from '../../api/dealerAccess.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { apiErrorMessage, formatTime } from '../dealer/terminalFormat'
import { dealerAccessPath } from '../../constants/routes'
import type { DealerRequest } from '../../types/display.types'

interface DealerQrModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  tournamentName: string
}

type Decision = 'approve' | 'reject' | 'revoke'

const DECISION_FALLBACK: Record<Decision, string> = {
  approve: 'Não foi possível autorizar o dealer.',
  reject: 'Não foi possível recusar o pedido.',
  revoke: 'Não foi possível desconectar o dealer.',
}

/** 401/403/404: a consulta periódica dos pedidos não insiste */
function isAccessError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status
  return status === 401 || status === 403 || status === 404
}

/**
 * QR do dealer (SPEC-20261023-1208): o dealer lê, informa o nome e espera; o organizador
 * autoriza ou recusa aqui (ou no banner do painel), vê quem está conectado e desconecta
 * um a um. Vale até o torneio terminar (no máximo 24h). Gerar outro QR invalida o código
 * sem derrubar quem já foi autorizado; "Desativar" derruba todos.
 */
export function DealerQrModal({ isOpen, onClose, tournamentId, tournamentName }: DealerQrModalProps) {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null)
  const [disconnecting, setDisconnecting] = useState<DealerRequest | null>(null)
  const accessKey = ['dealer-access', tournamentId]
  const requestsKey = ['dealer-requests', tournamentId]

  const { data: access, isLoading } = useQuery({
    queryKey: accessKey,
    queryFn: () => dealerAccessApi.getActive(tournamentId),
    enabled: isOpen,
  })

  // Mesma chave do painel: a lista é compartilhada e consultada a cada 5 s enquanto a aba está visível
  const { data: requests = [] } = useQuery({
    queryKey: requestsKey,
    queryFn: () => dealerAccessApi.listRequests(tournamentId),
    enabled: isOpen,
    // Sem acesso ao torneio (401/403/404) não adianta insistir; queda de rede continua tentando
    refetchInterval: (query) =>
      isAccessError(query.state.error) || document.visibilityState !== 'visible' ? false : 5000,
    retry: false,
  })

  const pending = requests.filter((r) => r.status === 'Pending')
  const connected = requests.filter((r) => r.status === 'Approved')

  function refreshLists() {
    void queryClient.invalidateQueries({ queryKey: requestsKey })
    void queryClient.invalidateQueries({ queryKey: accessKey })
  }

  const createMutation = useMutation({
    mutationFn: () => dealerAccessApi.create(tournamentId),
    onSuccess: (created) => {
      queryClient.setQueryData(accessKey, created)
      setConfirm(null)
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível gerar o QR do dealer.')),
  })

  const revokeAccessMutation = useMutation({
    mutationFn: () => dealerAccessApi.revokeAccess(tournamentId),
    onSuccess: () => {
      queryClient.setQueryData(accessKey, null)
      queryClient.setQueryData(requestsKey, [])
      setConfirm(null)
      toast.success('QR do dealer desativado. Todos os dealers foram desconectados.')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível desativar o QR.')),
  })

  const decideMutation = useMutation({
    mutationFn: ({ action, request }: { action: Decision; request: DealerRequest }) => {
      switch (action) {
        case 'approve':
          return dealerAccessApi.approve(tournamentId, request.id)
        case 'reject':
          return dealerAccessApi.reject(tournamentId, request.id)
        case 'revoke':
          return dealerAccessApi.revoke(tournamentId, request.id)
      }
    },
    onSuccess: (_data, { action, request }) => {
      if (action === 'approve') toast.success(`${request.name} autorizado como dealer.`)
      else if (action === 'reject') toast.success(`Pedido de ${request.name} recusado.`)
      else toast.success(`${request.name} desconectado.`)
      setDisconnecting(null)
      refreshLists()
    },
    onError: (err, { action }) => {
      toast.error(apiErrorMessage(err, DECISION_FALLBACK[action]))
      setDisconnecting(null)
      // 400 (pedido venceu, QR revogado…): a lista do servidor já mudou
      refreshLists()
    },
  })

  const decidingId = decideMutation.isPending ? decideMutation.variables?.request.id : undefined

  const link = access ? `${window.location.origin}${dealerAccessPath(access.code)}` : ''
  const validUntil = access
    ? new Date(access.expiresAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado!')
    } catch {
      toast.error('Não foi possível copiar. Mostre o QR para o dealer ler.')
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Terminal do dealer — ${tournamentName}: ${link}`,
  )}`

  const lists = (pending.length > 0 || connected.length > 0) && (
    <div className="flex w-full flex-col gap-4 border-t border-border-default pt-4">
      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Pedidos pendentes ({pending.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {pending.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-primary p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text-primary">{request.name}</p>
                  <p className="text-xs tabular-nums text-text-secondary">
                    Pediu às {formatTime(request.requestedAt)} · vale por 15 min
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="success"
                    className="min-h-[44px]"
                    loading={decidingId === request.id && decideMutation.variables?.action === 'approve'}
                    disabled={decidingId === request.id}
                    onClick={() => decideMutation.mutate({ action: 'approve', request })}
                  >
                    Autorizar
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    loading={decidingId === request.id && decideMutation.variables?.action === 'reject'}
                    disabled={decidingId === request.id}
                    onClick={() => decideMutation.mutate({ action: 'reject', request })}
                  >
                    Recusar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {connected.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Dealers conectados ({connected.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {connected.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-primary p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text-primary">{request.name}</p>
                  <p className="text-xs tabular-nums text-text-secondary">
                    {request.decidedAt ? `Autorizado às ${formatTime(request.decidedAt)}` : 'Autorizado'}
                    {' · '}
                    {request.lastSeenAt
                      ? `último acesso às ${formatTime(request.lastSeenAt)}`
                      : 'ainda não abriu o terminal'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="min-h-[44px] shrink-0 text-accent-red-deep hover:bg-accent-red-soft"
                  disabled={decidingId === request.id}
                  onClick={() => setDisconnecting(request)}
                >
                  Desconectar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="QR do dealer" size="md">
        <div className="-mx-6 max-h-[70vh] overflow-y-auto px-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : access ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={link} size={220} />
              </div>
              <p className="text-center text-sm text-text-secondary">
                O dealer lê com a câmera do celular, informa o nome e espera: o pedido aparece aqui e no painel
                para você autorizar. Só aquele aparelho entra, sem login e sem acesso a mais nada.
              </p>
              <p className="text-center text-xs tabular-nums text-text-secondary">
                Vale até o torneio terminar (no máximo até {validUntil}).
              </p>
              <div className="grid w-full grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
                  <Copy className="h-4 w-4" />
                  Copiar link
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(whatsappUrl, '_blank', 'noopener')}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </div>

              {lists || (
                <p className="w-full border-t border-border-default pt-3 text-center text-xs text-text-secondary">
                  Ninguém pediu acesso ainda.
                </p>
              )}

              <div className="flex w-full flex-col gap-1 border-t border-border-default pt-3">
                <Button variant="ghost" size="sm" onClick={() => setConfirm('regenerate')}>
                  <RefreshCw className="h-4 w-4" />
                  Gerar novo QR
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-accent-red-deep hover:bg-accent-red-soft hover:text-accent-red-deep"
                  onClick={() => setConfirm('revoke')}
                >
                  Desativar acesso do dealer
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <p className="text-sm text-text-secondary">
                Gere um QR para o dealer pedir acesso ao terminal deste torneio pelo celular: ele informa o nome
                e você autoriza aqui, sem precisar de conta.
              </p>
              <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
                Gerar QR do dealer
              </Button>
              {lists}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirm === 'regenerate'}
        onClose={() => setConfirm(null)}
        onConfirm={() => createMutation.mutate()}
        title="Gerar novo QR?"
        message="O QR atual deixa de valer para pedidos novos. Quem já foi autorizado continua conectado e os pedidos aguardando continuam valendo."
        confirmLabel="Gerar novo"
        variant="warning"
        loading={createMutation.isPending}
      />
      <ConfirmDialog
        isOpen={confirm === 'revoke'}
        onClose={() => setConfirm(null)}
        onConfirm={() => revokeAccessMutation.mutate()}
        title="Desativar acesso do dealer?"
        message="O QR deixa de valer e todos os dealers conectados perdem o acesso na hora. Pedidos aguardando são recusados."
        confirmLabel="Desativar"
        variant="danger"
        loading={revokeAccessMutation.isPending}
      />
      <ConfirmDialog
        isOpen={!!disconnecting}
        onClose={() => setDisconnecting(null)}
        onConfirm={() => disconnecting && decideMutation.mutate({ action: 'revoke', request: disconnecting })}
        title={disconnecting ? `Desconectar ${disconnecting.name}?` : 'Desconectar?'}
        message="O terminal dele perde o acesso na hora. Para voltar, ele precisa ler o QR e pedir acesso de novo."
        confirmLabel="Desconectar"
        variant="danger"
        loading={decideMutation.isPending && decideMutation.variables?.action === 'revoke'}
      />
    </>
  )
}
