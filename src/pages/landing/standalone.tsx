/**
 * Landing "sozinha" (SPEC-20261023-1207): o que o `boot.tsx` monta para o visitante novo em `/`. Tem só o que a
 * landing usa — React e o React Query (catálogo de planos de `GET public/plans`) — para a primeira tela chegar rápido
 * no celular (Lighthouse mobile ≥ 90). Sem roteador: todos os links da landing são `<a href>` comuns, então sair dela
 * (Entrar, Telão, cadastro, termos…) carrega a página de destino, e o `boot.tsx` abre o app completo lá.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LandingPage } from './LandingPage'

/** Monta a landing no `#root`. Chamado pelo `boot.tsx` só quando `isLandingVisit()`. */
export function mountStandaloneLanding(container: HTMLElement = document.getElementById('root')!) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30 * 1000, retry: 1, refetchOnWindowFocus: false } },
  })
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <LandingPage />
      </QueryClientProvider>
    </StrictMode>,
  )
}
