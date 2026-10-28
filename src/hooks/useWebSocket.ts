import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import apiClient, { getAccessToken } from '../api/client'
import type { TablesUpdateEvent } from '../api/tables.api'

interface UseWebSocketOptions {
  tournamentId: string
  onTimerUpdate?: (state: unknown) => void
  onEntryUpdate?: (entry: unknown) => void
  onTournamentUpdate?: (tournament: unknown) => void
  onEliminationUpdate?: (data: unknown) => void
  /**
   * Mudança de mesa/lugar (TablesController: criar, sortear, balancear, mover, trocar, quebrar, tirar da mesa, dealer,
   * excluir — SPEC-20261027-2133). As consultas de mesas, inscrições e histórico do torneio já são recarregadas aqui
   * (painel e terminal); o callback é para a tela reagir além disso (ex.: o terminal que estava na mesa excluída).
   */
  onTablesUpdate?: (event: TablesUpdateEvent) => void
  enabled?: boolean
}

export function useWebSocket({
  tournamentId,
  onTimerUpdate,
  onEntryUpdate,
  onTournamentUpdate,
  onEliminationUpdate,
  onTablesUpdate,
  enabled = true,
}: UseWebSocketOptions) {
  const queryClient = useQueryClient()
  const connectionRef = useRef<HubConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Refs para os callbacks - evita reconectar quando os handlers mudam
  const onTimerUpdateRef = useRef(onTimerUpdate)
  const onEntryUpdateRef = useRef(onEntryUpdate)
  const onTournamentUpdateRef = useRef(onTournamentUpdate)
  const onEliminationUpdateRef = useRef(onEliminationUpdate)
  const onTablesUpdateRef = useRef(onTablesUpdate)

  // Atualizar refs sempre que callbacks mudarem (sem causar reconexão)
  useEffect(() => {
    onTimerUpdateRef.current = onTimerUpdate
    onEntryUpdateRef.current = onEntryUpdate
    onTournamentUpdateRef.current = onTournamentUpdate
    onEliminationUpdateRef.current = onEliminationUpdate
    onTablesUpdateRef.current = onTablesUpdate
  }, [onTimerUpdate, onEntryUpdate, onTournamentUpdate, onEliminationUpdate, onTablesUpdate])

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
    // Outro aparelho (ou esta mesma tela) mudou mesas/lugares: mesas, inscrições (mesa/lugar de cada um) e histórico
    // de novo, em qualquer tela conectada ao torneio — sem esperar a próxima consulta periódica
    connection.on('TablesUpdate', (event: TablesUpdateEvent) => {
      if (cancelled) return
      void queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
      void queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      void queryClient.invalidateQueries({ queryKey: ['history', tournamentId] })
      onTablesUpdateRef.current?.(event)
    })

    // Dealer por QR desconectado pelo organizador (ou QR desativado): o servidor tira a
    // conexão do grupo do torneio, avisa e a derruba logo em seguida. Para aqui, sem tentar
    // reconectar, e confere a sessão do dealer: o 401 dispara o tratamento do terminal no
    // client.ts (tela de acesso encerrado, com o motivo). Conexão de usuário não recebe isso.
    connection.on('DealerRevoked', () => {
      if (cancelled) return
      void connection.stop()
      apiClient.get(`/tournaments/${tournamentId}/dealer-access/session`).catch(() => {
        // 401 esperado: quem age é o interceptor do client.ts
      })
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
  }, [enabled, tournamentId, queryClient])

  return { isConnected }
}
