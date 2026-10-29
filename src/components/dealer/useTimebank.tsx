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
import type { TimebankRegistration } from './TimebankCountdown'
import { TimebankSheet } from './TimebankSheet'
import { apiErrorMessage, isActiveStatus, playerName } from './terminalFormat'

const UNDO_TOAST_MS = 10000

interface UseTimebankOptions {
  tournamentId: string
  tournament: Tournament | undefined
  /** Inscrições do torneio: a sheet mostra sempre o número atual do jogador */
  entries: TournamentEntry[]
  /** Recarrega inscrições, torneio e histórico (o `invalidateAll` do useTerminalActions) */
  invalidateAll: () => void
  /** Terminal do dealer: "Usar timebank" e a contagem. No painel, false — só os ajustes (a contagem fica no terminal) */
  allowUse: boolean
}

interface CountdownState {
  /** = actionId do uso: o "Tentar de novo" manda o mesmo */
  key: string
  entry: TournamentEntry
  seconds: number
  sound: AlertSound
  registration: TimebankRegistration
  retrying: boolean
  activityId: string | null
}

/**
 * Timebank virtual no terminal e no painel (SPEC-20261029-1722): a TimebankSheet (aberta pelo chip "⏱ N"), os ajustes
 * +1/−1 com toast "Desfazer" e, no terminal, o "Usar" com a contagem em tela cheia. A contagem é local (D4): começa no
 * toque, o registro vai em paralelo; se falhar, a contagem continua e o terminal oferece "Tentar de novo" (o mesmo
 * actionId: o servidor não desconta duas vezes). Fechada a contagem, o toast diz o que ficou: registrado (com Desfazer) ou
 * não registrado (com Tentar de novo). Torneio sem timebank: `enabled` false, nada abre e nenhum chip deve aparecer.
 */
