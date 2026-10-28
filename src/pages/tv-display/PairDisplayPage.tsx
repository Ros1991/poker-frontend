import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { CheckCircle2, ChevronRight, Tv } from 'lucide-react'
import * as displayPairingApi from '../../api/displayPairing.api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import type { BadgeColor } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ROUTES, pairDisplayPath, tournamentDashboardPath } from '../../constants/routes'
import { TOURNAMENT_STATUS_COLORS } from '../../constants/statuses'
import type { DisplayPaired } from '../../types/display.types'
import type { TournamentStatus } from '../../types/tournament.types'

// Rótulos curtos para a lista do celular; a COR vem da tabela única de statuses.ts
const STATUS_LABEL: Record<string, string> = {
  InProgress: 'Em andamento',
  BreakSettlement: 'Em andamento',
  OpenForRegistration: 'Inscrições',
  Draft: 'Rascunho',
  Finished: 'Finalizado',
}

function statusColor(status: string): BadgeColor {
  return status in TOURNAMENT_STATUS_COLORS
    ? TOURNAMENT_STATUS_COLORS[status as TournamentStatus]
    : 'gray'
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return 'Você não tem acesso a esse torneio.'
    const message = (error.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }
  return 'Não foi possível conectar a TV. Tente de novo.'
}

/** Celular logado: leu o QR da TV (ou digitou o código) e escolhe o torneio. */
export function PairDisplayPage() {
  const { code: codeParam } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const code = codeParam ? normalizeCode(codeParam) : ''
  const [typed, setTyped] = useState('')
  const [paired, setPaired] = useState<DisplayPaired | null>(null)

  const lookup = useQuery({
    queryKey: ['display-pair', code],
    queryFn: () => displayPairingApi.lookupCode(code),
    enabled: code.length === 6 && !paired,
  })

  const tournaments = useQuery({
    queryKey: ['display-my-tournaments'],
    queryFn: displayPairingApi.getMyTournaments,
    enabled: !!lookup.data?.valid,
  })

  const claim = useMutation({
    mutationFn: (tournamentId: string) => displayPairingApi.claim(tournamentId, code),
    onSuccess: setPaired,
  })

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue-soft">
            <Tv className="h-5 w-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Conectar TV</h1>
            {code.length === 6 && (
              <p className="font-mono text-sm tracking-widest text-text-secondary tabular-nums">
                {code.slice(0, 3)} {code.slice(3)}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )

  if (paired) {
    return shell(
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-accent-green" />
        <div>
          <p className="text-lg font-semibold text-text-primary">Pronto!</p>
          <p className="text-text-secondary">
            A TV vai mostrar <span className="font-semibold text-text-primary">{paired.tournamentName}</span> em
            instantes.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={() => navigate(tournamentDashboardPath(paired.tournamentId))}>
            Abrir o painel do torneio
          </Button>
          <Button variant="ghost" onClick={() => navigate(ROUTES.HOME_GAMES)}>
            Ir para o painel
          </Button>
        </div>
      </div>,
    )
  }

  // Sem código (ou inválido): digitar o código que aparece na TV
  if (code.length !== 6 || lookup.data?.valid === false) {
    return shell(
      <form
        className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-5"
        onSubmit={(e) => {
          e.preventDefault()
          const next = normalizeCode(typed)
          if (next.length === 6) navigate(pairDisplayPath(next), { replace: true })
        }}
      >
        {lookup.data?.valid === false && (
          <p className="rounded-lg bg-accent-red-soft px-3 py-2 text-sm text-accent-red-deep">
            Código inválido ou expirado. Confira o código que aparece na TV.
          </p>
        )}
        <label className="flex flex-col gap-2">
          <span className="text-sm text-text-secondary">Digite o código que aparece na TV</span>
          <input
            value={typed}
            onChange={(e) => setTyped(normalizeCode(e.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            placeholder="ABC123"
            className="min-h-[52px] rounded-lg border border-border-input bg-bg-input px-4 text-center font-mono text-2xl tracking-[0.3em] text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
        </label>
        <Button type="submit" disabled={normalizeCode(typed).length !== 6}>
          Continuar
        </Button>
        <Link to={ROUTES.HOME_GAMES} className="text-center text-sm text-text-secondary hover:underline">
          Cancelar
        </Link>
      </form>,
    )
  }

  if (lookup.isLoading || tournaments.isLoading) {
    return shell(
      <div className="flex justify-center py-10">
        <LoadingSpinner />
      </div>,
    )
  }

  if (lookup.isError || tournaments.isError) {
    return shell(
      <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-secondary p-5">
        <p className="text-text-secondary">Sem conexão com o servidor.</p>
        <Button
          onClick={() => {
            void lookup.refetch()
            void tournaments.refetch()
          }}
        >
          Tentar de novo
        </Button>
      </div>,
    )
  }

  const list = tournaments.data ?? []

  return shell(
    <>
      {lookup.data?.currentTournamentName && (
        <p className="rounded-lg bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
          A TV está mostrando{' '}
          <span className="font-semibold text-text-primary">{lookup.data.currentTournamentName}</span>. Escolha outro
          para trocar.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text-secondary">Qual torneio a TV deve mostrar?</p>
        {list.length === 0 && (
          <p className="rounded-xl border border-border-default bg-bg-secondary p-5 text-center text-text-secondary">
            Nenhum torneio disponível nos seus home games.
          </p>
        )}
        {list.map((t) => {
          const statusLabel = STATUS_LABEL[t.status] ?? t.status
          const pending = claim.isPending && claim.variables === t.id
          return (
            <button
              key={t.id}
              type="button"
              disabled={claim.isPending}
              onClick={() => claim.mutate(t.id)}
              className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border-default bg-bg-secondary px-4 py-3 text-left transition-colors hover:border-accent-blue/50 active:bg-bg-tertiary disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text-primary">{t.name}</p>
                <p className="truncate text-xs text-text-secondary tabular-nums">
                  {new Date(t.date).toLocaleDateString('pt-BR')} · {t.homeGameName}
                </p>
              </div>
              <Badge color={statusColor(t.status)}>{statusLabel}</Badge>
              {pending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
              )}
            </button>
          )
        })}
      </div>
      {claim.isError && (
        <p className="rounded-lg bg-accent-red-soft px-3 py-2 text-sm text-accent-red-deep">{errorMessage(claim.error)}</p>
      )}
      <Link to={ROUTES.HOME_GAMES} className="text-center text-sm text-text-secondary hover:underline">
        Cancelar
      </Link>
    </>,
  )
}
