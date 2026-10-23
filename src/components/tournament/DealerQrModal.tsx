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
import { dealerAccessPath } from '../../constants/routes'

interface DealerQrModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  tournamentName: string
}

/**
 * QR que abre o terminal do dealer no celular, sem login e só deste torneio.
 * Vale até o torneio terminar (no máximo 24h); gerar outro derruba o anterior.
 */
export function DealerQrModal({ isOpen, onClose, tournamentId, tournamentName }: DealerQrModalProps) {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null)
  const queryKey = ['dealer-access', tournamentId]

  const { data: access, isLoading } = useQuery({
    queryKey,
    queryFn: () => dealerAccessApi.getActive(tournamentId),
    enabled: isOpen,
  })

  const createMutation = useMutation({
    mutationFn: () => dealerAccessApi.create(tournamentId),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKey, created)
      setConfirm(null)
    },
    onError: () => toast.error('Não foi possível gerar o QR do dealer.'),
  })

  const revokeMutation = useMutation({
    mutationFn: () => dealerAccessApi.revoke(tournamentId),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null)
      setConfirm(null)
      toast.success('QR do dealer desativado.')
    },
    onError: () => toast.error('Não foi possível desativar o QR.'),
  })

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

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="QR do dealer" size="sm">
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
              O dealer lê com a câmera do celular e abre o terminal deste torneio — sem login e sem acesso a mais
              nada.
            </p>
            <p className="text-center text-xs text-text-muted">
              Vale até o torneio terminar (no máximo até {validUntil}).
              {access.exchangeCount > 0 &&
                ` Lido ${access.exchangeCount} ${access.exchangeCount === 1 ? 'vez' : 'vezes'}.`}
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
            <div className="flex w-full flex-col gap-1 border-t border-border-default pt-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirm('regenerate')}>
                <RefreshCw className="h-4 w-4" />
                Gerar novo QR
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-accent-red"
                onClick={() => setConfirm('revoke')}
              >
                Desativar acesso do dealer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <p className="text-sm text-text-secondary">
              Gere um QR para o dealer abrir o terminal deste torneio no celular, sem precisar de conta.
            </p>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
              Gerar QR do dealer
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirm === 'regenerate'}
        onClose={() => setConfirm(null)}
        onConfirm={() => createMutation.mutate()}
        title="Gerar novo QR?"
        message="O QR atual para de funcionar na hora e quem estiver usando o terminal por ele vai precisar ler o novo."
        confirmLabel="Gerar novo"
        variant="warning"
        loading={createMutation.isPending}
      />
      <ConfirmDialog
        isOpen={confirm === 'revoke'}
        onClose={() => setConfirm(null)}
        onConfirm={() => revokeMutation.mutate()}
        title="Desativar acesso do dealer?"
        message="Quem estiver usando o terminal pelo QR perde o acesso na hora."
        confirmLabel="Desativar"
        variant="danger"
        loading={revokeMutation.isPending}
      />
    </>
  )
}
