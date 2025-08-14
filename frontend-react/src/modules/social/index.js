// Social Media Module - Enterprise Social Marketing System
export { default as SocialMedia } from '../../pages/SocialMedia'
export { socialService, facebookService } from '../../services/api'

// Social media configuration
export const socialConfig = {
  platforms: ['facebook', 'instagram', 'twitter'],
  contentTypes: ['post', 'story', 'reel'],
  schedulingOptions: ['immediate', 'scheduled', 'recurring']
}

// Social API endpoints
export const socialEndpoints = {
  templates: '/api/social/templates',
  campaigns: '/api/social/campaigns',
  schedulePost: '/api/social/schedule-post',
  analytics: '/api/social/analytics',
  generateContent: '/api/social/generate-content'
}

// Facebook API endpoints
export const facebookEndpoints = {
  pages: '/facebook/pages',
  post: '/facebook/post',
  schedule: '/facebook/schedule',
  insights: '/facebook/insights'
}