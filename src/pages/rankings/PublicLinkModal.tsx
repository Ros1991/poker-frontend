import { toast } from 'sonner'
import { Copy, ExternalLink, MessageCircle } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { publicRankingPath } from '../../constants/routes'
import { copyToClipboard } from '../../utils/clipboard'

interface PublicLinkModalProps {
  isOpen: boolean
  onClose: () => void
  slug: string
  rankingName: string
}

export function PublicLinkModal({ isOpen, onClose, slug, rankingName }: PublicLinkModalProps) {
  // O admin roda no mesmo host da SPA, então a origem atual é a pública
  const url = `${window.location.origin}${publicRankingPath(slug)}`

  async function handleCopy() {
    const copied = await copyToClipboard(url)
    if (copied) toast.success('Link copiado')
    else toast.error('Não foi possível copiar. Selecione o endereço e copie manualmente.')
  }

  function handleWhatsApp() {
    const text = `${rankingName}: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  function handleOpen() {
    window.open(url, '_blank', 'noopener')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link público do ranking">
      <p className="mb-3 text-sm text-text-secondary">
        Qualquer pessoa com este link vê a classificação e o resumo de cada jogador, sem
        precisar de login. Não aparecem telefone, e-mail nem valores por jogador.
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Endereço público do ranking"
        className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none"
      />
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button onClick={() => void handleCopy()}>
          <Copy className="h-4 w-4" />
          Copiar
        </Button>
        <Button variant="success" onClick={handleWhatsApp}>
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button variant="secondary" onClick={handleOpen}>
          <ExternalLink className="h-4 w-4" />
          Abrir
        </Button>
      </div>
    </Modal>
  )
}
