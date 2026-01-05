import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { apiClient, type User } from '../api/client'

interface AuthContextType {
  user: User | null
  login: (email: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUserId = localStorage.getItem('userId')
    if (storedUserId) {
      apiClient
        .getUser(parseInt(storedUserId))
        .then((response) => setUser(response.user))
        .catch(() => {
          localStorage.removeItem('userId')
        })
        .finally(() => setIsLoading(false))
    } else {
      // Auto-login with default user for development
      apiClient
        .login('user1@example.com')
        .then((response) => {
          setUser(response.user)
          localStorage.setItem('userId', response.user.id.toString())
        })
        .catch(() => {
          // Ignore login failure
        })
        .finally(() => setIsLoading(false))
    }
  }, [])

  const login = async (email: string) => {
    const response = await apiClient.login(email)
    setUser(response.user)
    localStorage.setItem('userId', response.user.id.toString())
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('userId')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
