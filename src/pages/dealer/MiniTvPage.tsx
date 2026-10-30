import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import * as tournamentsApi from '../../api/tournaments.api'
import * as entriesApi from '../../api/entries.api'
import * as tournamentBlindsApi from '../../api/tournamentBlinds.api'
import { useTimerQuery } from '../../hooks/useTimerQuery'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useWakeLock } from '../../hooks/useWakeLock'
import { hasFeature } from '../../hooks/usePlan'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { TerminalViewSwitch } from '../../components/dealer/TerminalViewSwitch'
import { formatCurrency, isActiveStatus } from '../../components/dealer/terminalFormat'
import { CompactClock, CompactClockTile } from '../../components/tv/CompactClock'
import { FullscreenButton } from '../../components/tv/FullscreenButton'
import { averageStack, chipsInPlay, formatChips, secondsToBreak } from '../../utils/timerDisplay'

interface MiniTvPageProps {
  /** Aberto pelo QR do dealer (sem login, só este torneio): o nome do torneio da sessão vale até o torneio carregar */
  dealerMode?: { tournamentName: string; dealerName?: string; onExit: () => void }
}

/**
 * Telão no celular (SPEC-20261029-1721, D6) em /dealer/:tournamentId/telao: o relógio e os blinds para quando a TV não está
 * disponível — nome do torneio, Nível N / INTERVALO / Último nível, relógio grande com a cor de urgência da TV, barra, Blinds /
 * Ante, Próximo, Próximo intervalo, Jogando X / Y, Fichas em jogo, Média e a Premiação total (só com Prizes no plano do dono;
 * `netPrizePool`, nunca negativo, como na TV). Sem lista de jogadores e sem PIX.
 *
 * Abre com o token do dealer por QR ou logado (a guarda é o DealerTerminalRoute) e lê o mesmo que o terminal: torneio,
 * inscrições, relógio (REST + SignalR, ressincroniza ao zerar) e os níveis pela rota direta. A tela fica acesa (Wake Lock,
 * reaplicado ao voltar do segundo plano) e tem o botão de tela cheia da TV. O seletor "Terminal | Telão" do topo volta ao
 * terminal na mesma mesa.
 */
export function MiniTvPage({ dealerMode }: MiniTvPageProps = {}) {
  const { tournamentId: routeTournamentId } = useParams<{ tournamentId: string }>()
  const tournamentId = routeTournamentId ?? ''

  // As mesmas chaves do terminal: ir e voltar pelo seletor aproveita o que já veio
  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 8000,
  })

  const { data: entries } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 8000,
  })

  // Níveis da estrutura (o "Próximo intervalo"); o organizador pode acrescentar níveis na aba Blinds durante o torneio
  const { data: levels } = useQuery({
    queryKey: ['tournamentBlindLevels', tournamentId],
    queryFn: () => tournamentBlindsApi.getAllDirect(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  })

  // Relógio (SPEC-20261030-1018): busca ao abrir, também vindo do painel ou do terminal com o relógio no cache, e só
  // aparece depois da 1ª sincronização deste telão (o cache da tela anterior pode ter alguns segundos). Ao zerar, pergunta
  // ao servidor (que avança o nível sozinho), como a TV
  const { formattedTime, timerState, progressPercentage, synced, sync } = useTimerQuery(tournamentId)

  // Pausar, retomar, próximo/anterior em qualquer aparelho: chega na hora pelo hub do torneio
  useWebSocket({
    tournamentId,
    enabled: !!tournamentId,
    onTimerUpdate: sync,
  })

  // Tela sempre acesa enquanto o telão está aberto (o status vai num data-attribute, para conferência)
  const wakeLock = useWakeLock()

  const tournamentName = tournament?.name ?? dealerMode?.tournamentName ?? 'Torneio'
  const allEntries = entries ?? []
  const playing = allEntries.filter((e) => isActiveStatus(e.status)).length
  const totalChips = chipsInPlay(tournament, allEntries)
  const avgStack = averageStack(totalChips, playing)
  // Premiação total só com o recurso no plano do dono; nunca negativa (custo fixo antes da receita cobrir), como na TV
  const showPrizes = !!tournament && hasFeature(tournament.planFeatures, 'Prizes')
  const prizePool = Math.max(0, tournament?.netPrizePool ?? 0)
  const finished = tournament?.status === 'Finished'

  return (
    <div className="flex min-h-dvh flex-col bg-bg-primary text-text-primary" data-mini-tv data-wake-lock={wakeLock}>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border-default bg-bg-secondary/95 px-3 py-1.5 backdrop-blur-sm">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary" data-mini-tv-name>
          {tournamentName}
        </p>
        <TerminalViewSwitch current="tv" />
        {/* O botão da TV, aqui no topo (no canto ele cobriria os números); some em tela cheia e no iPhone */}
        <FullscreenButton className="static h-10 w-10 shrink-0 shadow-none" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-3">
        {finished ? (
          <div className="flex flex-col items-center gap-2 text-center" data-mini-tv-finished>
            <Trophy className="h-10 w-10 text-accent-gold-deep" aria-hidden />
            <p className="text-xl font-semibold">Torneio encerrado</p>
            {showPrizes && <p className="text-text-secondary">Premiação: {formatCurrency(prizePool)}</p>}
          </div>
        ) : !synced ? (
          <LoadingSpinner size="lg" text="Carregando o relógio..." />
        ) : (
          <CompactClock
            className="mx-auto max-w-5xl"
            timerState={timerState}
            formattedTime={formattedTime}
            progressPercentage={progressPercentage}
            secondsToBreak={secondsToBreak(timerState, levels)}
          >
            <CompactClockTile label="Jogando" tileId="playing">
              {playing} / {allEntries.length}
            </CompactClockTile>
            <CompactClockTile label="Fichas em jogo" tileId="chips">
              {formatChips(totalChips)}
            </CompactClockTile>
            <CompactClockTile label="Média" tileId="average" valueClassName="text-xl text-accent-green-deep">
              {formatChips(avgStack)}
            </CompactClockTile>
            {showPrizes && (
              <CompactClockTile label="Premiação" tileId="prize" valueClassName="text-xl text-accent-green-deep">
                {formatCurrency(prizePool)}
              </CompactClockTile>
            )}
          </CompactClock>
        )}
      </main>
    </div>
  )
}