export function useTimebank({ tournamentId, tournament, entries, invalidateAll, allowUse }: UseTimebankOptions) {
  const enabled = timebankEnabled(tournament)
  const seconds = timebankSeconds(tournament)
  const [sheetEntryId, setSheetEntryId] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<1 | -1 | null>(null)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  // Contagem aberta agora (o registro que volta depois de fechada vira toast) e o som dela (fechado ao sair da tela)
  const openKey = useRef<string | null>(null)
  const openSound = useRef<AlertSound | null>(null)

  useEffect(() => () => openSound.current?.close(), [])

  const sheetEntry =
    enabled && sheetEntryId ? (entries.find((e) => e.id === sheetEntryId && isActiveStatus(e.status)) ?? null) : null

  const patchCountdown = useCallback((key: string, patch: Partial<CountdownState>) => {
    setCountdown((c) => (c && c.key === key ? { ...c, ...patch } : c))
  }, [])

  const undoActivity = useCallback(
    async (activityId: string, label: string) => {
      try {
        await historyApi.undoActivity(tournamentId, activityId)
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
          action: { label: 'Desfazer', onClick: () => void undoActivity(r.activityId, msg) },
        })
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Erro ao ajustar o timebank.'))
      } finally {
        setAdjusting(null)
        invalidateAll()
      }
    },
    [tournamentId, invalidateAll, undoActivity],
  )

  // O "Tentar de novo" do toast chama o register mais recente (o toast pode viver mais que a renderização que o criou)
  const registerRef = useRef<(entry: TournamentEntry, actionId: string) => Promise<void>>(async () => undefined)

  /** Uso não registrado depois de fechar a contagem: o toast fica até o dealer decidir, com "Tentar de novo" */
  const notRegisteredToast = useCallback((entry: TournamentEntry, actionId: string, message: string) => {
    toast.error(`O timebank usado por ${playerName(entry)} não foi registrado. ${message}`, {
      duration: 30000,
      action: { label: 'Tentar de novo', onClick: () => void registerRef.current(entry, actionId) },
    })
  }, [])

  /**
   * Registra o uso (POST timebank/use com o actionId). Com a contagem aberta, o resultado aparece nela; fechada (o dealer
   * encerrou antes da resposta, ou é o "Tentar de novo" do toast), vira toast.
   */
  const register = useCallback(
    async (entry: TournamentEntry, actionId: string): Promise<void> => {
      const name = playerName(entry)
      try {
        const r = await entriesApi.useTimebank(tournamentId, entry.id, actionId)
        invalidateAll()
        if (openKey.current === actionId) {
          patchCountdown(actionId, {
            registration: { state: 'ok', remaining: r.entry.timebanksRemaining },
            activityId: r.activityId,
            retrying: false,
          })
          return
        }
        const msg = `Timebank de ${name} registrado (${timebanksLeftText(r.entry.timebanksRemaining)})`
        toast.success(msg, {
          duration: UNDO_TOAST_MS,
          action: { label: 'Desfazer', onClick: () => void undoActivity(r.activityId, `timebank usado por ${name}`) },
        })
      } catch (err) {
        const message = apiErrorMessage(err, 'Sem conexão com o servidor.')
        if (openKey.current === actionId) {
          patchCountdown(actionId, { registration: { state: 'error', message }, retrying: false })
          return
        }
        notRegisteredToast(entry, actionId, message)
      }
    },
    [tournamentId, invalidateAll, patchCountdown, undoActivity, notRegisteredToast],
  )

  useEffect(() => {
    registerRef.current = register
  }, [register])

  /** "Usar timebank" na sheet: abre a contagem na hora (o som nasce neste toque) e registra em paralelo */
  const use = useCallback(
    (entry: TournamentEntry) => {
      const sound = createAlertSound()
      const actionId = newTimebankActionId()
      openSound.current?.close()
      openSound.current = sound
      openKey.current = actionId
      setSheetEntryId(null)
      setCountdown({
        key: actionId,
        entry,
        seconds,
        sound,
        registration: { state: 'pending' },
        retrying: false,
        activityId: null,
      })
      void register(entry, actionId)
    },
    [seconds, register],
  )

  const retry = useCallback(() => {
    if (!countdown) return
    patchCountdown(countdown.key, { retrying: true })
    void register(countdown.entry, countdown.key)
  }, [countdown, patchCountdown, register])

  const close = useCallback(() => {
    const c = countdown
    if (!c) return
    c.sound.close()
    openSound.current = null
    openKey.current = null
    setCountdown(null)
    const name = playerName(c.entry)
    if (c.registration.state === 'ok' && c.activityId) {
      const activityId = c.activityId
      toast.success(`Timebank de ${name} registrado (${timebanksLeftText(c.registration.remaining)})`, {
        duration: UNDO_TOAST_MS,
        action: { label: 'Desfazer', onClick: () => void undoActivity(activityId, `timebank usado por ${name}`) },
      })
    } else if (c.registration.state === 'error') {
      notRegisteredToast(c.entry, c.key, c.registration.message)
    }
    // pendente: o registro termina sozinho e vira toast (openKey já não é dele)
  }, [countdown, undoActivity, notRegisteredToast])

  /** Abre a sheet do jogador (só com o timebank ligado e quem ainda joga) */
  const open = useCallback(
    (entry: TournamentEntry) => {
      if (enabled && isActiveStatus(entry.status)) setSheetEntryId(entry.id)
    },
    [enabled],
  )

  const dialogs = (
    <>
      {enabled && (
        <TimebankSheet
          entry={sheetEntry}
          seconds={seconds}
          onUse={allowUse ? use : undefined}
          onAdjust={(entry, delta) => void adjust(entry, delta)}
          adjusting={adjusting}
          onClose={() => setSheetEntryId(null)}
        />
      )}
      {countdown && (
        <TimebankCountdown
          key={countdown.key}
          entry={countdown.entry}
          seconds={countdown.seconds}
          sound={countdown.sound}
          registration={countdown.registration}
          retrying={countdown.retrying}
          onRetry={retry}
          onClose={close}
        />
      )}
    </>
  )

  return { enabled, open, adjust, adjusting, dialogs }
}
