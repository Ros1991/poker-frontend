import { useCallback, useLayoutEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as timerApi from '../api/timer.api'
import type { TimerState } from '../types/blind.types'
import { useBlindTimer } from './useBlindTimer'

/** Chave do relógio do torneio no cache (a mesma nas três telas: ir e voltar entre elas reaproveita a busca) */
export function timerQueryKey(tournamentId: string) {
  return ['timer', tournamentId] as const
}

/** Relógio ainda sem a 1ª sincronização desta tela: no lugar do 00:00 do estado padrão */
export const TIMER_PLACEHOLDER = '--:--'

/**
 * Relógio do torneio nas telas que o mostram e controlam (painel do torneio, terminal do dealer e telão no celular —
 * SPEC-20261030-1018). Busca o estado no servidor ao montar a tela (`refetchOnMount: 'always'`: o `staleTime` global de
 * 30 s não segura a busca quando a tela anterior acabou de buscar) e a cada 10 s, e sincroniza o `useBlindTimer` com cada
 * busca que termina DEPOIS de a tela montar — avisada pelo cache do React Query, não por efeito colateral dentro do
 * `queryFn`, que não roda quando a tela anterior deixou uma busca em andamento com a mesma chave (o React Query
 * reaproveita a busca e o `queryFn` dela). Antes disso o telão ficava no "Carregando" e o terminal/painel no 00:00 até o
 * próximo intervalo.
 *
 * `synced` só fica verdadeiro depois da 1ª sincronização desta tela (busca depois de montar, resposta de um controle do
 * relógio ou aviso do SignalR): até lá a tela mostra `TIMER_PLACEHOLDER` e não decide entre Pausar e Retomar pelo estado
 * padrão. `sync` é o que o SignalR e as respostas de pausar/retomar/próximo/anterior chamam. Ao zerar o nível, pergunta de
 * novo ao servidor (ele avança sozinho).
 */
export function useTimerQuery(tournamentId: string | undefined) {
  const id = tournamentId ?? ''
  const queryClient = useQueryClient()
  const timer = useBlindTimer(() => {
    void queryClient.invalidateQueries({ queryKey: timerQueryKey(id) })
  })
  const { syncFromServer } = timer
  // Torneio da última sincronização: troca de torneio na mesma tela volta ao "sem sincronizar"
  const [syncedFor, setSyncedFor] = useState<string | null>(null)

  const sync = useCallback(
    (state: unknown) => {
      syncFromServer(state as TimerState)
      setSyncedFor(id)
    },
    [syncFromServer, id],
  )

  // Cada busca do relógio deste torneio que termina com sucesso a partir de agora sincroniza a tela. Inscrito no efeito de
  // LAYOUT: antes da busca da montagem (que o useQuery dispara no efeito comum) e de qualquer resposta de uma busca que a
  // tela anterior deixou em andamento — essa termina no cache e o aviso chega aqui.
  useLayoutEffect(() => {
    if (!id) return
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      const [name, key] = event.query.queryKey
      if (name !== 'timer' || key !== id) return
      if (event.query.state.data !== undefined) sync(event.query.state.data)
    })
  }, [queryClient, id, sync])

  useQuery({
    queryKey: timerQueryKey(id),
    queryFn: () => timerApi.getState(id),
    enabled: !!id,
    refetchInterval: 10000,
    refetchOnMount: 'always',
  })

  const synced = !!id && syncedFor === id
  return {
    ...timer,
    formattedTime: synced ? timer.formattedTime : TIMER_PLACEHOLDER,
    synced,
    sync,
  }
}
