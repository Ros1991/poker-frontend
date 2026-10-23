import { History, LayoutGrid, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'

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
            className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border-default bg-bg-primary px-3 text-left hover:bg-bg-tertiary"
          >
            <span className="text-accent-blue">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-text-primary">{item.label}</span>
              <span className="block text-xs text-text-secondary">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
