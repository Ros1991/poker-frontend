import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as meApi from '../../api/me.api'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import type { ExternalLoginItem, ExternalLogins } from '../../types/profile.types'
import { errorMessage } from '../../utils/httpErrors'
import { ProfileGoogleButton } from './ProfileGoogleButton'
import { ProfileSection } from './ProfileSection'
import { LOGINS_QUERY_KEY, formatDay } from './profileFormat'

interface ConnectedAccountsSectionProps {
  logins: ExternalLogins | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/**
 * Contas conectadas (SPEC-20261023-1211): conectar e desconectar o Google (Apple só quando estiver ligada). Desconectar
 * a única forma de entrar (conta sem senha) fica bloqueado aqui e no servidor.
 */
export function ConnectedAccountsSection({ logins, isLoading, isError, onRetry }: ConnectedAccountsSectionProps) {
  return (
    <ProfileSection
      id="contas-conectadas"
      icon={Link2}
      title="Contas conectadas"
      description="Entre com um clique pelo Google, além do e-mail e senha."
    >
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-label="Carregando" />
        </div>
      )}
      {isError && !logins && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-text-secondary">Não foi possível carregar as contas conectadas.</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      )}
      {logins && (
        <ul className="flex flex-col divide-y divide-border-default">
          {logins.providers.map((item) => (
            <ProviderRow key={item.provider} item={item} hasPassword={logins.hasPassword} />
          ))}
          {logins.providers.length === 0 && (
            <li className="py-2 text-sm text-text-secondary">O login com o Google está desligado no momento.</li>
          )}
        </ul>
      )}
    </ProfileSection>
  )
}

function ProviderRow({ item, hasPassword }: { item: ExternalLoginItem; hasPassword: boolean }) {
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const account = item.accounts[0]

  async function connect(idToken: string, nonce: string) {
    setConnecting(true)
    try {
      const next = await meApi.connectLogin(item.provider, { idToken, nonce })
      queryClient.setQueryData(LOGINS_QUERY_KEY, next)
      toast.success(`${item.displayName} conectado`)
    } catch (err) {
      toast.error(errorMessage(err) ?? `Não foi possível conectar o ${item.displayName}. Tente de novo.`)
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      const next = await meApi.disconnectLogin(item.provider)
      queryClient.setQueryData(LOGINS_QUERY_KEY, next)
      setConfirmOpen(false)
      toast.success(`${item.displayName} desconectado`)
    } catch (err) {
      toast.error(errorMessage(err) ?? `Não foi possível desconectar o ${item.displayName}.`)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text-primary">{item.displayName}</span>
            {item.connected ? <Badge color="green">Conectado</Badge> : <Badge color="gray">Não conectado</Badge>}
          </div>
          {item.connected && account && (
            <p className="mt-1 break-all text-sm text-text-secondary">
              {account.email ?? 'Conta conectada'} · desde {formatDay(account.connectedAt)}
              {item.accounts.length > 1 && ` (+${item.accounts.length - 1})`}
            </p>
          )}
          {item.connected && !item.canDisconnect && (
            <p className="mt-1 text-sm text-text-secondary">
              É a única forma de entrar na sua conta. Defina uma senha para poder desconectar.
            </p>
          )}
        </div>
        {item.connected && (
          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={!item.canDisconnect}
            className="w-full sm:w-auto"
          >
            Desconectar
          </Button>
        )}
      </div>

      {!item.connected && item.enabled && item.clientId && (
        <div className="flex flex-col gap-2 sm:max-w-sm">
          <ProfileGoogleButton
            clientId={item.clientId}
            onCredential={connect}
            busy={connecting}
            busyText={`Conectando o ${item.displayName}…`}
          />
          <p className="text-xs text-text-secondary">
            A conta Google pode ter outro e-mail. Mandamos um aviso para o e-mail da sua conta.
          </p>
        </div>
      )}
      {!item.connected && !item.enabled && (
        <p className="text-sm text-text-secondary">Indisponível no momento.</p>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void disconnect()}
        title={`Desconectar o ${item.displayName}?`}
        message={
          hasPassword
            ? `Depois disso, você entra com e-mail e senha. Dá para conectar o ${item.displayName} de novo quando quiser.`
            : `Depois disso, você entra pelas outras formas conectadas. Dá para conectar o ${item.displayName} de novo quando quiser.`
        }
        confirmLabel="Desconectar"
        variant="danger"
        loading={disconnecting}
      />
    </li>
  )
}
