import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { pricingService, healthService } from '../services/api'
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  TrendingUpIcon,
  ClockIcon,
  UserGroupIcon,
  ShareIcon
} from '@heroicons/react/24/outline'

const Dashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [roiData, setRoiData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get ROI calculation
        const roiResponse = await pricingService.calculateROI({
          current_jobs_per_month: 25,
          average_job_value: 850,
          current_fuel_cost: 600,
          current_labor_hours: 180,
          hourly_rate: 28
        })
        setRoiData(roiResponse)

        // Mock stats based on user tier
        const mockStats = {
          monthly_savings: roiResponse.financial_impact.monthly_fuel_savings + roiResponse.financial_impact.monthly_labor_savings,
          additional_revenue: roiResponse.financial_impact.monthly_additional_revenue,
          payback_period: roiResponse.roi_metrics.payback_period_months,
          annual_roi: roiResponse.roi_metrics.annual_roi_percent
        }
        setStats(mockStats)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Monthly Savings',
      value: stats ? `$${stats.monthly_savings.toLocaleString()}` : '$0',
      change: '+25%',
      changeType: 'positive',
      icon: CurrencyDollarIcon,
      description: 'Fuel & labor cost reductions'
    },
    {
      title: 'Additional Revenue',
      value: stats ? `$${stats.additional_revenue.toLocaleString()}` : '$0',
      change: '+30%',
      changeType: 'positive',
      icon: TrendingUpIcon,
      description: 'From increased job capacity'
    },
    {
      title: 'ROI Percentage',
      value: stats ? `${stats.annual_roi.toLocaleString()}%` : '0%',
      change: 'vs industry avg',
      changeType: 'neutral',
      icon: ChartBarIcon,
      description: 'Annual return on investment'
    },
    {
      title: 'Payback Period',
      value: stats ? `${stats.payback_period} month${stats.payback_period !== 1 ? 's' : ''}` : '0 months',
      change: 'Break-even time',
      changeType: 'neutral',
      icon: ClockIcon,
      description: 'Time to recoup investment'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.company || 'User'}! 👋
          </h1>
          <p className="text-gray-600 mt-2">
            Here's how your {user?.tier || 'starter'} plan is performing today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-primary-600 bg-opacity-10 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    stat.changeType === 'positive' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {stat.change}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    {stat.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stat.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* ROI Breakdown */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-6">ROI Breakdown</h2>
              
              {roiData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-700 mb-2">Current Metrics</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Jobs/Month:</span>
                          <span className="font-medium">{roiData.current_metrics.jobs_per_month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Job Value:</span>
                          <span className="font-medium">${roiData.current_metrics.average_job_value}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Labor Hours:</span>
                          <span className="font-medium">{roiData.current_metrics.monthly_labor_hours}h</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-medium text-green-800 mb-2">Projected Improvements</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-green-700">
                          <span>Fuel Savings:</span>
                          <span className="font-medium">{roiData.projected_improvements.fuel_savings_percent}</span>
                        </div>
                        <div className="flex justify-between text-green-700">
                          <span>Time Savings:</span>
                          <span className="font-medium">{roiData.projected_improvements.time_savings_percent}</span>
                        </div>
                        <div className="flex justify-between text-green-700">
                          <span>Capacity Increase:</span>
                          <span className="font-medium">{roiData.projected_improvements.capacity_increase_percent}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-primary-800 mb-4">
                      Recommended Plan: {roiData.recommendation.tier}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-primary-700 font-medium">Monthly Cost</div>
                        <div className="text-2xl font-bold text-primary-900">
                          ${roiData.recommendation.monthly_cost}
                        </div>
                      </div>
                      <div>
                        <div className="text-green-700 font-medium">Net Annual Benefit</div>
                        <div className="text-2xl font-bold text-green-900">
                          ${roiData.recommendation.net_annual_benefit.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Plan Info */}
            <div className="card">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Your Plan</h2>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">
                    {user?.tier === 'professional' ? '🚀' : user?.tier === 'essential' ? '⭐' : '🌟'}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 capitalize mb-1">
                  {user?.tier || 'Starter'} Plan
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {user?.facebook_connected ? 'Facebook Connected' : 'Connect Facebook for more features'}
                </p>
                {!user?.facebook_connected && (
                  <a
                    href="https://fence-auth-service-453424326027.us-central1.run.app/auth/facebook"
                    className="btn-primary text-sm w-full"
                  >
                    📱 Connect Facebook
                  </a>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <a
                  href="/pricing"
                  className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <CurrencyDollarIcon className="w-5 h-5 text-primary-600 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">View Pricing</div>
                    <div className="text-sm text-gray-500">Calculate ROI</div>
                  </div>
                </a>
                
                <a
                  href="/social"
                  className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ShareIcon className="w-5 h-5 text-green-600 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">Social Media</div>
                    <div className="text-sm text-gray-500">Manage campaigns</div>
                  </div>
                </a>

                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <UserGroupIcon className="w-5 h-5 text-blue-600 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">Customer Portal</div>
                    <div className="text-sm text-gray-500">Coming soon</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard