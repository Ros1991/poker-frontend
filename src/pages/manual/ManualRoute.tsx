import { Suspense, lazy } from 'react'
import { useParams } from 'react-router-dom'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

// Manual num pedaço separado, como a landing e as páginas legais (SPEC-20261026-1910): o pacote do painel não leva o
// texto nem os prints. Numa visita direta a /manual o boot.tsx nem carrega o app (standaloneManual.tsx); esta rota
// cobre a navegação de dentro do app.
const ManualPage = lazy(() => import('./ManualPage').then((m) => ({ default: m.ManualPage })))

function ManualFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <LoadingSpinner size="lg" />
    </div>
  )
}

/** Elemento das rotas `/manual` e `/manual/:slug`. */
export function ManualRoute() {
  const { slug } = useParams<{ slug?: string }>()
  return (
    <Suspense fallback={<ManualFallback />}>
      <ManualPage slug={slug ? slug.toLowerCase() : null} />
    </Suspense>
  )
}
