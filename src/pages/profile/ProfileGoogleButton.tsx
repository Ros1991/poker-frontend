import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'
import { isEmbeddedBrowser } from '../../components/auth/googleIdentity'

interface ProfileGoogleButtonProps {
  /** Client ID público do Google (vem de GET me/logins) */
  clientId: string
  /** ID token do botão + o nonce que está dentro dele (emitido pela API, uso único) */
  onCredential: (idToken: string, nonce: string) => Promise<void> | void
  busy?: boolean
  busyText?: string
}

/**
 * Botão oficial do Google dentro do "Meu perfil" (SPEC-20261023-1211): conectar a conta Google e confirmar a exclusão
 * de conta sem senha. Reaproveita o GoogleSignInButton da SPEC-1210 (nonce da API, popup); o script do Google só
 * carrega quando este bloco aparece. Sem o script (bloqueado, navegador dentro de app) mostra o aviso de abrir no
 * navegador.
 */
export function ProfileGoogleButton({ clientId, onCredential, busy = false, busyText }: ProfileGoogleButtonProps) {
  const [unavailable, setUnavailable] = useState(false)
  const [embedded] = useState(() => isEmbeddedBrowser())

  return (
    <div className="flex w-full flex-col gap-2">
      {!unavailable && (
        <GoogleSignInButton
          clientId={clientId}
          context="signin"
          onCredential={onCredential}
          onUnavailable={() => setUnavailable(true)}
        />
      )}
      {(unavailable || embedded) && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3" role="note">
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" aria-hidden="true" />
          <p className="min-w-0 text-sm text-text-primary">
            {unavailable
              ? 'O botão do Google não carregou aqui. Abra o site no navegador (fora de apps como WhatsApp e Instagram) e tente de novo.'
              : 'O Google não funciona dentro de apps como Instagram e Facebook. Abra o site no navegador.'}
          </p>
        </div>
      )}
      {busy && (
        <p className="text-center text-sm text-text-secondary" role="status">
          {busyText ?? 'Falando com o Google…'}
        </p>
      )}
    </div>
  )
}
