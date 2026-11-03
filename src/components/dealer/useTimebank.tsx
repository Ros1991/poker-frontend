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
   * Terminal do dealer: quem pode estar pensando (a mesa escolhida no topo; sem o recurso de mesas, todos que estão
   * jogando), na ordem da lista. No painel não vem: lá só há o −1/+1 da Ficha.
   */
  candidates?: TournamentEntry[]
  /** Mostra o lugar de cada um na lista "Quem está pensando?" (com o recurso de mesas) */
  showSeat?: boolean
}

/** Uma abertura do cronômetro: do toque em "Tempo" até "Encerrar" */
interface CountdownSession {
  sound: AlertSound
  /** `performance.now()` do toque em "Tempo": o relógio conta daqui até "Encerrar", sem parar nem voltar ao começo */
  startedAt: number
  /** Tempo de ação e tempo de cada timebank (o do torneio no toque; não muda no meio da contagem) */
  seconds: number
  /** Quem está pensando agora: escolhido a qualquer momento; trocar vale para as próximas viradas */
  chosen: TournamentEntry | null
  /** Timebanks de cada jogador quando ele foi escolhido pela 1ª vez nesta abertura (antes dos usos dela) */
  startCount: Record<string, number>
  /** Um uso por virada coberta, na ordem das viradas (o 1º cobre a virada em X, o 2º a de 2X…) */
  uses: TimebankUse[]
}

/** Viradas que já passaram (em X, 2X, 3X… desde o toque em "Tempo") */
function turnsPassed(s: CountdownSession): number {
  return Math.floor((performance.now() - s.startedAt) / (s.seconds * 1000))
}

/**
 * Quantos timebanks o jogador ainda pode gastar nesta abertura: os que ele tinha quando foi escolhido menos os usos dela;
 * se o servidor já respondeu um uso dele com menos (alguém mexeu de outro aparelho), vale o do servidor.
 */
function availableFor(s: CountdownSession, entry: TournamentEntry): number {
  const mine = s.uses.filter((u) => u.entry.id === entry.id)
  let left = (s.startCount[entry.id] ?? entry.timebanksRemaining ?? 0) - mine.length
  for (let i = mine.length - 1; i >= 0; i--) {
    const r = mine[i].registration
    if (r.state === 'ok') {
      left = Math.min(left, r.remaining - (mine.length - 1 - i))
      break
    }
  }
  return Math.max(0, left)
}

/**
 * Timebank virtual no terminal e no painel. Desde a SPEC-20261103-1928 o cronômetro do topo do terminal (`start`) é
 * **contínuo**: conta do toque até "Encerrar" sem parar nem voltar ao começo. O tempo de ação é X (os segundos do
 * torneio) e a cada virada (X, 2X, 3X…) gasta 1 timebank do jogador escolhido em "Quem está pensando?" — a lista fica
 * aberta o tempo todo, dá para escolher antes da 1ª virada e trocar de jogador antes de qualquer uma. Virada que passou
 * sem ninguém escolhido é cobrada na hora da escolha (todas de uma vez, até o que o jogador tem); sem timebank, a contagem
 * segue como "tempo esgotado" até "Encerrar".
 *
 * Cada timebank gasto é um `POST entries/{id}/timebank/use` com o id gerado no celular (o "Tentar de novo" manda o mesmo e
 * o servidor não desconta duas vezes), um de cada vez e na ordem das viradas. A contagem é local (D4) e nunca espera a
 * rede. Fechado o cronômetro, o toast resume o que ficou: registrado (com Desfazer) ou não registrado (com Tentar de novo).
 *
 * `adjust` é o −1/+1 da Ficha (terminal e painel), com toast "Desfazer". Torneio sem timebank: `enabled` false e nada abre.
 */
