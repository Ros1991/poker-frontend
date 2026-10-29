import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarDays,
  Crown,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Plus,
  Radio,
  Smartphone,
  Spade,
  Tablet,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import * as inicioApi from '../../api/inicio.api'
import { INICIO_QUERY_KEY } from '../../api/inicio.api'
import { Badge } from '../../components/ui/Badge'
import { NewTournamentButton } from '../../components/tournament/NewTournamentButton'
import { useAuth } from '../../hooks/useAuth'
import { useHomeGame } from '../../hooks/useHomeGame'
import { usePlan, MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import { useMePlayer } from '../../hooks/useMePlayer'
import { TOURNAMENT_STATUS_COLORS, TOURNAMENT_STATUS_LABELS } from '../../constants/statuses'
import {
  ROUTES,
  dealerMiniTvPath,
  dealerTerminalPath,
  homeGameSectionPath,
  myTournamentLivePath,
  tournamentDashboardPath,
} from '../../constants/routes'
import { cn } from '../../utils/cn'
import type { BadgeColor } from '../../components/ui/Badge'
import type { HomeGame } from '../../types/homeGame.types'
import type { Inicio, InicioHomeGame, InicioLiveTournament, InicioTournament } from '../../types/inicio.types'
import type { MePlayerSummary, MyTournament } from '../../types/mePlayer.types'
import { HomeGameFormModal } from '../home-games/HomeGameFormModal'
import { MyTournamentRow } from '../me/MyTournamentRow'
import { PlayerEmailHint, PlayerStats } from '../me/PlayerSummaryParts'
import { isStillPlaying, resultText } from '../me/myTournamentFormat'

// ------------------------------------------------------------------ apoio

const linkButton = (variant: 'primary' | 'secondary' | 'ghost' = 'secondary') =>
  cn(
    'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
    variant === 'primary' && 'bg-accent-blue text-white hover:bg-accent-blue-hover',
    variant === 'secondary' && 'border border-border-input bg-bg-card text-text-primary hover:bg-bg-tertiary',
    variant === 'ghost' && 'text-accent-blue hover:bg-accent-blue-soft',
  )

function formatDay(iso: string): string {
  try {
    const d = new Date(iso)
    const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(d)
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
    return `${day} · ${time}`
  } catch {
    return iso
  }
}

function firstName(name: string | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

/** Nome do home game para a tela: o nome do clube; no principal de dono Mesa, o nome da conta */
function labelOf(hg: InicioHomeGame, myName: string): string {
  if (hg.displayName) return hg.displayName
  return hg.isOwner ? myName : hg.ownerName ?? hg.name
}

function liveState(t: InicioLiveTournament): { label: string; color: BadgeColor } {
  if (t.status === 'BreakSettlement') return { label: TOURNAMENT_STATUS_LABELS.BreakSettlement, color: 'yellow' }
  if (!t.currentLevel) return { label: 'Aguardando o relógio', color: 'gray' }
  return t.isTimerRunning ? { label: 'Em andamento', color: 'green' } : { label: 'Pausado', color: 'yellow' }
}

/** Dica dispensável "Dê um nome ao seu clube" (guardada por conta neste navegador) */
const tipKey = (userId: string, homeGameId: string) => `poker_dica_nome_clube:${userId}:${homeGameId}`
function readTipDismissed(userId: string | undefined, homeGameId: string | null): boolean {
  if (!userId || !homeGameId) return false
  try {
    return localStorage.getItem(tipKey(userId, homeGameId)) === '1'
  } catch {
    return false
  }
}

function Section({
  title,
  icon: Icon,
  action,
  children,
  id,
}: {
  title: string
  icon: typeof Trophy
  action?: ReactNode
  children: ReactNode
  id: string
}) {
  return (
    <section aria-labelledby={`inicio-${id}`} data-inicio-section={id} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`inicio-${id}`} className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <Icon className="h-5 w-5 text-text-secondary" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ------------------------------------------------------------------ página

interface InicioPageProps {
  /** `/home-games/new` (só a Liga): o Início com o modal "Novo home game" aberto */
  createHomeGame?: boolean
}

/**
 * Início da conta (SPEC-20261029-1724, D7): a porta de entrada de quem está logado (`/`, o login, o cadastro
 * confirmado e as boas-vindas caem aqui). Diz o que está acontecendo agora:
 * - saudação e o plano (selo + Meu plano);
 * - Agora: torneios iniciados dos home games que a conta acessa, com Painel, Telão no celular (SPEC-20261029-1721) e
 *   Terminal do dealer;
 * - Mesa e Clube: Meus torneios (os 5 últimos + Novo torneio); Liga: um cartão por home game, com Criar home game;
 * - Clubes em que você participa (membro do clube de outra pessoa);
 * - no Clube/Liga, enquanto o nome do clube é o padrão, a dica dispensável "Dê um nome ao seu clube em Configurações";
 * - Como jogador (SPEC-20261029-1726, `GET me/player`): os números de quem joga, os 5 últimos torneios e "Ver todos" →
 *   /meus-torneios; sem nenhuma inscrição vinculada, a dica de pedir ao organizador para cadastrar o e-mail da conta. O
 *   torneio acontecendo em que a conta está inscrita entra em Agora com "Acompanhar" (no cartão de quem organiza, se ele
 *   já está lá). Vem antes de "Meus torneios" quando a conta joga em algum lugar ou ainda não organizou nenhum torneio.
 * O resto vem de `GET me/inicio`.
 */
export function InicioPage({ createHomeGame = false }: InicioPageProps) {
  const { user } = useAuth()
  const { myPlan } = usePlan()
  const { refreshHomeGames } = useHomeGame()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const player = useMePlayer({ refetchOnMount: 'always' })
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...INICIO_QUERY_KEY, user?.id ?? 'anon'],
    queryFn: inicioApi.getInicio,
    enabled: !!user?.id,
    refetchOnMount: 'always',
    // "Agora" acompanha o torneio que começou ou acabou sem precisar recarregar
    refetchInterval: 60_000,
  })

  const [tipDismissedFor, setTipDismissedFor] = useState<string | null>(null)

  // Criar home game só existe na Liga: quem chega aqui por link sem ser Liga fica no Início
  const isLiga = data?.homeGamesVisible ?? myPlan?.limits.homeGamesVisible
  if (createHomeGame && isLiga === false) return <Navigate to={ROUTES.INICIO} replace />

  async function created(homeGame: HomeGame) {
    await refreshHomeGames()
    void queryClient.invalidateQueries({ queryKey: INICIO_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
    navigate(homeGameSectionPath(homeGame.id, 'torneios'), { replace: true })
  }

  const myName = user?.name ?? ''
  const plan = data?.plan ?? myPlan?.effectivePlan ?? user?.effectivePlan ?? user?.plan

  return (
    <div className="mx-auto max-w-5xl space-y-8" data-inicio>
      {/* Saudação + plano */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">Olá, {firstName(myName) || 'bem-vindo'}!</h1>
          <p className="mt-1 text-sm text-text-secondary">O que está acontecendo nos seus torneios.</p>
        </div>
        <Link to={ROUTES.MY_PLAN} className={cn(linkButton('secondary'), 'shrink-0')} data-inicio-plan>
          <Crown className="h-4 w-4 text-accent-gold-deep" aria-hidden />
          Meu plano
          {plan && <Badge color={plan === 'Mesa' ? 'gray' : 'gold'}>{plan}</Badge>}
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <p className="text-text-secondary">Não foi possível carregar o Início.</p>
          <button type="button" onClick={() => refetch()} className={cn(linkButton('secondary'), 'mt-3')}>
            Tentar de novo
          </button>
        </div>
      )}

      {data && (
        <InicioContent
          data={data}
          player={player.data}
          myName={myName}
          userId={user?.id}
          tipDismissed={tipDismissedFor === data.primaryHomeGameId || readTipDismissed(user?.id, data.primaryHomeGameId)}
          onDismissTip={() => {
            if (!user?.id || !data.primaryHomeGameId) return
            try {
              localStorage.setItem(tipKey(user.id, data.primaryHomeGameId), '1')
            } catch {
              // sem armazenamento: some só até recarregar
            }
            setTipDismissedFor(data.primaryHomeGameId)
          }}
        />
      )}

      <HomeGameFormModal
        isOpen={createHomeGame && isLiga === true}
        onClose={() => navigate(ROUTES.INICIO, { replace: true })}
        onSuccess={(homeGame) => void created(homeGame)}
      />
    </div>
  )
}

function InicioContent({
  data,
  player,
  myName,
  userId,
  tipDismissed,
  onDismissTip,
}: {
  data: Inicio
  /** Resumo de quem joga (`GET me/player`); undefined enquanto carrega */
  player: MePlayerSummary | undefined
  myName: string
  userId: string | undefined
  tipDismissed: boolean
  onDismissTip: () => void
}) {
  const owned = data.homeGames.filter((h) => h.isOwner)
  const others = data.homeGames.filter((h) => !h.isOwner)
  const primary = owned.find((h) => h.isPrimary) ?? null
  // Vários home games da conta (Liga, ou ex-Liga rebaixada que ficou com os extras): um cartão por home game
  const perHomeGame = data.homeGamesVisible || owned.length > 1
  const showsHomeGames = data.homeGamesVisible || data.homeGames.length > 1
  const showTip = !tipDismissed && data.plan !== 'Mesa' && !!primary?.isNameDefault

  // Como jogador: torneios acontecendo em que a conta está inscrita — no cartão de quem organiza (se já está em Agora)
  // ou num cartão só de jogador
  const playerLive = player?.live ?? []
  const followIds = new Set(playerLive.map((t) => t.tournamentId))
  const managedIds = new Set(data.live.map((t) => t.id))
  const playerOnlyLive = playerLive.filter((t) => !managedIds.has(t.tournamentId))
  const playsSomewhere = (player?.tournamentCount ?? 0) > 0
  const organizesNothing = owned.every((h) => h.tournamentCount === 0)
  const playerFirst = playsSomewhere || organizesNothing
  const asPlayer = player && <AsPlayerSection player={player} />

  return (
    <>
      {showTip && primary && (
        <div
          className="flex items-start gap-3 rounded-xl border border-accent-gold/40 bg-accent-gold-soft p-4"
          data-inicio-tip="nome-do-clube"
        >
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent-gold-deep" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Dê um nome ao seu clube em Configurações</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              Hoje ele se chama “{primary.name}”. O nome aparece no ranking público e na lista de torneios do telão.
            </p>
            <Link
              to={homeGameSectionPath(primary.id, 'configuracoes')}
              className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-sm font-medium text-accent-blue hover:underline"
            >
              Abrir Configurações
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <button
            type="button"
            onClick={onDismissTip}
            aria-label="Dispensar a dica"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Agora */}
      <Section id="agora" title="Agora" icon={Radio}>
        {data.live.length === 0 && playerOnlyLive.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-input bg-bg-secondary px-4 py-6 text-center text-sm text-text-secondary">
            Nenhum torneio em andamento agora.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.live.map((t) => (
              <LiveCard
                key={t.id}
                tournament={t}
                showHomeGame={showsHomeGames}
                myName={myName}
                follow={followIds.has(t.id)}
              />
            ))}
            {playerOnlyLive.map((t) => (
              <PlayerLiveCard key={t.tournamentId} tournament={t} />
            ))}
          </div>
        )}
      </Section>

      {playerFirst && asPlayer}

      {/* Mesa e Clube: Meus torneios; Liga: um cartão por home game */}
      {perHomeGame ? (
        <Section
          id="home-games"
          title="Seus home games"
          icon={LayoutDashboard}
          action={
            data.homeGamesVisible &&
            (owned.length < data.maxOwnedHomeGames ? (
              <Link to={ROUTES.HOME_GAME_NEW} className={linkButton('primary')} data-inicio-create-home-game>
                <Plus className="h-4 w-4" aria-hidden />
                Criar home game
              </Link>
            ) : (
              <span className="text-sm text-text-secondary">
                Seu plano permite até {data.maxOwnedHomeGames} home games.
              </span>
            ))
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {owned.map((hg) => (
              <OwnedHomeGameCard key={hg.id} homeGame={hg} label={labelOf(hg, myName)} />
            ))}
          </div>
        </Section>
      ) : (
        primary && (
          <Section
            id="meus-torneios"
            title="Meus torneios"
            icon={Trophy}
            action={<NewTournamentButton homeGameId={primary.id} ownerId={userId} homeGameName={labelOf(primary, myName)} size="sm" />}
          >
            <div className="rounded-xl border border-border-default bg-bg-secondary">
              <TournamentRows tournaments={primary.recent} empty="Nenhum torneio ainda. Crie o primeiro!" />
              {primary.tournamentCount > 0 && (
                <div className="border-t border-border-default px-4 py-2">
                  <Link to={homeGameSectionPath(primary.id, 'torneios')} className={linkButton('ghost')}>
                    Ver todos os torneios ({primary.tournamentCount})
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              )}
            </div>
          </Section>
        )
      )}

      {/* Clubes de outras pessoas em que a conta é membro */}
      {others.length > 0 && (
        <Section id="clubes" title="Clubes em que você participa" icon={Users}>
          <div className="grid gap-3 md:grid-cols-2">
            {others.map((hg) => (
              <MemberClubCard key={hg.id} homeGame={hg} label={labelOf(hg, myName)} />
            ))}
          </div>
        </Section>
      )}

      {!playerFirst && asPlayer}
    </>
  )
}

/** Como jogador (SPEC-20261029-1726): números, os 5 últimos e "Ver todos"; sem inscrição, a dica do e-mail */
function AsPlayerSection({ player }: { player: MePlayerSummary }) {
  const plays = player.tournamentCount > 0
  return (
    <Section
      id="como-jogador"
      title="Como jogador"
      icon={Spade}
      action={
        plays && (
          <Link to={ROUTES.MY_TOURNAMENTS} className={linkButton('ghost')} data-inicio-player-all>
            Ver todos ({player.tournamentCount})
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )
      }
    >
      {plays ? (
        <div className="space-y-3">
          <PlayerStats summary={player} />
          <div className="rounded-xl border border-border-default bg-bg-secondary">
            <ul className="divide-y divide-border-default">
              {player.recent.map((t) => (
                <MyTournamentRow key={t.tournamentId} tournament={t} />
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <PlayerEmailHint email={player.email} />
      )}
    </Section>
  )
}

/** Acompanhar (área do jogador): o torneio que está acontecendo, com o relógio e a minha ficha */
function FollowLink({ tournamentId, primary = false }: { tournamentId: string; primary?: boolean }) {
  return (
    <Link
      to={myTournamentLivePath(tournamentId)}
      className={linkButton(primary ? 'primary' : 'secondary')}
      data-inicio-action="acompanhar"
    >
      <Spade className="h-4 w-4" aria-hidden />
      Acompanhar
    </Link>
  )
}

/** Torneio acontecendo em que a conta só joga (o clube é de outra pessoa): Acompanhar */
function PlayerLiveCard({ tournament: t }: { tournament: MyTournament }) {
  const state = playerLiveState(t)
  const result = resultText(t)
  const mine = result && result !== 'Jogando' ? ` · ${result}` : isStillPlaying(t) ? ' · jogando' : ''
  return (
    <article
      className="flex flex-col gap-3 rounded-xl border border-accent-blue/30 bg-bg-secondary p-4"
      data-inicio-live={t.tournamentId}
      data-inicio-live-player
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-text-primary">{t.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
            {t.homeGameLabel} · {t.currentLevel ? `Nível ${t.currentLevel} · ` : ''}
            {t.playersRemaining} de {t.totalEntries} jogando
          </p>
        </div>
        <Badge color={state.color} className="shrink-0">
          {state.label}
        </Badge>
      </div>
      <p className="text-xs text-text-secondary">Você está inscrito{mine}</p>
      <div className="flex flex-wrap gap-2">
        <FollowLink tournamentId={t.tournamentId} primary />
      </div>
    </article>
  )
}

function playerLiveState(t: MyTournament): { label: string; color: BadgeColor } {
  if (t.status === 'BreakSettlement') return { label: TOURNAMENT_STATUS_LABELS.BreakSettlement, color: 'yellow' }
  if (!t.currentLevel) return { label: 'Aguardando o relógio', color: 'gray' }
  return t.isTimerRunning ? { label: 'Em andamento', color: 'green' } : { label: 'Pausado', color: 'yellow' }
}

function LiveCard({
  tournament: t,
  showHomeGame,
  myName,
  follow = false,
}: {
  tournament: InicioLiveTournament
  showHomeGame: boolean
  myName: string
  /** A conta também está inscrita neste torneio: "Acompanhar" (área do jogador) */
  follow?: boolean
}) {
  const state = liveState(t)
  return (
    <article
      className="flex flex-col gap-3 rounded-xl border border-accent-blue/30 bg-bg-secondary p-4"
      data-inicio-live={t.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-text-primary">{t.name}</h3>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {showHomeGame && (t.homeGameName ?? myName) ? `${t.homeGameName ?? myName} · ` : ''}
            {t.currentLevel ? `Nível ${t.currentLevel} · ` : ''}
            {t.playersRemaining} de {t.totalEntries} jogando
          </p>
        </div>
        <Badge color={state.color} className="shrink-0">
          {state.label}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {follow && <FollowLink tournamentId={t.id} />}
        <Link to={tournamentDashboardPath(t.id)} className={linkButton('primary')} data-inicio-action="painel">
          <LayoutDashboard className="h-4 w-4" aria-hidden />
          Painel
        </Link>
        <Link to={dealerMiniTvPath(t.id)} className={linkButton('secondary')} data-inicio-action="telao">
          <Smartphone className="h-4 w-4" aria-hidden />
          Telão no celular
        </Link>
        {t.canManage && (
          <Link to={dealerTerminalPath(t.id)} className={linkButton('secondary')} data-inicio-action="terminal">
            <Tablet className="h-4 w-4" aria-hidden />
            Terminal do dealer
          </Link>
        )}
      </div>
    </article>
  )
}

function TournamentRows({ tournaments, empty }: { tournaments: InicioTournament[]; empty: string }) {
  if (tournaments.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-text-secondary">{empty}</p>
  }
  return (
    <ul className="divide-y divide-border-default">
      {tournaments.map((t) => (
        <li key={t.id}>
          <Link
            to={tournamentDashboardPath(t.id)}
            className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-bg-tertiary"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{t.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {formatDay(t.date)} · {plural(t.totalEntries, 'entrada', 'entradas')}
              </p>
            </div>
            <Badge color={TOURNAMENT_STATUS_COLORS[t.status] ?? 'gray'} className="shrink-0">
              {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function OwnedHomeGameCard({ homeGame: hg, label }: { homeGame: InicioHomeGame; label: string }) {
  return (
    <article className="flex flex-col rounded-xl border border-border-default bg-bg-secondary" data-inicio-home-game={hg.id}>
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-text-primary">{label}</h3>
          <p className="mt-0.5 text-xs text-text-secondary">{plural(hg.tournamentCount, 'torneio', 'torneios')}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {hg.isPrimary && <Badge color="blue">Principal</Badge>}
          {!hg.isActive && <Badge color="gray">Inativo</Badge>}
        </div>
      </div>
      <div className="mt-2 flex-1">
        <TournamentRows tournaments={hg.recent.slice(0, 3)} empty="Nenhum torneio ainda." />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default px-4 py-3">
        <Link to={homeGameSectionPath(hg.id, 'torneios')} className={linkButton('ghost')}>
          Abrir
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <NewTournamentButton homeGameId={hg.id} ownerId={hg.ownerId} homeGameName={label} size="sm" />
      </div>
    </article>
  )
}

function MemberClubCard({ homeGame: hg, label }: { homeGame: InicioHomeGame; label: string }) {
  const highlight = hg.next ?? hg.last
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-secondary p-4" data-inicio-club={hg.id}>
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-text-primary">{label}</h3>
        {hg.ownerName && <p className="mt-0.5 truncate text-xs text-text-secondary">de {hg.ownerName}</p>}
      </div>
      {highlight ? (
        <Link
          to={tournamentDashboardPath(highlight.id)}
          className="flex items-center gap-3 rounded-lg bg-bg-primary px-3 py-2 transition-colors hover:bg-bg-tertiary"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text-secondary">{hg.next ? 'Próximo torneio' : 'Último torneio'}</p>
            <p className="truncate text-sm font-medium text-text-primary">{highlight.name}</p>
            <p className="text-xs text-text-secondary">{formatDay(highlight.date)}</p>
          </div>
          <Badge color={TOURNAMENT_STATUS_COLORS[highlight.status] ?? 'gray'} className="shrink-0">
            {TOURNAMENT_STATUS_LABELS[highlight.status] ?? highlight.status}
          </Badge>
        </Link>
      ) : (
        <p className="text-sm text-text-secondary">Nenhum torneio ainda.</p>
      )}
      <Link to={homeGameSectionPath(hg.id, 'torneios')} className={cn(linkButton('secondary'), 'self-start')}>
        Abrir o clube
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </article>
  )
}
