import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as entriesApi from '../../api/entries.api'
import * as historyApi from '../../api/history.api'
import { createAlertSound } from '../../utils/alertSound'
import type { AlertSound } from '../../utils/alertSound'
import { newTimebankActionId, timebankEnabled, timebanksLeftText, timebankSeconds } from '../../utils/timebank'
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { TimebankCountdown } from './TimebankCountdown'
import type { TimebankUse } from './TimebankCountdown'
import { apiErrorMessage, playerName } from './terminalFormat'

const UNDO_TOAST_MS = 10000

interface UseTimebankOptions {
  tournamentId: string
  tournament: Tournament | undefined
  /** Recarrega inscrições, torneio e histórico (o `invalidateAll` do useTerminalActions) */
  invalidateAll: () => void
  /**
   * Terminal do dealer: quem pode estar pensando quando o tempo de ação acaba (a mesa escolhida no topo; sem o recurso de
   * mesas, todos que estão jogando), na ordem da lista. No painel não vem: lá só há o −1/+1 da Ficha.
   */
  candidates?: TournamentEntry[]
  /** Mostra o lugar de cada um na lista "Quem está pensando?" (com o recurso de mesas) */
  showSeat?: boolean
}

interface CountdownSession {
  sound: AlertSound
  uses: TimebankUse[]
}

/**
 * Timebank virtual no terminal e no painel. Desde a SPEC-20261030-1018 o uso é por um **cronômetro único** no topo do
 * terminal (`start`): conta o tempo de ação sem gastar nada e, só quando ele acaba, pergunta quem está pensando e gasta 1
 * timebank dele (`POST entries/{id}/timebank/use` com o id gerado no celular — o "Tentar de novo" manda o mesmo e o
 * servidor não desconta duas vezes). A contagem é local (D4): o registro vai em paralelo e, se falhar, a contagem continua.
 * Fechado o cronômetro, o toast diz o que ficou: registrado (com Desfazer) ou não registrado (com Tentar de novo).
 *
 * `adjust` é o −1/+1 da Ficha (terminal e painel), com toast "Desfazer". Torneio sem timebank: `enabled` false e nada abre.
 */
