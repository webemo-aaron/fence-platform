import React, { useState, useEffect } from 'react'
import { socialService } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  ShareIcon,
  CalendarIcon,
  ChartBarIcon,
  SparklesIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

const SocialMedia = () => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('templates')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch templates
        const templatesData = await socialService.getTemplates()
        setTemplates(templatesData.templates || [])

        // Fetch campaigns
        const campaignsData = await socialService.getCampaigns()
        setCampaigns(campaignsData.campaigns || [])

        // Fetch analytics
        const analyticsData = await socialService.getAnalytics({})
        setAnalytics(analyticsData)
      } catch (error) {
        console.error('Failed to fetch social media data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleConnectFacebook = () => {
    window.location.href = 'https://fence-auth-service-453424326027.us-central1.run.app/auth/facebook'
  }

  const tabs = [
    { id: 'templates', name: 'Templates', icon: SparklesIcon },
    { id: 'campaigns', name: 'Campaigns', icon: CalendarIcon },
    { id: 'analytics', name: 'Analytics', icon: ChartBarIcon }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading social media data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Social Media Management 📱
          </h1>
          <p className="text-gray-600">
            Automate your fence company's online presence with AI-powered content and Facebook integration.
          </p>
        </div>

        {/* Facebook Connection Status */}
        {!user?.facebook_connected && (
          <div className="mb-8">
            <div className="social-card">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Connect Facebook for Full Features
                </h3>
                <p className="text-gray-600 mb-4">
                  Connect your Facebook account to automatically post to your business pages, 
                  schedule content, and get detailed analytics.
                </p>
                <button
                  onClick={handleConnectFacebook}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Connect Facebook Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Content Templates</h2>
              <button className="btn-primary">
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Template
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div key={template.id} className="card">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-900">{template.name}</h3>
                    <ShareIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  
                  <p className="text-gray-600 mb-4 text-sm">
                    {template.template}
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Hashtags</h4>
                      <div className="flex flex-wrap gap-1">
                        {template.hashtags.map((hashtag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                          >
                            {hashtag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Image Suggestions</h4>
                      <div className="flex flex-wrap gap-1">
                        {template.image_suggestions.map((suggestion, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded"
                          >
                            {suggestion}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button className="btn-secondary text-sm w-full">
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Marketing Campaigns</h2>
              <button className="btn-primary">
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Campaign
              </button>
            </div>

            {campaigns.length > 0 ? (
              <div className="grid gap-6">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="card">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900 mb-1">{campaign.name}</h3>
                        <p className="text-gray-600 text-sm">{campaign.description}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        campaign.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-500">Posts Created</div>
                        <div className="text-lg font-semibold text-gray-900">{campaign.posts_created}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Published</div>
                        <div className="text-lg font-semibold text-gray-900">{campaign.posts_published}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Likes</div>
                        <div className="text-lg font-semibold text-gray-900">{campaign.engagement.likes}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Shares</div>
                        <div className="text-lg font-semibold text-gray-900">{campaign.engagement.shares}</div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button className="btn-secondary text-sm">Edit Campaign</button>
                      <button className="btn-primary text-sm">View Analytics</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
                <p className="text-gray-600 mb-6">Create your first marketing campaign to start automating your social media presence.</p>
                <button className="btn-primary">Create Your First Campaign</button>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Social Media Analytics</h2>

            {analytics ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Total Posts</h3>
                    <ShareIcon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{analytics.overview.total_posts}</div>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Total Reach</h3>
                    <ChartBarIcon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{analytics.overview.total_reach.toLocaleString()}</div>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Engagement</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {analytics.overview.engagement_rate}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{analytics.overview.total_engagement.toLocaleString()}</div>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Platform</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      Facebook
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{analytics.by_platform.facebook.posts}</div>
                  <div className="text-sm text-gray-600">posts this month</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data</h3>
                <p className="text-gray-600">Connect Facebook and create some campaigns to see your analytics.</p>
              </div>
            )}

            {analytics?.recommendations && (
              <div className="card">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recommendations</h3>
                <div className="space-y-3">
                  {analytics.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-primary-500 rounded-full mr-3 mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SocialMedia