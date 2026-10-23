import { useState } from 'react'
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '../ui/Button'
import { getDealerSession } from '../../utils/deviceSessions'
import type { TimerState } from '../../types/blind.types'

interface TerminalHeaderProps {
  tournamentName: string
  /** Aberto pelo QR do dealer: selo "Dealer · Nome" + botão "Sair" */
  dealerMode?: { onExit: () => void; dealerName?: string }
  tableName: string | null
  onSelectTable: () => void
  formattedTime: string
  timerState: TimerState
  onPrevLevel: () => void
  onNextLevel: () => void
  onTogglePause: () => void
  prevLoading: boolean
  nextLoading: boolean
  toggleLoading: boolean
  onOpenMore: () => void
}

/** Topo fixo: torneio, mesa, relógio, controles do nível e o link "Mais" */
export function TerminalHeader({
  tournamentName,
  dealerMode,
  tableName,
  onSelectTable,
  formattedTime,
  timerState,
  onPrevLevel,
  onNextLevel,
  onTogglePause,
  prevLoading,
  nextLoading,
  toggleLoading,
  onOpenMore,
}: TerminalHeaderProps) {
  const running = timerState.isRunning
  // Nome informado ao pedir acesso (SPEC-20261023-1208). O DealerTerminalRoute repassa o nome da sessão
  // pela prop; sem ele, lê da sessão do dealer deste aparelho (fixa durante o terminal aberto).
  const [sessionName] = useState(() => (dealerMode ? getDealerSession()?.dealerName : undefined))
  const dealerName = dealerMode?.dealerName ?? sessionName

  return (
    <header className="sticky top-0 z-30 border-b border-border-default bg-bg-secondary/95 px-3 pb-2 pt-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-xs text-text-secondary">
          {dealerMode && (
            <span className="mr-1.5 rounded bg-accent-blue-soft px-1.5 py-0.5 font-semibold text-accent-blue">
              {dealerName ? `Dealer · ${dealerName}` : 'Dealer'}
            </span>
          )}
          {tournamentName}
        </p>
        <button
          type="button"
          onClick={onOpenMore}
          className="flex min-h-[40px] items-center rounded-lg px-3 text-sm font-semibold text-accent-blue hover:bg-bg-tertiary"
        >
          Mais
        </button>
        {dealerMode && (
          <button
            type="button"
            onClick={dealerMode.onExit}
            className="flex min-h-[40px] items-center rounded-lg px-2 text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            title="Encerrar o acesso de dealer neste celular"
          >
            Sair
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelectTable}
          className="flex min-h-[44px] items-center gap-1 rounded-lg border border-border-default bg-bg-primary px-3 text-base font-bold text-text-primary"
        >
          {tableName ?? 'Escolher mesa'}
          <ChevronDown className="h-4 w-4 text-accent-blue" />
        </button>
        <div className="text-right">
          {/* Relógio rodando em marinho; pausado no único dourado que vale como texto */}
          <p
            className={`font-mono tabular-nums text-3xl font-bold leading-none ${
              running ? 'text-text-primary' : 'text-accent-gold-deep'
            }`}
          >
            {formattedTime}
          </p>
          <p className="mt-1 text-xs tabular-nums text-text-secondary">
            {timerState.isBreak
              ? 'Intervalo'
              : `Nível ${timerState.currentLevel} · ${timerState.smallBlind}/${timerState.bigBlind}`}
            {!timerState.isBreak && timerState.ante > 0 ? ` (ante ${timerState.ante})` : ''}
          </p>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        <Button variant="secondary" size="sm" className="flex-1 px-1" onClick={onPrevLevel} loading={prevLoading}>
          <SkipBack className="h-4 w-4" /> Anterior
        </Button>
        <Button
          variant={running ? 'secondary' : 'success'}
          size="sm"
          className="flex-1 px-1"
          onClick={onTogglePause}
          loading={toggleLoading}
        >
          {running ? (
            <>
              <Pause className="h-4 w-4" /> Pausar
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Retomar
            </>
          )}
        </Button>
        <Button variant="secondary" size="sm" className="flex-1 px-1" onClick={onNextLevel} loading={nextLoading}>
          Próximo <SkipForward className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
