import React, { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('fence_token'))

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('fence_token')
      if (savedToken) {
        try {
          const userData = await authService.verifyToken(savedToken)
          setUser(userData.user)
          setToken(savedToken)
        } catch (error) {
          console.error('Token verification failed:', error)
          localStorage.removeItem('fence_token')
          setToken(null)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password)
      const { token: newToken, user: userData } = response
      
      localStorage.setItem('fence_token', newToken)
      setToken(newToken)
      setUser(userData)
      
      return { success: true }
    } catch (error) {
      console.error('Login failed:', error)
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      }
    }
  }

  const loginWithFacebook = () => {
    // Redirect to Facebook OAuth
    window.location.href = 'https://fence-auth-service-453424326027.us-central1.run.app/auth/facebook'
  }

  const logout = () => {
    localStorage.removeItem('fence_token')
    setToken(null)
    setUser(null)
  }

  const handleFacebookCallback = (token) => {
    localStorage.setItem('fence_token', token)
    setToken(token)
    // Decode token to get user info (in production, verify with backend)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser({
        id: payload.id,
        email: payload.email,
        company: payload.company || 'Facebook User',
        tier: payload.tier,
        facebook_connected: payload.facebook_connected
      })
    } catch (error) {
      console.error('Token decode failed:', error)
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    loginWithFacebook,
    logout,
    handleFacebookCallback,
    isAuthenticated: !!token
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}