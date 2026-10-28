import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { UpgradeModal } from '../plan/UpgradeModal'
import { PlanExpiryBanner } from '../plan/PlanExpiryBanner'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // h-dvh (era h-screen): no celular a altura acompanha a barra de endereço do navegador, então a barra de baixo, que
  // fica no fluxo da coluna, não some atrás dela (no computador dvh = vh)
  return (
    <div className="flex h-dvh bg-bg-primary">
      <Sidebar className="hidden lg:flex" />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-text-primary/40"
            onClick={() => setSidebarOpen(false)}
          />
          <Sidebar
            className="relative z-10 flex h-full"
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setSidebarOpen(true)} />

        {/* Plano pago vencendo em ≤ 7 dias ou vencido (SPEC-20261023-1205) */}
        <PlanExpiryBanner />

        {/* Abaixo de lg a BottomNav vem logo depois, no fluxo da coluna (SPEC-20261027-2132): o main termina em cima dela */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>

        <BottomNav className="lg:hidden" />
      </div>

      {/* Modal de upgrade ÚNICO: abre em qualquer 402 de plano e pelos cadeados (usePlanGate) */}
      <UpgradeModal />
    </div>
  )
}