export function useTimebank({ tournamentId, tournament, invalidateAll, candidates, showSeat = false }: UseTimebankOptions) {
  const enabled = timebankEnabled(tournament)
  const seconds = timebankSeconds(tournament)
  const [adjusting, setAdjusting] = useState<1 | -1 | null>(null)
  const [session, setSession] = useState<CountdownSession | null>(null)
  // A abertura de agora, sempre a mais recente (as respostas do servidor chegam fora da renderização)
  const sessionRef = useRef<CountdownSession | null>(null)
  // Usos do cronômetro aberto agora (o registro que volta depois de fechado vira toast) e o som dele
  const openKeys = useRef<Set<string>>(new Set())
  const openSound = useRef<AlertSound | null>(null)
  // Os registros saem um de cada vez, na ordem das viradas
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => () => openSound.current?.close(), [])

  const commit = useCallback((next: CountdownSession | null) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const patchUse = useCallback(
    (key: string, patch: Partial<TimebankUse>) => {
      const s = sessionRef.current
      if (!s || !s.uses.some((u) => u.key === key)) return
      commit({ ...s, uses: s.uses.map((u) => (u.key === key ? { ...u, ...patch } : u)) })
    },
    [commit],
  )

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

  /** Põe o registro na fila (um POST de cada vez: o servidor recebe os usos na ordem das viradas) */
  const enqueue = useCallback(
    (entry: TournamentEntry, actionId: string) => {
      const run = () => register(entry, actionId)
      queue.current = queue.current.then(run, run)
    },
    [register],
  )

  /**
   * Cobra as viradas que já passaram e ainda não têm timebank, do jogador escolhido e até quantos ele tem. Chamado a cada
   * virada (pela contagem) e quando o dealer escolhe ou troca o jogador.
   */
  const settle = useCallback(() => {
    const s = sessionRef.current
    if (!s || !s.chosen) return
    const entry = s.chosen
    const missing = turnsPassed(s) - s.uses.length
    const left = availableFor(s, entry)
    const n = Math.min(missing, left)
    if (n <= 0) return
    const added: TimebankUse[] = []
    for (let i = 0; i < n; i++) {
      const actionId = newTimebankActionId()
      openKeys.current.add(actionId)
      added.push({
        key: actionId,
        entry,
        turn: s.uses.length + i + 1,
        before: left - i,
        registration: { state: 'pending' },
        retrying: false,
        activityId: null,
      })
    }
    commit({ ...s, uses: [...s.uses, ...added] })
    for (const u of added) enqueue(u.entry, u.key)
  }, [commit, enqueue])

  /** Toque no cronômetro do topo: começa a contagem contínua (o som nasce neste toque, como o iOS exige) */
  const start = useCallback(() => {
    if (!enabled || !candidates) return
    const sound = createAlertSound()
    openSound.current?.close()
    openSound.current = sound
    openKeys.current = new Set()
    commit({ sound, startedAt: performance.now(), seconds, chosen: null, startCount: {}, uses: [] })
  }, [enabled, candidates, seconds, commit])

  /** "Quem está pensando?": escolhe (ou troca) o jogador; as viradas já passadas sem timebank são cobradas dele agora */
  const choose = useCallback(
    (entry: TournamentEntry) => {
      const s = sessionRef.current
      if (!s || s.chosen?.id === entry.id) return
      const startCount = entry.id in s.startCount ? s.startCount : { ...s.startCount, [entry.id]: entry.timebanksRemaining ?? 0 }
      commit({ ...s, chosen: entry, startCount })
      settle()
    },
    [commit, settle],
  )

  /** "Tentar de novo" dos usos não registrados (o mesmo actionId de cada um: o servidor não desconta duas vezes) */
  const retry = useCallback(
    (keys: string[]) => {
      const s = sessionRef.current
      if (!s) return
      for (const key of keys) {
        const use = s.uses.find((u) => u.key === key)
        if (!use) continue
        patchUse(key, { retrying: true })
        enqueue(use.entry, key)
      }
    },
    [patchUse, enqueue],
  )

  const close = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    s.sound.close()
    openSound.current = null
    openKeys.current = new Set()
    commit(null)
    const ok = s.uses.filter((u) => u.registration.state === 'ok' && u.activityId)
    if (ok.length > 0) {
      // Por jogador, na ordem em que apareceram (trocar de jogador no meio da contagem dá mais de um)
      const byPlayer: { entry: TournamentEntry; count: number; remaining: number }[] = []
      for (const u of ok) {
        const remaining = u.registration.state === 'ok' ? u.registration.remaining : 0
        const p = byPlayer.find((x) => x.entry.id === u.entry.id)
        if (p) {
          p.count++
          p.remaining = remaining
        } else byPlayer.push({ entry: u.entry, count: 1, remaining })
      }
      const ids = ok.map((u) => u.activityId as string)
      let what: string
      let undoLabel: string
      if (byPlayer.length === 1) {
        const { entry, count, remaining } = byPlayer[0]
        const name = playerName(entry)
        what = `${count === 1 ? `Timebank de ${name} registrado` : `${count} timebanks de ${name} registrados`} (${timebanksLeftText(remaining)})`
        undoLabel = count === 1 ? `timebank usado por ${name}` : `${count} timebanks usados por ${name}`
      } else {
        const parts = byPlayer.map((p) => `${p.count} de ${playerName(p.entry)} (${timebanksLeftText(p.remaining)})`)
        what = `${ok.length} timebanks registrados: ${parts.join(', ')}`
        undoLabel = `${ok.length} timebanks usados`
      }
      toast.success(what, {
        duration: UNDO_TOAST_MS,
        action: { label: 'Desfazer', onClick: () => void undoActivities(ids, undoLabel) },
      })
    }
    for (const u of s.uses) {
      if (u.registration.state === 'error') notRegisteredToast(u.entry, u.key, u.registration.message)
    }
    // pendentes: o registro termina sozinho e vira toast (o uso já não é do cronômetro aberto)
  }, [commit, undoActivities, notRegisteredToast])

  let dialogs = null
  if (enabled && session && candidates) {
    // Quantos cada um ainda pode gastar (quem já foi escolhido nesta abertura conta os usos dela)
    const left: Record<string, number> = {}
    for (const c of candidates) left[c.id] = c.id in session.startCount ? availableFor(session, c) : (c.timebanksRemaining ?? 0)
    const chosen = session.chosen ? (candidates.find((c) => c.id === session.chosen!.id) ?? session.chosen) : null
    if (chosen && !(chosen.id in left)) left[chosen.id] = availableFor(session, chosen)
    dialogs = (
      <TimebankCountdown
        seconds={session.seconds}
        startedAt={session.startedAt}
        sound={session.sound}
        candidates={candidates}
        showSeat={showSeat}
        chosen={chosen}
        left={left}
        uses={session.uses}
        onTurn={settle}
        onChoose={choose}
        onRetry={retry}
        onClose={close}
      />
    )
  }

  return { enabled, seconds, start, adjust, adjusting, dialogs }
}
