/**
 * Aviso sonoro da troca de nível (SPEC-20261103-1749) no terminal do dealer, no telão da TV e no telão no celular:
 * "blinds subiram" (três notas subindo) e "intervalo" (duas notas, "ding-dong"), gerados em código (Web Audio, sem
 * arquivo), com timbre macio (onda triangular + uma oitava senoidal por cima, como um sino) e volume para se ouvir de
 * longe numa TV. No celular, quem chama pede também a vibração.
 *
 * Um `AudioContext` só por página, criado e liberado no primeiro gesto em QUALQUER lugar da página: o navegador só deixa
 * tocar som depois de a pessoa tocar, clicar ou apertar uma tecla (a tecla F e o botão de tela cheia também contam).
 * As telas chamam `armLevelSound()` ao montar (idempotente): a partir daí, os eventos de gesto do documento retomam o
 * contexto. Se a página já teve gesto antes (ex.: o toque em "Entrar" do dealer ou a tecla F na tela do QR da TV), o
 * contexto nasce na hora. Enquanto o navegador não libera, `isLevelSoundUnlocked()` é falso e o botão dos telões mostra
 * "Ativar som" (o gesto em cima dele não conta aqui: ele libera no próprio clique, para não encolher antes do clique);
 * se o navegador suspender o áudio de novo (iOS em segundo plano), o próximo gesto libera outra vez.
 *
 * Liga/desliga por aparelho em `localStorage` (`poker_level_sound`, padrão ligado): o mesmo para o terminal e os telões
 * abertos no mesmo navegador (o evento `storage` acompanha a troca feita em outra aba). Desligado, nada toca nem vibra.
 */
import { audioContextCtor, vibrate } from './alertSound'

/** Qual aviso: o nível novo é de blinds ou é um intervalo */
export type LevelSoundKind = 'levelUp' | 'break'

const STORAGE_KEY = 'poker_level_sound'

// Eventos que contam como gesto: no toque, o navegador só libera no fim (touchend / pointerup), no mouse no começo
// (mousedown / pointerdown) e no teclado no keydown — escuta todos, o que vier primeiro com permissão libera
const GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'touchend', 'keydown', 'click'] as const

interface Note {
  freq: number
  /** Início, em segundos, contado do começo do aviso */
  at: number
  /** Duração até sumir, em segundos */
  dur: number
}

// Dó–Mi–Sol subindo (a última nota mais longa): blinds subiram
const LEVEL_UP: readonly Note[] = [
  { freq: 523.25, at: 0, dur: 0.42 },
  { freq: 659.25, at: 0.18, dur: 0.42 },
  { freq: 783.99, at: 0.36, dur: 0.9 },
]
// Sol–Dó descendo, mais lento: intervalo
const BREAK: readonly Note[] = [
  { freq: 783.99, at: 0, dur: 0.75 },
  { freq: 523.25, at: 0.5, dur: 1.1 },
]
// Uma nota curta: confirma que o som foi ativado
const TEST: readonly Note[] = [{ freq: 659.25, at: 0, dur: 0.35 }]

const VIBRATION: Record<LevelSoundKind, number[]> = {
  levelUp: [200, 100, 200, 100, 300],
  break: [600, 200, 600],
}

let ctx: AudioContext | null = null
let output: GainNode | null = null
let armed = false
let listening = false
let unlocked = false
let enabledCache: boolean | null = null
const subscribers = new Set<() => void>()

function emit() {
  for (const fn of subscribers) fn()
}

/** O navegador tem Web Audio (sem ele, o botão de som nem aparece) */
export function levelSoundSupported(): boolean {
  return audioContextCtor() !== null
}

/** O áudio desta página já foi liberado pelo navegador (o contexto está tocando) */
export function isLevelSoundUnlocked(): boolean {
  return unlocked
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Preferência deste aparelho (padrão ligado) */
export function isLevelSoundEnabled(): boolean {
  if (enabledCache === null) enabledCache = readEnabled()
  return enabledCache
}

export function setLevelSoundEnabled(on: boolean): void {
  enabledCache = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Navegador sem armazenamento (modo privado antigo): vale até fechar a página
  }
  emit()
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== STORAGE_KEY) return
  enabledCache = readEnabled()
  emit()
}

