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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <HomeGameProvider>
            <Router />
            <Toaster
              position="top-right"
              richColors
              toastOptions={{
                style: {
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                },
              }}
            />
          </HomeGameProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
