import React, { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const FacebookCallback = () => {
  const { handleFacebookCallback } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    const error = params.get('error')

    if (error) {
      console.error('Facebook auth error:', error)
      navigate('/login?error=facebook_auth_failed')
      return
    }

    if (token) {
      handleFacebookCallback(token)
      navigate('/dashboard')
    } else {
      console.error('No token received from Facebook auth')
      navigate('/login?error=no_token')
    }
  }, [location, handleFacebookCallback, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6 animate-pulse">
          <span className="text-white text-2xl">📱</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Connecting Your Facebook Account...
        </h2>
        <p className="text-gray-600 mb-8">
          Please wait while we complete the authentication process.
        </p>
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}

export default FacebookCallback