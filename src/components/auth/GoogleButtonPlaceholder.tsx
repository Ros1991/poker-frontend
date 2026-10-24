import { RefreshCw } from 'lucide-react'
import type { GoogleRetryReason } from './googleIdentity'

interface GoogleButtonSkeletonProps {
  /**
   * Com a moldura de 44 px que o botão oficial usa (o bloco ainda está esperando GET auth/external/providers).
   * Sem ela, só a barra (o próprio botão já tem a moldura).
   */
  framed?: boolean
}

/**
 * Lugar do botão "Continuar com o Google" enquanto ele não pode aparecer: mesma altura do botão oficial (40 px
 * dentro da moldura de 44 px), para o formulário de e-mail não pular quando o botão chega.
 */
export function GoogleButtonSkeleton({ framed = false }: GoogleButtonSkeletonProps) {
  const bar = (
    <div
      className="h-10 w-full max-w-[400px] animate-pulse rounded-md border border-border-input bg-bg-tertiary"
      aria-hidden="true"
      data-google-skeleton=""
    />
  )
  if (!framed) return bar
  return <div className="flex min-h-[44px] w-full items-center justify-center">{bar}</div>
}

/**
 * Aviso neutro de falha passageira (429 do limite por IP, API reiniciando, Wi-Fi caiu) enquanto o botão tenta de
 * novo sozinho — não é o "Abra no navegador", que é só para quando o script do Google não carrega.
 */
export function GoogleRetryNotice({ reason }: { reason: GoogleRetryReason }) {
  return (
    <p
      className="flex items-start justify-center gap-2 text-center text-sm text-text-secondary"
      role="status"
      data-google-retry={reason}
    >
      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
      <span>
        {reason === 'rate'
          ? 'Muitas tentativas seguidas. Espere um minuto: o botão do Google volta sozinho.'
          : 'Não deu para preparar o login com o Google. Tentando de novo…'}
      </span>
    </p>
  )
}
