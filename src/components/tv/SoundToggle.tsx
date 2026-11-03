import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useLevelSound } from '../../hooks/useLevelChangeSound'

interface SoundToggleProps {
  /** `md`: 40 px, como o botão de tela cheia do telão no celular; `lg`: 44 px, como os botões do cabeçalho da TV */
  size?: 'md' | 'lg'
  className?: string
}

/**
 * Botão do som quando o nível muda (SPEC-20261103-1749) nos telões — no topo do telão no celular, ao lado da tela cheia,
 * e no cabeçalho da TV, perto do "Voltar". Três estados (em `data-sound-toggle`):
 * - `locked`: som ligado, mas o navegador ainda não liberou o áudio (ninguém tocou na página) → "Ativar som" em dourado;
 *   o toque libera e toca um aviso curto de teste;
 * - `on`: alto-falante; o toque desliga (neste aparelho);
 * - `off`: alto-falante cortado; o toque liga, libera e toca o teste.
 * Sem Web Audio no navegador, não aparece.
 */
export function SoundToggle({ size = 'md', className }: SoundToggleProps) {
  const { supported, enabled, unlocked, setEnabled, test } = useLevelSound()
  if (!supported) return null

  const box = size === 'lg' ? 'h-11' : 'h-10'
  const icon = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
  const focus = 'focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/40'

  if (enabled && !unlocked) {
    return (
      <button
        type="button"
        onClick={test}
        title="O navegador só libera o som depois de um toque: toque aqui (ou em qualquer lugar) para ouvir o aviso da troca de nível"
        data-sound-toggle="locked"
        className={cn(
          'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-accent-gold-hover bg-accent-gold font-bold text-text-primary shadow-sm ring-4 ring-accent-gold/30 transition-colors hover:bg-accent-gold-hover',
          box,
          size === 'lg' ? 'px-4 text-base' : 'px-3 text-sm',
          focus,
          className,
        )}
      >
        <Volume2 className={icon} aria-hidden />
        Ativar som
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (enabled) {
          setEnabled(false)
        } else {
          setEnabled(true)
          test()
        }
      }}
      aria-pressed={enabled}
      aria-label="Som quando o nível muda"
      title={
        enabled
          ? 'Som ligado: toca quando os blinds sobem e no intervalo (toque para desligar neste aparelho)'
          : 'Som desligado neste aparelho (toque para ligar)'
      }
      data-sound-toggle={enabled ? 'on' : 'off'}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border bg-bg-card transition-colors',
        // No celular, o visual do botão de tela cheia; na TV, a borda dos botões do cabeçalho ("Ver Mesas", "Voltar")
        size === 'lg'
          ? 'w-11 border-border-input text-text-primary hover:bg-bg-tertiary'
          : 'w-10 border-border-default text-text-secondary hover:text-text-primary',
        box,
        focus,
        className,
      )}
    >
      {enabled ? <Volume2 className={icon} aria-hidden /> : <VolumeX className={icon} aria-hidden />}
    </button>
  )
}
