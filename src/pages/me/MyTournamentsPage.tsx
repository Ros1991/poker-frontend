import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import * as mePlayerApi from '../../api/mePlayer.api'
import { MY_TOURNAMENTS_QUERY_KEY } from '../../api/mePlayer.api'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { useAuth } from '../../hooks/useAuth'
import { useMePlayer } from '../../hooks/useMePlayer'
import { MyTournamentRow } from './MyTournamentRow'
import { PlayerEmailHint, PlayerStats } from './PlayerSummaryParts'

const PAGE_SIZE = 20

/**
 * /meus-torneios (SPEC-20261029-1726): os torneios em que a conta jogou, em qualquer clube — só as inscrições cujo jogador
 * está vinculado a ela. Os números da conta por torneio, filtro por clube (`?onde=`) e paginação (`?pagina=`); cada linha
 * abre o torneio (ao vivo ou o resultado).
 */
export function MyTournamentsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const where = params.get('onde') || ''
  const page = Math.max(1, Number(params.get('pagina')) || 1)

  const summary = useMePlayer({ refetchOnMount: 'always' })
  const list = useQuery({
    queryKey: [...MY_TOURNAMENTS_QUERY_KEY, user?.id ?? 'anon', where, page],
    queryFn: () => mePlayerApi.getMyTournaments({ homeGameId: where || null, page, pageSize: PAGE_SIZE }),
    enabled: !!user?.id,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  })

  const homeGames = summary.data?.homeGames ?? []
  const options = [
    { value: '', label: 'Todos os clubes' },
    ...homeGames.map((h) => ({ value: h.id, label: `${h.label} (${h.tournamentCount})` })),
  ]

  function update(next: { onde?: string; pagina?: number }) {
    const p = new URLSearchParams(params)
    if (next.onde !== undefined) {
      if (next.onde) p.set('onde', next.onde)
      else p.delete('onde')
      p.delete('pagina')
    }
    if (next.pagina !== undefined) {
      if (next.pagina > 1) p.set('pagina', String(next.pagina))
      else p.delete('pagina')
    }
    setParams(p, { replace: next.pagina === undefined })
  }

  const noEntries = summary.data && summary.data.tournamentCount === 0
  const data = list.data

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-my-tournaments>
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Meus torneios</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Os torneios em que você jogou, em qualquer clube: rebuys, add-ons, quanto deve, prêmios e o relógio ao vivo.
        </p>
      </div>

      {summary.data && summary.data.tournamentCount > 0 && <PlayerStats summary={summary.data} />}

      {noEntries ? (
        <PlayerEmailHint email={summary.data!.email} />
      ) : (
        <>
          {homeGames.length > 1 && (
            <div className="max-w-sm">
              <Select
                id="meus-torneios-onde"
                label="Onde"
                options={options}
                value={where}
                onChange={(e) => update({ onde: e.target.value })}
                data-my-tournaments-filter
              />
            </div>
          )}

          {list.isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            </div>
          )}

          {list.isError && !list.isLoading && (
            <div className="rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
              <p className="text-text-secondary">Não foi possível carregar os seus torneios.</p>
              <button
                type="button"
                onClick={() => list.refetch()}
                className="mt-3 inline-flex min-h-[40px] items-center rounded-lg border border-border-input bg-bg-card px-3 text-sm font-medium text-text-primary hover:bg-bg-tertiary"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {data && (
            <div className="rounded-xl border border-border-default bg-bg-secondary" data-my-tournaments-list>
              {data.data.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-text-secondary">
                  {where ? 'Nenhum torneio seu neste clube.' : 'Nenhum torneio ainda.'}
                </p>
              ) : (
                <ul className="divide-y divide-border-default">
                  {data.data.map((t) => (
                    <MyTournamentRow key={t.tournamentId} tournament={t} showWhere={!where} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {data && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onPageChange={(p) => update({ pagina: p })}
              className="pb-2"
            />
          )}
        </>
      )}
    </div>
  )
}
