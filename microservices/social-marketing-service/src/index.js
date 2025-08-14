const express = require('express');
const helmet = require('helmet');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3007;

// Security middleware
app.use(helmet());
app.use(express.json());

// In-memory storage for campaigns (replace with database)
const campaigns = new Map();
const scheduledPosts = new Map();
const contentTemplates = new Map();

// Pre-defined content templates for fence companies
const fenceContentTemplates = [
  {
    id: 'spring-promo',
    name: 'Spring Fence Promotion',
    template: 'Spring is here! Time to upgrade your fence. Get {discount}% off all installations this month. Call us at {phone} or visit {website}',
    image_suggestions: ['fence-spring.jpg', 'yard-beauty.jpg'],
    hashtags: ['#FenceInstallation', '#SpringHome', '#PropertyValue', '#LocalBusiness']
  },
  {
    id: 'maintenance-tip',
    name: 'Fence Maintenance Tip',
    template: 'Fence Maintenance Tip: {tip}. Need professional help? We offer comprehensive maintenance services. Contact us today!',
    image_suggestions: ['fence-maintenance.jpg'],
    hashtags: ['#FenceMaintenance', '#HomeTips', '#PropertyCare']
  },
  {
    id: 'customer-spotlight',
    name: 'Customer Success Story',
    template: 'Check out this amazing {fence_type} fence we installed for {customer_area}! Another happy customer. Ready to transform your property?',
    image_suggestions: ['customer-fence.jpg'],
    hashtags: ['#CustomerSuccess', '#FenceDesign', '#HappyCustomers']
  },
  {
    id: 'safety-focus',
    name: 'Safety & Security',
    template: 'Keep your family and pets safe with a quality fence. We offer {fence_types} perfect for your needs. Free estimates available!',
    image_suggestions: ['family-fence.jpg', 'pet-safety.jpg'],
    hashtags: ['#HomeSafety', '#PetSafety', '#SecureFencing']
  }
];

// Initialize templates
fenceContentTemplates.forEach(template => {
  contentTemplates.set(template.id, template);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'social-marketing-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    active_campaigns: campaigns.size,
    scheduled_posts: scheduledPosts.size
  });
});

// Get all content templates
app.get('/templates', (req, res) => {
  res.json({
    templates: Array.from(contentTemplates.values()),
    total: contentTemplates.size
  });
});

