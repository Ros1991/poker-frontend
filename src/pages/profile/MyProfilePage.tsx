/**
 * Página "Meu perfil" (`/meu-perfil`, SPEC-20261023-1211; pesquisa §11).
 *
 * Seções: Foto e dados (nome, apelido, WhatsApp — o cabeçalho reflete na hora), E-mail (só leitura), Senha (trocar,
 * ou definir pelo link do e-mail na conta só-Google), Contas conectadas (Google), Aparelhos conectados, Plano (atalho
 * para "Meu plano") e, no fim, Excluir conta. Tudo vem de `me/*` com a sessão do usuário.
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Crown, Loader2 } from 'lucide-react'
import * as meApi from '../../api/me.api'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import { ConnectedAccountsSection } from './ConnectedAccountsSection'
import { DeleteAccountSection } from './DeleteAccountSection'
import { PasswordSection } from './PasswordSection'
import { ProfileDataSection, ProfileEmailSection } from './ProfileDataSection'
import { ProfileSection } from './ProfileSection'
import { SessionsSection } from './SessionsSection'
import { LOGINS_QUERY_KEY, PROFILE_QUERY_KEY, SESSIONS_QUERY_KEY } from './profileFormat'
import type { Profile } from '../../types/profile.types'

export function MyProfilePage() {
  const profile = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: meApi.getProfile, staleTime: 30_000 })
  const logins = useQuery({ queryKey: LOGINS_QUERY_KEY, queryFn: meApi.getLogins, staleTime: 30_000 })
  const sessions = useQuery({ queryKey: SESSIONS_QUERY_KEY, queryFn: meApi.getSessions, staleTime: 15_000 })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* No celular, com o perfil carregado, o título vai para a barra fixa do topo (X, título e ✓ — SPEC-20261027-2132) */}
      <div className={profile.data ? 'hidden sm:block' : undefined}>
        <h1 className="text-2xl font-bold text-text-primary">Meu perfil</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Seus dados, sua senha e onde a sua conta está aberta.
        </p>
      </div>

      {profile.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" aria-label="Carregando" />
        </div>
      )}

      {profile.isError && !profile.data && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red-soft p-6 text-center">
          <p className="text-text-primary">Não foi possível carregar o seu perfil.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void profile.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {profile.data && (
        <>
          {/* key: o formulário recomeça com os dados salvos se o perfil for de outra conta (troca de sessão) */}
          <ProfileDataSection key={profile.data.id} profile={profile.data} />
          <ProfileEmailSection profile={profile.data} />
          <PasswordSection profile={profile.data} />
          <ConnectedAccountsSection
            logins={logins.data}
            isLoading={logins.isLoading}
            isError={logins.isError}
            onRetry={() => void logins.refetch()}
          />
          <SessionsSection
            sessions={sessions.data}
            isLoading={sessions.isLoading}
            isError={sessions.isError}
            onRetry={() => void sessions.refetch()}
          />
          <PlanShortcut profile={profile.data} />
          <DeleteAccountSection profile={profile.data} logins={logins.data} />
        </>
      )}
    </div>
  )
}

function PlanShortcut({ profile }: { profile: Profile }) {
  return (
    <ProfileSection
      id="plano"
      icon={Crown}
      title="Plano"
      description="O plano é da sua conta e vale para tudo o que você organiza."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-text-secondary">
          Plano atual
          <Badge color={profile.effectivePlan === 'Mesa' ? 'gray' : 'gold'}>{profile.effectivePlan}</Badge>
        </p>
        <Link
          to={ROUTES.MY_PLAN}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-border-input bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue sm:w-auto"
        >
          <Crown className="h-4 w-4 text-accent-gold-deep" aria-hidden="true" /> Ver meu plano
        </Link>
      </div>
    </ProfileSection>
  )
}
