import { useContext } from 'react'
import { AuthContext } from '../contexts/authContextValue'
import type { AuthContextValue } from '../contexts/authContextValue'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
