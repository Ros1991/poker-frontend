import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import * as publicDisplayApi from '../api/publicDisplay.api'
import { getDisplayToken, setDisplayToken } from '../utils/deviceSessions'
import type { DisplaySessionStatus } from '../types/display.types'

/**
 * Sessão da TV: cria o aparelho na primeira vez, acompanha o status (aguardando
 * QR ou pareada) e troca de torneio sozinha quando um celular escolhe outro.
 */
export function useDisplaySession() {
  const queryClient = useQueryClient()
  const [deviceToken, setDeviceToken] = useState<string | null>(() => getDisplayToken())
  const [createError, setCreateError] = useState(false)

  // Sem token: cria uma TV nova (tenta de novo a cada 5s se a rede falhar)
  useEffect(() => {
    if (deviceToken) return
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined

    async function create() {
      try {
        const created = await publicDisplayApi.createSession()
        if (cancelled) return
        setDisplayToken(created.deviceToken)
        queryClient.setQueryData(['display-session', created.deviceToken], created.session)
        setCreateError(false)
        setDeviceToken(created.deviceToken)
      } catch {
        if (cancelled) return
        setCreateError(true)
        retry = setTimeout(() => void create(), 5000)
      }
    }

    void create()
    return () => {
      cancelled = true
      if (retry) clearTimeout(retry)
    }
  }, [deviceToken, queryClient])

  const statusQuery = useQuery({
    queryKey: ['display-session', deviceToken],
    queryFn: async () => {
      try {
        return await publicDisplayApi.getStatus(deviceToken!)
      } catch (err) {
        // TV não reconhecida (expirou por inatividade): começa outra
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          setDisplayToken(null)
          setDeviceToken(null)
        }
        throw err
      }
    },
    enabled: !!deviceToken,
    // Aguardando o QR: confere rápido para a TV trocar logo após o celular escolher
    refetchInterval: (query) => (query.state.data?.status === 'Paired' ? 15000 : 3000),
    retry: (count, error) =>
      !(axios.isAxiosError(error) && error.response?.status === 401) && count < 3,
  })

  const unauthorized =
    axios.isAxiosError(statusQuery.error) && statusQuery.error.response?.status === 401

  const applyStatus = useCallback(
    (status: DisplaySessionStatus) => {
      if (deviceToken) queryClient.setQueryData(['display-session', deviceToken], status)
    },
    [deviceToken, queryClient],
  )

  const leave = useCallback(async () => {
    if (!deviceToken) return
    applyStatus(await publicDisplayApi.leave(deviceToken))
  }, [deviceToken, applyStatus])

  const refresh = useCallback(() => {
    void statusQuery.refetch()
  }, [statusQuery])

  return {
    deviceToken,
    status: statusQuery.data ?? null,
    connectionError: createError || (statusQuery.isError && !unauthorized),
    leave,
    refresh,
  }
}
