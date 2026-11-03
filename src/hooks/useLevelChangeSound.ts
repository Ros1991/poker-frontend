import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  announceLevelChange,
  armLevelSound,
  isLevelSoundEnabled,
  isLevelSoundUnlocked,
  levelSoundSupported,
  playLevelSoundTest,
  setLevelSoundEnabled,
  subscribeLevelSound,
} from '../utils/levelSound'

// O mesmo nível anunciado de novo dentro deste prazo é a mesma troca chegando atrasada (ex.: uma consulta que saiu antes
// do "Próximo" e voltou depois do aviso do tempo real, com o nível de antes): não toca outra vez
const SAME_CHANGE_MS = 60_000

/**
 * Som quando o nível muda (SPEC-20261103-1749), para o terminal do dealer, o telão da TV e o telão no celular. Compara o
 * nível sincronizado com o anterior DESTA tela: só toca quando ele AUMENTA depois da 1ª sincronização (abrir a tela, pausar,
 * retomar e o "Anterior" não tocam) — "blinds subiram" para um nível de blinds e "intervalo" para um intervalo, uma vez por
 * troca, mesmo que ela chegue pela consulta e pelo tempo real.
 *
 * `level` = null enquanto a tela ainda não sincronizou o relógio; `scope` muda quando a tela passa a mostrar outro
 * torneio (aí a 1ª sincronização do novo também só é guardada). `vibrate`: também vibra (celular).
 */
export function useLevelChangeSound(
  scope: string,
  level: number | null,
  isBreak: boolean,
  options: { vibrate?: boolean } = {},
) {
  const { vibrate = false } = options
  const lastRef = useRef<{ scope: string; level: number } | null>(null)
  const announcedRef = useRef<{ scope: string; level: number; at: number } | null>(null)

  useEffect(() => {
    armLevelSound()
  }, [])

  useEffect(() => {
    if (level === null) return
    const previous = lastRef.current
    lastRef.current = { scope, level }
    // 1ª sincronização desta tela (ou de outro torneio): só guarda o nível
    if (!previous || previous.scope !== scope) return
    if (level <= previous.level) return
    const now = Date.now()
    const announced = announcedRef.current
    if (announced && announced.scope === scope && announced.level === level && now - announced.at < SAME_CHANGE_MS) return
    announcedRef.current = { scope, level, at: now }
    announceLevelChange(isBreak ? 'break' : 'levelUp', { vibrate })
  }, [scope, level, isBreak, vibrate])
}

/**
 * Estado do som deste aparelho para o botão dos telões e a linha do menu "Mais" do terminal: se o navegador tem Web Audio,
 * a preferência (ligado/desligado, guardada no aparelho) e se o áudio já foi liberado por um gesto na página.
 */
export function useLevelSound() {
  const enabled = useSyncExternalStore(subscribeLevelSound, isLevelSoundEnabled, () => true)
  const unlocked = useSyncExternalStore(subscribeLevelSound, isLevelSoundUnlocked, () => false)

  useEffect(() => {
    armLevelSound()
  }, [])

  return {
    supported: levelSoundSupported(),
    enabled,
    unlocked,
    setEnabled: setLevelSoundEnabled,
    /** Libera o áudio (o toque é o gesto) e toca o aviso curto de teste */
    test: playLevelSoundTest,
  }
}