// Generate AI-powered content
app.post('/generate-content', async (req, res) => {
  const { 
    business_name,
    topic,
    tone = 'professional',
    include_cta = true,
    platform = 'facebook'
  } = req.body;

  try {
    // Simulate AI content generation (replace with actual OpenAI API call)
    const generatedContent = {
      primary_text: `Exciting news from ${business_name}! ${topic}. Our expert team is ready to help you with all your fencing needs.`,
      cta: include_cta ? 'Get your free quote today! Call us or visit our website.' : '',
      hashtags: generateHashtags(topic),
      platform_optimized: {
        facebook: {
          text: `Exciting news from ${business_name}! ${topic}. Our expert team is ready to help you with all your fencing needs. ${include_cta ? 'Get your free quote today!' : ''}`,
          recommended_image_type: 'landscape',
          optimal_post_time: '6:00 PM'
        },
        instagram: {
          text: `${topic} ✨\n\n${include_cta ? 'Link in bio for free quote!' : ''}\n\n${generateHashtags(topic).join(' ')}`,
          recommended_image_type: 'square',
          optimal_post_time: '12:00 PM'
        },
        twitter: {
          text: `${topic} | ${business_name} ${generateHashtags(topic).slice(0, 3).join(' ')}`,
          recommended_image_type: 'landscape',
          optimal_post_time: '9:00 AM'
        }
      }
    };

    res.json({
      success: true,
      content: generatedContent,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Create marketing campaign
app.post('/campaigns', (req, res) => {
  const {
    name,
    description,
    start_date,
    end_date,
    platforms = ['facebook'],
    post_frequency = 'daily',
    content_themes = ['promotions', 'tips', 'showcase'],
    auto_generate = true
  } = req.body;

  const campaignId = `campaign-${Date.now()}`;
  const campaign = {
    id: campaignId,
    name,
    description,
    start_date,
    end_date,
    platforms,
    post_frequency,
    content_themes,
    auto_generate,
    status: 'active',
    created_at: new Date(),
    posts_created: 0,
    posts_published: 0,
    engagement: {
      likes: 0,
      shares: 0,
      comments: 0,
      clicks: 0
    }
  };

  campaigns.set(campaignId, campaign);

  // Schedule campaign posts if auto_generate is true
  if (auto_generate) {
    scheduleCampaignPosts(campaign);
  }

  res.status(201).json({
    success: true,
    campaign
  });
});

// Get all campaigns
app.get('/campaigns', (req, res) => {
  const allCampaigns = Array.from(campaigns.values());
  
  res.json({
    campaigns: allCampaigns,
    active: allCampaigns.filter(c => c.status === 'active').length,
    total: allCampaigns.length
  });
});

// Get campaign details
app.get('/campaigns/:id', (req, res) => {
  const campaign = campaigns.get(req.params.id);
  
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  res.json(campaign);
});

// Schedule a post
app.post('/schedule-post', (req, res) => {
  const {
    content,
    platforms = ['facebook'],
    scheduled_time,
    campaign_id,
    images = [],
    auto_hashtags = true
  } = req.body;

  const postId = `post-${Date.now()}`;
  const scheduledPost = {
    id: postId,
    content,
    platforms,
    scheduled_time: new Date(scheduled_time),
    campaign_id,
    images,
    hashtags: auto_hashtags ? generateHashtags(content) : [],
    status: 'scheduled',
    created_at: new Date()
  };

  scheduledPosts.set(postId, scheduledPost);

  // Set up cron job for the scheduled time
  const cronTime = convertToCronTime(new Date(scheduled_time));
  cron.schedule(cronTime, async () => {
    await publishPost(scheduledPost);
  });

  res.status(201).json({
    success: true,
    post: scheduledPost
  });
});

// Get scheduled posts
app.get('/scheduled-posts', (req, res) => {
  const posts = Array.from(scheduledPosts.values())
    .filter(p => p.status === 'scheduled')
    .sort((a, b) => a.scheduled_time - b.scheduled_time);

  res.json({
    posts,
    total: posts.length,
    next_post: posts[0] || null
  });
});

// Analytics dashboard
app.get('/analytics', (req, res) => {
  const { start_date, end_date, platform } = req.query;

  // Simulate analytics data (replace with real data from social platforms)
  const analytics = {
    overview: {
      total_posts: scheduledPosts.size,
      total_reach: Math.floor(Math.random() * 10000) + 5000,
      total_engagement: Math.floor(Math.random() * 1000) + 200,
      engagement_rate: `${(Math.random() * 5 + 2).toFixed(2)}%`
    },
    by_platform: {
      facebook: {
        posts: Math.floor(scheduledPosts.size * 0.4),
        reach: Math.floor(Math.random() * 5000) + 2000,
        engagement: Math.floor(Math.random() * 500) + 100
      },
      instagram: {
        posts: Math.floor(scheduledPosts.size * 0.3),
        reach: Math.floor(Math.random() * 3000) + 1000,
        engagement: Math.floor(Math.random() * 300) + 50
      },
      twitter: {
        posts: Math.floor(scheduledPosts.size * 0.3),
        reach: Math.floor(Math.random() * 2000) + 500,
        engagement: Math.floor(Math.random() * 200) + 20
      }
    },
    best_performing_posts: [
      {
        id: 'post-1',
        content: 'Spring fence sale! 20% off all installations',
        platform: 'facebook',
        engagement: 450,
        reach: 3200
      },
      {
        id: 'post-2',
        content: 'Check out this beautiful cedar fence installation',
        platform: 'instagram',
        engagement: 380,
        reach: 2800
      }
    ],
    recommendations: [
      'Post more customer success stories - they get 40% more engagement',
      'Best posting time for your audience is 6-7 PM on weekdays',
      'Include more before/after photos for higher engagement',
      'Use location-based hashtags to reach local customers'
    ]
  };

  res.json(analytics);
});

// Content calendar
app.get('/calendar', (req, res) => {
  const { month, year } = req.query;
  
  const calendar = generateContentCalendar(
    parseInt(month) || new Date().getMonth() + 1,
    parseInt(year) || new Date().getFullYear()
  );

  res.json({
    calendar,
    month,
    year
  });
});

// Competitor analysis
app.get('/competitor-analysis', async (req, res) => {
  const { competitor_pages } = req.query;

  // Simulate competitor analysis (replace with real social media API calls)
  const analysis = {
    competitors: [
      {
        name: 'Local Fence Pro',
        platforms: ['facebook', 'instagram'],
        posting_frequency: 'daily',
        engagement_rate: '3.5%',
        top_content_types: ['before/after photos', 'customer testimonials'],
        estimated_followers: 2500
      },
      {
        name: 'Premium Fencing Co',
        platforms: ['facebook'],
        posting_frequency: '3x per week',
        engagement_rate: '2.8%',
        top_content_types: ['promotional offers', 'fence tips'],
        estimated_followers: 1800
      }
    ],
    insights: [
      'Competitors post most frequently on Tuesday and Thursday',
      'Video content gets 2x more engagement than photos',
      'Seasonal promotions perform best in March-May and September-October',
      'Customer testimonials have highest conversion rate'
    ],
    recommendations: [
      'Increase posting frequency to daily',
      'Create more video content showcasing installations',
      'Launch spring promotion campaign in early March',
      'Collect and share more customer testimonials'
    ]
  };

  res.json(analysis);
});

// Helper functions
function generateHashtags(content) {
  const baseHashtags = ['#FenceCompany', '#LocalBusiness'];
  
  if (content.toLowerCase().includes('spring')) {
    baseHashtags.push('#SpringSale', '#SpringHome');
  }
  if (content.toLowerCase().includes('wood') || content.toLowerCase().includes('cedar')) {
    baseHashtags.push('#WoodFence', '#CedarFence');
  }
  if (content.toLowerCase().includes('vinyl')) {
    baseHashtags.push('#VinylFence', '#LowMaintenance');
  }
  if (content.toLowerCase().includes('security')) {
    baseHashtags.push('#HomeSecurity', '#SafetyFirst');
  }
  
  return baseHashtags;
}

function scheduleCampaignPosts(campaign) {
  // Generate posts for the campaign duration
  const startDate = new Date(campaign.start_date);
  const endDate = new Date(campaign.end_date);
  const posts = [];
  
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // Create a post for each day (or based on frequency)
    const template = contentTemplates.get('spring-promo');
    const post = {
      id: `auto-post-${Date.now()}-${Math.random()}`,
      campaign_id: campaign.id,
      content: template.template,
      scheduled_time: new Date(currentDate),
      platforms: campaign.platforms,
      status: 'scheduled'
    };
    
    posts.push(post);
    scheduledPosts.set(post.id, post);
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  campaign.posts_created = posts.length;
  return posts;
}

function convertToCronTime(date) {
  const minutes = date.getMinutes();
  const hours = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  
  return `${minutes} ${hours} ${dayOfMonth} ${month} *`;
}

async function publishPost(post) {
  // Simulate publishing to social platforms
  console.log(`Publishing post ${post.id} to ${post.platforms.join(', ')}`);
  post.status = 'published';
  post.published_at = new Date();
  
  // Update campaign stats if linked to campaign
  if (post.campaign_id) {
    const campaign = campaigns.get(post.campaign_id);
    if (campaign) {
      campaign.posts_published++;
    }
  }
}

function generateContentCalendar(month, year) {
  const calendar = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayPosts = Array.from(scheduledPosts.values())
      .filter(p => {
        const postDate = new Date(p.scheduled_time);
        return postDate.getDate() === day && 
               postDate.getMonth() === month - 1 && 
               postDate.getFullYear() === year;
      });
    
    if (dayPosts.length > 0) {
      calendar.push({
        date: date.toISOString().split('T')[0],
        posts: dayPosts,
        count: dayPosts.length
      });
    }
  }
  
  return calendar;
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    service: 'social-marketing-service'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Social marketing service error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    service: 'social-marketing-service'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Social Marketing Service running on port ${PORT}`);
  console.log(`Content templates loaded: ${contentTemplates.size}`);
});