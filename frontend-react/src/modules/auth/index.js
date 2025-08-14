// Auth Module - Enterprise Authentication System
export { default as AuthProvider } from '../../contexts/AuthContext'
export { default as Login } from '../../pages/Login'
export { default as FacebookCallback } from '../../pages/FacebookCallback'
export { default as ProtectedRoute } from '../../components/ProtectedRoute'

// Auth utilities
export const authConfig = {
  apiBaseUrl: 'https://fence-api-gateway-453424326027.us-central1.run.app',
  facebookAuthUrl: 'https://fence-auth-service-453424326027.us-central1.run.app/auth/facebook',
  tokenKey: 'fence_token'
}

// Auth API endpoints
export const authEndpoints = {
  login: '/api/auth/login',
  signup: '/api/auth/signup', 
  verify: '/api/auth/verify',
  me: '/api/auth/me',
  facebook: '/auth/facebook'
}