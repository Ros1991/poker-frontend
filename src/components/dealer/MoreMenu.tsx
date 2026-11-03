import { History, LayoutGrid, UserPlus, Users, Volume2, VolumeX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { cn } from '../../utils/cn'
import { useLevelSound } from '../../hooks/useLevelChangeSound'

export type MoreScreen = 'addPlayer' | 'players' | 'tables' | 'history'

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (screen: MoreScreen) => void
  /** Plano do dono com Tables: entrada "Mesas" (SPEC-20261023-1205, D13) */
  showTables?: boolean
  /** Plano do dono com Payments: a lista de jogadores mostra quanto cada um deve */
  showPayments?: boolean
}

function playersHint(showTables: boolean, showPayments: boolean): string {
  if (showTables && showPayments) return 'Todos do torneio, mesa e quanto devem'
  if (showTables) return 'Todos do torneio e a mesa de cada um'
  if (showPayments) return 'Todos do torneio e quanto devem'
  return 'Todos do torneio, jogando e eliminados'
}

const ROW = 'flex min-h-[56px] items-center gap-3 rounded-xl border border-border-default bg-bg-primary px-3 text-left hover:bg-bg-tertiary'

/**
 * Liga/desliga do som quando o nível muda neste aparelho (SPEC-20261103-1749) — no terminal não cabe um botão no topo a
 * 375–390 px. Ligar toca o aviso curto de teste (e o próprio toque libera o áudio do navegador).
 */
function LevelSoundRow() {
  // O toque que abriu este menu já liberou o áudio do navegador: a linha não precisa do "Ativar som" dos telões
  const { supported, enabled, setEnabled, test } = useLevelSound()
  if (!supported) return null
  const hint = enabled ? 'Toca quando os blinds sobem e no intervalo' : 'Desligado neste aparelho'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Som quando o nível muda"
      onClick={() => {
        setEnabled(!enabled)
        if (!enabled) test()
      }}
      className={ROW}
      data-more-sound={enabled ? 'on' : 'off'}
    >
      <span className="text-accent-blue">{enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-text-primary">Som quando o nível muda</span>
        <span className="block text-xs text-text-secondary">{hint}</span>
      </span>
      <span
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
          enabled ? 'border-accent-blue bg-accent-blue' : 'border-border-input bg-bg-tertiary',
        )}
        aria-hidden
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-bg-card shadow-sm transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

/** O que é menos usado fica aqui, para a tela da mesa ficar limpa */
export function MoreMenu({ isOpen, onClose, onSelect, showTables = true, showPayments = true }: MoreMenuProps) {
  const items: { screen: MoreScreen; label: string; hint: string; icon: ReactNode }[] = [
    { screen: 'addPlayer', label: 'Adicionar jogador', hint: 'Já cadastrado ou novo', icon: <UserPlus className="h-5 w-5" /> },
    { screen: 'players', label: 'Jogadores', hint: playersHint(showTables, showPayments), icon: <Users className="h-5 w-5" /> },
    ...(showTables
      ? [{ screen: 'tables' as const, label: 'Mesas', hint: 'Lugares, mover, sortear', icon: <LayoutGrid className="h-5 w-5" /> }]
      : []),
    { screen: 'history', label: 'Histórico', hint: 'Tudo que foi feito e desfazer', icon: <History className="h-5 w-5" /> },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mais" size="sm">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.screen}
            type="button"
            onClick={() => onSelect(item.screen)}
            className={ROW}
          >
            <span className="text-accent-blue">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-text-primary">{item.label}</span>
              <span className="block text-xs text-text-secondary">{item.hint}</span>
            </span>
          </button>
        ))}
        <LevelSoundRow />
      </div>
    </Modal>
  )
}
