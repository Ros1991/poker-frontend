import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as tournamentsApi from '../../../api/tournaments.api'
import { Badge } from '../../../components/ui/Badge'
import { SearchInput } from '../../../components/ui/SearchInput'
import { NewTournamentButton } from '../../../components/tournament/NewTournamentButton'
import { TOURNAMENT_STATUS_COLORS, TOURNAMENT_STATUS_LABELS } from '../../../constants/statuses'
import { tournamentDashboardPath } from '../../../constants/routes'
import { hasFeature } from '../../../hooks/usePlan'
import { EmptyState, SectionSpinner } from './EmptyState'
import { useHomeGameShell } from './homeGameShell'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd 'de' MMM, yyyy", { locale: ptBR })
  } catch {
    return dateStr
  }
}

/** Seção Torneios (era a aba Torneios do home game; SPEC-20261029-1724) */
export function TournamentsSection() {
  const { homeGame, label } = useHomeGameShell()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments', homeGame.id, search],
    queryFn: () =>
      tournamentsApi.getAll(homeGame.id, {
        search: search || undefined,
        // Mesma lista que a contagem de Configurações (SPEC-20261026-1907): sem o corte padrão de 20 por página
        pageSize: 100,
      }),
  })
  const tournaments = (data?.data ?? []).filter((t) => t.status !== 'Cancelled')

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar torneios..." className="max-w-sm" />
        <NewTournamentButton homeGameId={homeGame.id} ownerId={homeGame.ownerId} homeGameName={label} size="sm" />
      </div>

      {isLoading && <SectionSpinner />}

      {!isLoading && tournaments.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="Nenhum torneio encontrado"
          description={search ? 'Nenhum resultado para sua busca.' : 'Crie o primeiro torneio.'}
        />
      )}

      {!isLoading && tournaments.length > 0 && (
        <div className="space-y-2">
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(tournamentDashboardPath(t.id))}
              className="w-full flex items-center gap-4 rounded-lg border border-border-default bg-bg-secondary p-4 text-left transition-all hover:border-accent-blue/50 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-text-primary truncate">{t.name}</h4>
                  <Badge color={TOURNAMENT_STATUS_COLORS[t.status] ?? 'gray'}>
                    {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(t.date)}
                  </span>
                  <span className="tabular-nums">Buy-in: {formatCurrency(t.buyInAmount)}</span>
                  <span>
                    {t.totalEntries} entrada{t.totalEntries !== 1 && 's'}
                  </span>
                  {t.rankingName && (
                    <span className="flex items-center gap-1 text-accent-gold-deep" title={`Ranking: ${t.rankingName}`}>
                      <Trophy className="h-3.5 w-3.5" />
                      {t.rankingName}
                    </span>
                  )}
                </div>
              </div>
              {/* Sem premiação no plano do dono (Mesa) o valor não aparece */}
              {hasFeature(t.planFeatures, 'Prizes') && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-accent-green-deep tabular-nums">
                    {formatCurrency(t.totalPrizePool)}
                  </div>
                  <div className="text-xs text-text-secondary">Premiação</div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