export function useTimebank({ tournamentId, tournament, invalidateAll, candidates, showSeat = false }: UseTimebankOptions) {
  const enabled = timebankEnabled(tournament)
  const seconds = timebankSeconds(tournament)
  const [adjusting, setAdjusting] = useState<1 | -1 | null>(null)
  const [session, setSession] = useState<CountdownSession | null>(null)
  // Usos do cronômetro aberto agora (o registro que volta depois de fechado vira toast) e o som dele
  const openKeys = useRef<Set<string>>(new Set())
  const openSound = useRef<AlertSound | null>(null)

  useEffect(() => () => openSound.current?.close(), [])

  const patchUse = useCallback((key: string, patch: Partial<TimebankUse>) => {
    setSession((s) => (s ? { ...s, uses: s.uses.map((u) => (u.key === key ? { ...u, ...patch } : u)) } : s))
  }, [])

  /** Desfaz as atividades na ordem inversa (o toast de vários timebanks desfaz todos) */
  const undoActivities = useCallback(
    async (activityIds: string[], label: string) => {
      try {
        for (const id of [...activityIds].reverse()) await historyApi.undoActivity(tournamentId, id)
        toast.success(`Desfeito: ${label}`)
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Não foi possível desfazer.'))
      } finally {
        invalidateAll()
      }
    },
    [tournamentId, invalidateAll],
  )

  const adjust = useCallback(
    async (entry: TournamentEntry, delta: 1 | -1) => {
      setAdjusting(delta)
      try {
        const r = await entriesApi.adjustTimebank(tournamentId, entry.id, delta)
        const msg = `${delta > 0 ? '+1 timebank para' : '−1 timebank de'} ${playerName(entry)} (${timebanksLeftText(r.entry.timebanksRemaining)})`
        toast.success(msg, {
          duration: UNDO_TOAST_MS,
          action: { label: 'Desfazer', onClick: () => void undoActivities([r.activityId], msg) },
        })
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Erro ao ajustar o timebank.'))
      } finally {
        setAdjusting(null)
        invalidateAll()
      }
    },
    [tournamentId, invalidateAll, undoActivities],
  )

  // O "Tentar de novo" do toast chama o register mais recente (o toast pode viver mais que a renderização que o criou)
  const registerRef = useRef<(entry: TournamentEntry, actionId: string) => Promise<void>>(async () => undefined)

  /** Uso não registrado depois de fechar o cronômetro: o toast fica até o dealer decidir, com "Tentar de novo" */
  const notRegisteredToast = useCallback((entry: TournamentEntry, actionId: string, message: string) => {
    toast.error(`O timebank usado por ${playerName(entry)} não foi registrado. ${message}`, {
      duration: 30000,
      action: { label: 'Tentar de novo', onClick: () => void registerRef.current(entry, actionId) },
    })
  }, [])

  /**
   * Registra um uso (POST timebank/use com o actionId). Com o cronômetro aberto, o resultado aparece nele; fechado (o
   * dealer encerrou antes da resposta, ou é o "Tentar de novo" do toast), vira toast.
   */
  const register = useCallback(
    async (entry: TournamentEntry, actionId: string): Promise<void> => {
      const name = playerName(entry)
      try {
        const r = await entriesApi.useTimebank(tournamentId, entry.id, actionId)
        invalidateAll()
        if (openKeys.current.has(actionId)) {
          patchUse(actionId, {
            registration: { state: 'ok', remaining: r.entry.timebanksRemaining },
            activityId: r.activityId,
            retrying: false,
          })
          return
        }
        const msg = `Timebank de ${name} registrado (${timebanksLeftText(r.entry.timebanksRemaining)})`
        toast.success(msg, {
          duration: UNDO_TOAST_MS,
          action: { label: 'Desfazer', onClick: () => void undoActivities([r.activityId], `timebank usado por ${name}`) },
        })
      } catch (err) {
        const message = apiErrorMessage(err, 'Sem conexão com o servidor.')
        if (openKeys.current.has(actionId)) {
          patchUse(actionId, { registration: { state: 'error', message }, retrying: false })
          return
        }
        notRegisteredToast(entry, actionId, message)
      }
    },
    [tournamentId, invalidateAll, patchUse, undoActivities, notRegisteredToast],
  )

  useEffect(() => {
    registerRef.current = register
  }, [register])

  /** Toque no cronômetro do topo: abre o tempo de ação (o som nasce neste toque, como o iOS exige). Nada é gasto aqui */
  const start = useCallback(() => {
    if (!enabled || !candidates) return
    const sound = createAlertSound()
    openSound.current?.close()
    openSound.current = sound
    openKeys.current = new Set()
    setSession({ sound, uses: [] })
  }, [enabled, candidates])

  /** Gasta 1 timebank do jogador (a escolha em "Quem está pensando?" ou o "Usar mais 1") e conta de novo */
  const spend = useCallback(
    (entry: TournamentEntry, before: number) => {
      const actionId = newTimebankActionId()
      openKeys.current.add(actionId)
      const use: TimebankUse = { key: actionId, entry, before, registration: { state: 'pending' }, retrying: false, activityId: null }
      setSession((s) => (s ? { ...s, uses: [...s.uses, use] } : s))
      void register(entry, actionId)
    },
    [register],
  )

  const choose = useCallback((entry: TournamentEntry) => spend(entry, entry.timebanksRemaining ?? 0), [spend])

  const spendAgain = useCallback(() => {
    const current = session?.uses[session.uses.length - 1]
    if (!current || current.registration.state !== 'ok' || current.registration.remaining <= 0) return
    // O jogador como está agora na lista (foto/nome atualizados), senão o do uso anterior
    const entry = candidates?.find((e) => e.id === current.entry.id) ?? current.entry
    spend(entry, current.registration.remaining)
  }, [session, candidates, spend])

  const retry = useCallback(
    (key: string) => {
      const use = session?.uses.find((u) => u.key === key)
      if (!use) return
      patchUse(key, { retrying: true })
      void register(use.entry, key)
    },
    [session, patchUse, register],
  )

  const close = useCallback(() => {
    const s = session
    if (!s) return
    s.sound.close()
    openSound.current = null
    openKeys.current = new Set()
    setSession(null)
    const ok = s.uses.filter((u) => u.registration.state === 'ok' && u.activityId)
    if (ok.length > 0) {
      const last = ok[ok.length - 1]
      const name = playerName(last.entry)
      const remaining = last.registration.state === 'ok' ? last.registration.remaining : 0
      const ids = ok.map((u) => u.activityId as string)
      const what = ok.length === 1 ? `Timebank de ${name} registrado` : `${ok.length} timebanks de ${name} registrados`
      toast.success(`${what} (${timebanksLeftText(remaining)})`, {
        duration: UNDO_TOAST_MS,
        action: {
          label: 'Desfazer',
          onClick: () =>
            void undoActivities(ids, ok.length === 1 ? `timebank usado por ${name}` : `${ok.length} timebanks usados por ${name}`),
        },
      })
    }
    for (const u of s.uses) {
      if (u.registration.state === 'error') notRegisteredToast(u.entry, u.key, u.registration.message)
    }
    // pendentes: o registro termina sozinho e vira toast (o uso já não é do cronômetro aberto)
  }, [session, undoActivities, notRegisteredToast])

  const dialogs =
    enabled && session && candidates ? (
      <TimebankCountdown
        seconds={seconds}
        sound={session.sound}
        candidates={candidates}
        showSeat={showSeat}
        uses={session.uses}
        onChoose={choose}
        onUseAgain={spendAgain}
        onRetry={retry}
        onClose={close}
      />
    ) : null

  return { enabled, seconds, start, adjust, adjusting, dialogs }
}
