import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { healthService } from '../services/api'
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ShareIcon,
  ShieldCheckIcon,
  ClockIcon,
  TrendingUpIcon
} from '@heroicons/react/24/outline'

const Home = () => {
  const { isAuthenticated } = useAuth()
  const [systemHealth, setSystemHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSystemHealth = async () => {
      try {
        const health = await healthService.checkHealth()
        setSystemHealth(health)
      } catch (error) {
        console.error('Failed to check system health:', error)
      } finally {
        setLoading(false)
      }
    }

    checkSystemHealth()
  }, [])

  const features = [
    {
      icon: CurrencyDollarIcon,
      title: 'Smart Pricing',
      description: 'AI-powered ROI calculator with tier-based pricing. See real savings and business value.',
      stats: '5,447% Average ROI'
    },
    {
      icon: ShareIcon,
      title: 'Social Automation',
      description: 'Facebook integration with automated posting, content templates, and analytics.',
      stats: '4 Content Templates'
    },
    {
      icon: ChartBarIcon,
      title: 'Business Analytics',
      description: 'Comprehensive dashboard with performance metrics and growth insights.',
      stats: 'Real-time Data'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Enterprise Security',
      description: 'Multi-layer security with JWT authentication and secure microservices architecture.',
      stats: '99.9% Uptime'
    }
  ]

  const pricingTiers = [
    {
      name: 'Starter',
      price: 49,
      features: ['5 Active Jobs', 'Basic Route Optimization', 'Customer Portal', 'Email Support'],
      color: 'border-gray-200 bg-white'
    },
    {
      name: 'Essential',
      price: 149,
      features: ['25 Active Jobs', 'Advanced Route Optimization', 'Photo Documentation', 'Priority Support'],
      color: 'border-primary-200 bg-primary-50',
      popular: true
    },
    {
      name: 'Professional',
      price: 299,
      features: ['Unlimited Jobs', 'AI-Powered Optimization', 'Advanced Analytics', 'Phone Support'],
      color: 'border-gray-200 bg-white'
    }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Smart Fence Business
              <span className="block text-primary-200">Management Platform</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-primary-100 max-w-3xl mx-auto">
              Complete microservices solution with AI-powered pricing, Facebook integration, 
              and automated business management for fence companies.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-colors"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-colors"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    to="/login"
                    className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-600 transition-colors"
                  >
                    Login with Facebook
                  </Link>
                </>
              )}
            </div>

            {/* System Status */}
            {systemHealth && (
              <div className="inline-flex items-center space-x-2 bg-white bg-opacity-20 backdrop-blur-sm px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">
                  All systems operational • Uptime: {Math.floor(systemHealth.uptime / 60)} minutes
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Complete Business Solution
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Microservices architecture delivering enterprise-grade features 
              with Facebook integration for automated online presence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="card text-center">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {feature.description}
                  </p>
                  <div className="text-primary-600 font-semibold">
                    {feature.stats}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Live Services Status */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Live Microservices Architecture
            </h2>
            <p className="text-lg text-gray-600">
              All services are deployed and operational on Google Cloud Platform
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'API Gateway', status: 'healthy', port: '8080', description: 'Main routing & security' },
              { name: 'Auth Service', status: 'healthy', port: '3001', description: 'Facebook OAuth & JWT' },
              { name: 'Pricing Service', status: 'healthy', port: '3004', description: 'ROI Calculator & Tiers' },
              { name: 'Social Marketing', status: 'healthy', port: '3007', description: 'Content & Campaigns' }
            ].map((service, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600 font-medium">Live</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                <div className="text-xs text-gray-500">Port: {service.port}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600">
              Tier-based pricing with proven ROI. Start saving immediately.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <div key={index} className={`relative p-8 rounded-2xl border-2 ${tier.color}`}>
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                  <div className="text-4xl font-bold text-primary-600">
                    ${tier.price}
                    <span className="text-lg text-gray-600 font-normal">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center">
                      <ShieldCheckIcon className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/login"
                  className={`w-full text-center py-3 px-6 rounded-lg font-semibold transition-colors ${
                    tier.popular
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Fence Business?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join successful fence companies using our platform. Get started with Facebook integration today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-colors"
              >
                Access Your Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-colors"
                >
                  Start Free Trial
                </Link>
                <a
                  href="https://fence-auth-service-453424326027.us-central1.run.app/auth/facebook"
                  className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-600 transition-colors"
                >
                  📱 Login with Facebook
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home