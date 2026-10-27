/**
 * Manual "sozinho" (SPEC-20261026-1910): o que o `boot.tsx` monta em `/manual` e `/manual/<módulo>`, com ou sem
 * sessão. Tem só o que o manual usa — React e o React Query (catálogo de planos de `GET public/plans`, para o selo
 * "A partir do Clube" e a tabela dos planos) — sem o roteador e sem o pacote do painel, do telão e do terminal. Os
 * links são `<a href>` comuns: sair do manual carrega a página de destino com o app completo.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ManualPage } from './ManualPage'
import { manualSlugFromPath } from './manualPath'

/** Monta o manual no `#root`. Chamado pelo `boot.tsx` só quando `isManualPath()`. */
export function mountStandaloneManual(container: HTMLElement = document.getElementById('root')!) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30 * 1000, retry: 1, refetchOnWindowFocus: false } },
  })
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ManualPage slug={manualSlugFromPath(window.location.pathname)} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
