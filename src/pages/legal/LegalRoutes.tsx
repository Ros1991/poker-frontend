import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

// Termos e privacidade num chunk separado, como a landing (SPEC-20261023-1207): o pacote do painel não leva o texto.
const TermsPage = lazy(() => import('./TermsPage').then((m) => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('./PrivacyPage').then((m) => ({ default: m.PrivacyPage })))

function LegalFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <LoadingSpinner size="lg" />
    </div>
  )
}

/** Elemento da rota `/termos` (carrega a página sob demanda). */
export function TermsRoute() {
  return (
    <Suspense fallback={<LegalFallback />}>
      <TermsPage />
    </Suspense>
  )
}

/** Elemento da rota `/privacidade` (carrega a página sob demanda). */
export function PrivacyRoute() {
  return (
    <Suspense fallback={<LegalFallback />}>
      <PrivacyPage />
    </Suspense>
  )
}
