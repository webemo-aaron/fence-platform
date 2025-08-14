import axios from 'axios'

// Use the deployed API Gateway
const API_BASE_URL = 'https://fence-api-gateway-453424326027.us-central1.run.app'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fence_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fence_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API Services
export const authService = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password })
    return response.data
  },

  signup: async (userData) => {
    const response = await api.post('/api/auth/signup', userData)
    return response.data
  },

  verifyToken: async (token) => {
    const response = await api.post('/api/auth/verify', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me')
    return response.data
  }
}

export const pricingService = {
  getTiers: async () => {
    const response = await api.get('/api/pricing/tiers')
    return response.data
  },

  calculateROI: async (data) => {
    const response = await api.post('/api/pricing/calculate-roi', data)
    return response.data
  },

  getCustomQuote: async (data) => {
    const response = await api.post('/api/pricing/custom-quote', data)
    return response.data
  },

  compareTiers: async () => {
    const response = await api.get('/api/pricing/compare')
    return response.data
  }
}

export const socialService = {
  getTemplates: async () => {
    const response = await api.get('/api/social/templates')
    return response.data
  },

  createCampaign: async (campaignData) => {
    const response = await api.post('/api/social/campaigns', campaignData)
    return response.data
  },

  getCampaigns: async () => {
    const response = await api.get('/api/social/campaigns')
    return response.data
  },

  schedulePost: async (postData) => {
    const response = await api.post('/api/social/schedule-post', postData)
    return response.data
  },

  getAnalytics: async (params) => {
    const response = await api.get('/api/social/analytics', { params })
    return response.data
  },

  generateContent: async (data) => {
    const response = await api.post('/api/social/generate-content', data)
    return response.data
  }
}

export const facebookService = {
  getPages: async () => {
    const response = await api.get('/facebook/pages')
    return response.data
  },

  postToPage: async (postData) => {
    const response = await api.post('/facebook/post', postData)
    return response.data
  },

  schedulePost: async (postData) => {
    const response = await api.post('/facebook/schedule', postData)
    return response.data
  },

  getInsights: async (pageId) => {
    const response = await api.get(`/facebook/insights/${pageId}`)
    return response.data
  }
}

export const healthService = {
  checkHealth: async () => {
    const response = await api.get('/health')
    return response.data
  },

  getServices: async () => {
    const response = await api.get('/api/services')
    return response.data
  }
}

export default api