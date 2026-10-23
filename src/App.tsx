import type { CSSProperties } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { HomeGameProvider } from './contexts/HomeGameContext'
import { Router } from './Router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Toasts com os tokens do tema (SPEC-20261023-1204): o sonner lê estas variáveis no próprio
// <ol data-sonner-toaster>, então o neutro vira card branco com borda e os tipos (`richColors`)
// usam o pastel + texto -deep de cada cor. Texto de alerta é marinho: amarelo nunca vira texto.
const toasterStyle = {
  '--normal-bg': 'var(--color-bg-card)',
  '--normal-border': 'var(--color-border-default)',
  '--normal-text': 'var(--color-text-primary)',
  '--success-bg': 'var(--color-accent-green-soft)',
  '--success-border': 'var(--color-accent-green)',
  '--success-text': 'var(--color-accent-green-deep)',
  '--info-bg': 'var(--color-accent-blue-soft)',
  '--info-border': 'var(--color-accent-blue)',
  '--info-text': 'var(--color-accent-blue)',
  '--warning-bg': 'var(--color-accent-yellow-soft)',
  '--warning-border': 'var(--color-accent-yellow)',
  '--warning-text': 'var(--color-text-primary)',
  '--error-bg': 'var(--color-accent-red-soft)',
  '--error-border': 'var(--color-accent-red)',
  '--error-text': 'var(--color-accent-red-deep)',
} as CSSProperties

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <HomeGameProvider>
            <Router />
            <Toaster
              // No celular embaixo: o "Desfazer" fica ao alcance do polegar e não cobre o relógio do terminal
              position={window.matchMedia('(max-width: 639px)').matches ? 'bottom-center' : 'top-right'}
              richColors
              // Tema único (D8): não segue o modo escuro do SO
              theme="light"
              style={toasterStyle}
            />
          </HomeGameProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
