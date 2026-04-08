import { useEffect, useRef, useState } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { getAccessToken } from '../api/client'

interface UseWebSocketOptions {
  tournamentId: string
  onTimerUpdate?: (state: unknown) => void
  onEntryUpdate?: (entry: unknown) => void
  onTournamentUpdate?: (tournament: unknown) => void
  onEliminationUpdate?: (data: unknown) => void
  enabled?: boolean
}

export function useWebSocket({
  tournamentId,
  onTimerUpdate,
  onEntryUpdate,
  onTournamentUpdate,
  onEliminationUpdate,
  enabled = true,
}: UseWebSocketOptions) {
  const connectionRef = useRef<HubConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Refs para os callbacks - evita reconectar quando os handlers mudam
  const onTimerUpdateRef = useRef(onTimerUpdate)
  const onEntryUpdateRef = useRef(onEntryUpdate)
  const onTournamentUpdateRef = useRef(onTournamentUpdate)
  const onEliminationUpdateRef = useRef(onEliminationUpdate)

  // Atualizar refs sempre que callbacks mudarem (sem causar reconexão)
  useEffect(() => {
    onTimerUpdateRef.current = onTimerUpdate
    onEntryUpdateRef.current = onEntryUpdate
    onTournamentUpdateRef.current = onTournamentUpdate
    onEliminationUpdateRef.current = onEliminationUpdate
  }, [onTimerUpdate, onEntryUpdate, onTournamentUpdate, onEliminationUpdate])

  useEffect(() => {
    if (!enabled || !tournamentId) return

    let cancelled = false

    const hubUrl =
      (import.meta.env.VITE_API_BASE_URL ?? '') + '/hubs/tournament'

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('TimerUpdate', (state: unknown) => {
      onTimerUpdateRef.current?.(state)
    })
    connection.on('TimerStateChanged', (state: unknown) => {
      onTimerUpdateRef.current?.(state)
    })
    connection.on('BlindLevelChanged', (state: unknown) => {
      onTimerUpdateRef.current?.(state)
    })
    connection.on('EntryUpdate', (entry: unknown) => {
      onEntryUpdateRef.current?.(entry)
    })
    connection.on('TournamentUpdate', (tournament: unknown) => {
      onTournamentUpdateRef.current?.(tournament)
    })
    connection.on('EliminationUpdate', (data: unknown) => {
      onEliminationUpdateRef.current?.(data)
    })

    connection.onreconnected(async () => {
      if (cancelled) return
      setIsConnected(true)
      try {
        await connection.invoke('JoinTournament', tournamentId)
      } catch (err) {
        console.error('Erro ao reconectar ao grupo do torneio:', err)
      }
    })

    connection.onreconnecting(() => {
      if (!cancelled) setIsConnected(false)
    })

    connection.onclose(() => {
      if (!cancelled) setIsConnected(false)
    })

    connectionRef.current = connection

    ;(async () => {
      try {
        await connection.start()
        if (cancelled) {
          await connection.stop()
          return
        }
        await connection.invoke('JoinTournament', tournamentId)
        if (!cancelled) setIsConnected(true)
      } catch (err) {
        if (!cancelled) console.error('Erro ao conectar WebSocket:', err)
      }
    })()

    return () => {
      cancelled = true
      if (
        connection.state === HubConnectionState.Connected ||
        connection.state === HubConnectionState.Connecting
      ) {
        void connection.stop()
      }
      connectionRef.current = null
      setIsConnected(false)
    }
  }, [enabled, tournamentId])

  return { isConnected }
}