/** Avisa quando a preferência ou a liberação do áudio mudam (para `useSyncExternalStore`) */
export function subscribeLevelSound(fn: () => void): () => void {
  subscribers.add(fn)
  if (subscribers.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    subscribers.delete(fn)
    if (subscribers.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

function startListening() {
  if (listening || !armed || typeof document === 'undefined') return
  listening = true
  for (const type of GESTURES) document.addEventListener(type, onGesture, { capture: true, passive: true })
}

function stopListening() {
  if (!listening) return
  listening = false
  for (const type of GESTURES) document.removeEventListener(type, onGesture, { capture: true })
}

/** Confere o estado do contexto: tocando = liberado (para de escutar gestos); suspenso = escuta de novo */
function refresh() {
  const running = ctx?.state === 'running'
  if (running !== unlocked) {
    unlocked = running
    emit()
  }
  if (running) stopListening()
  else startListening()
}

/** O contexto único da página (cria na primeira vez); sem Web Audio, null */
function context(): AudioContext | null {
  if (ctx && ctx.state !== 'closed') return ctx
  const Ctor = audioContextCtor()
  if (!Ctor) return null
  try {
    const created = new Ctor()
    const gain = created.createGain()
    gain.gain.value = 0.8
    gain.connect(created.destination)
    created.addEventListener?.('statechange', refresh)
    ctx = created
    output = gain
  } catch {
    ctx = null
    output = null
  }
  return ctx
}

/** Retoma o contexto (precisa rodar dentro do gesto, no iOS); `then` roda depois de o navegador responder */
function resume(then?: () => void) {
  const c = context()
  if (!c) {
    stopListening()
    return
  }
  if (c.state === 'running') {
    refresh()
    then?.()
    return
  }
  try {
    void Promise.resolve(c.resume()).then(
      () => {
        refresh()
        then?.()
      },
      refresh,
    )
  } catch {
    refresh()
  }
}

function onGesture(e: Event) {
  // O próprio botão de som libera no clique dele: liberar já no pointerdown/touchend trocaria o "Ativar som" pelo ícone
  // (menor) antes do clique, e o clique cairia no que ficou embaixo do dedo (no cabeçalho da TV, o "Ver Mesas")
  if (e.target instanceof Element && e.target.closest('[data-sound-toggle]')) return
  resume()
}

/** A página já teve um gesto: sem isso o navegador recusa a vibração (e avisa no console) */
function hasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation
  return activation?.hasBeenActive ?? true
}

/**
 * Prepara o som desta página (as três telas chamam ao montar; chamar de novo não faz nada): escuta o primeiro gesto e,
 * se a página já teve um (o Chrome deixa começar depois de qualquer gesto na página), cria o contexto na hora.
 */
export function armLevelSound(): void {
  if (armed || !levelSoundSupported()) return
  armed = true
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation
  if (activation?.hasBeenActive) resume()
  else startListening()
}

/** Uma nota de sino: triangular na frequência + senoidal uma oitava acima, ataque curto, um pouco sustentada e sumindo */
function chime(c: AudioContext, out: AudioNode, note: Note, t0: number) {
  const start = t0 + note.at
  const end = start + note.dur
  const layers: readonly [OscillatorType, number, number][] = [
    ['triangle', 1, 0.5],
    ['sine', 2, 0.16],
  ]
  for (const [type, mult, peak] of layers) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(note.freq * mult, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, start + note.dur * 0.4)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(gain)
    gain.connect(out)
    osc.start(start)
    osc.stop(end + 0.05)
  }
}

/** Toca as notas agora, só com o áudio já liberado (com o contexto suspenso, as notas tocariam atrasadas ao liberar) */
function play(notes: readonly Note[]) {
  const c = ctx
  if (!c || !output || c.state !== 'running') return
  try {
    const t0 = c.currentTime + 0.03
    for (const note of notes) chime(c, output, note, t0)
  } catch {
    // Sem som não atrapalha a tela
  }
}

/** Troca de nível: "blinds subiram" ou "intervalo" (e a vibração, no celular), se o som está ligado neste aparelho */
export function announceLevelChange(kind: LevelSoundKind, options: { vibrate?: boolean } = {}): void {
  if (!isLevelSoundEnabled()) return
  play(kind === 'break' ? BREAK : LEVEL_UP)
  if (options.vibrate && hasUserActivation()) vibrate(VIBRATION[kind])
}

/**
 * Toque em "Ativar som" ou ao ligar o som: libera o áudio (o próprio toque é o gesto) e toca o aviso curto de teste
 * quando o navegador responder.
 */
export function playLevelSoundTest(): void {
  armLevelSound()
  resume(() => play(TEST))
}
