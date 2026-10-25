import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Laptop, Loader2, MonitorSmartphone, Smartphone, Tablet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import * as meApi from '../../api/me.api'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import type { DeviceSession, DeviceType } from '../../types/profile.types'
import { errorMessage } from '../../utils/httpErrors'
import { ProfileSection } from './ProfileSection'
import { SESSIONS_QUERY_KEY, formatDayTime, formatLastUse } from './profileFormat'

const DEVICE_ICONS: Record<DeviceType, LucideIcon> = {
  desktop: Laptop,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: MonitorSmartphone,
}

interface SessionsSectionProps {
  sessions: DeviceSession[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/**
 * Aparelhos conectados (SPEC-20261023-1211): cada sessão ativa com navegador e sistema, último uso e "Este aparelho";
 * "Sair" tira um aparelho e "Sair dos outros aparelhos" deixa só este.
 */
export function SessionsSection({ sessions, isLoading, isError, onRetry }: SessionsSectionProps) {
  const queryClient = useQueryClient()
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [revokingOthers, setRevokingOthers] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const others = sessions?.filter((s) => !s.current).length ?? 0

  async function revokeOthers() {
    setRevokingOthers(true)
    try {
      const count = await meApi.revokeOtherSessions()
      setConfirmOthers(false)
      toast.success(count === 1 ? '1 aparelho saiu da sua conta' : `${count} aparelhos saíram da sua conta`)
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY })
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível tirar os outros aparelhos.')
    } finally {
      setRevokingOthers(false)
    }
  }

  async function revoke(session: DeviceSession) {
    setRevokingId(session.id)
    try {
      await meApi.revokeSession(session.id)
      toast.success(`${session.label} saiu da sua conta`)
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY })
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível tirar o aparelho.')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <ProfileSection
      id="aparelhos"
      icon={MonitorSmartphone}
      title="Aparelhos conectados"
      description="Onde a sua conta está aberta agora. Não reconhece algum? Tire ele daqui e troque a senha."
      action={
        others > 0 ? (
          <Button variant="secondary" onClick={() => setConfirmOthers(true)} className="w-full sm:w-auto">
            Sair dos outros aparelhos
          </Button>
        ) : undefined
      }
    >
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-label="Carregando" />
        </div>
      )}
      {isError && !sessions && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-text-secondary">Não foi possível carregar os aparelhos.</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      )}
      {sessions && (
        <ul className="flex flex-col divide-y divide-border-default" aria-label="Aparelhos conectados">
          {sessions.map((session) => {
            const Icon = DEVICE_ICONS[session.deviceType] ?? MonitorSmartphone
            return (
              <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary text-text-secondary"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-primary">{session.label}</span>
                    {session.current && <Badge color="blue">Este aparelho</Badge>}
                  </div>
                  <p className="text-sm text-text-secondary" title={`Entrou em ${formatDayTime(session.createdAt)}`}>
                    {session.current ? 'Em uso agora' : `Último uso ${formatLastUse(session.lastUsedAt ?? session.createdAt)}`}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void revoke(session)}
                    loading={revokingId === session.id}
                    disabled={revokingId !== null}
                    className="min-h-[44px] shrink-0"
                    aria-label={`Sair do aparelho ${session.label}`}
                  >
                    Sair
                  </Button>
                )}
              </li>
            )
          })}
          {sessions.length === 0 && (
            <li className="py-2 text-sm text-text-secondary">Nenhum aparelho com sessão ativa.</li>
          )}
        </ul>
      )}

      <ConfirmDialog
        isOpen={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        onConfirm={() => void revokeOthers()}
        title="Sair dos outros aparelhos?"
        message={
          others === 1
            ? 'O outro aparelho sai da sua conta e precisa entrar de novo. Este continua conectado.'
            : `Os outros ${others} aparelhos saem da sua conta e precisam entrar de novo. Este continua conectado.`
        }
        confirmLabel="Sair dos outros"
        variant="danger"
        loading={revokingOthers}
      />
    </ProfileSection>
  )
}
