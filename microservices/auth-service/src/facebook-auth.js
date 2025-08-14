const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Initialize Facebook OAuth strategy
function initializeFacebookAuth(app, users) {
  const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';
  const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
  
  // Facebook App credentials (should be in environment variables)
  const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'your-app-id';
  const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'your-app-secret';
  const CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3001/auth/facebook/callback';

  passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: CALLBACK_URL,
    profileFields: ['id', 'emails', 'name', 'picture.type(large)', 'pages']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      let user = users.get(email);
      
      if (!user) {
        // Create new user from Facebook profile
        const userId = `fb-${profile.id}`;
        const tenantId = `fb-${profile.id}-tenant`;
        
        user = {
          id: userId,
          email,
          facebook_id: profile.id,
          facebook_access_token: accessToken,
          name: `${profile.name.givenName} ${profile.name.familyName}`,
          profile_picture: profile.photos[0]?.value,
          tenant_id: tenantId,
          tier: 'starter', // Default tier for social signups
          company: profile.name.givenName + ' Fence Co',
          role: 'admin',
          created_at: new Date(),
          social_accounts: {
            facebook: {
              id: profile.id,
              access_token: accessToken,
              refresh_token: refreshToken,
              pages: []
            }
          }
        };
        
        users.set(email, user);
      } else {
        // Update existing user with Facebook info
        user.facebook_id = profile.id;
        user.facebook_access_token = accessToken;
        user.social_accounts = user.social_accounts || {};
        user.social_accounts.facebook = {
          id: profile.id,
          access_token: accessToken,
          refresh_token: refreshToken,
          pages: user.social_accounts.facebook?.pages || []
        };
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    const user = Array.from(users.values()).find(u => u.id === id);
    done(null, user);
  });

  // Facebook OAuth routes
  app.get('/auth/facebook',
    passport.authenticate('facebook', { 
      scope: ['email', 'pages_show_list', 'pages_manage_posts', 'pages_read_engagement'] 
    })
  );

  app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
      // Generate JWT token
      const token = jwt.sign(
        {
          id: req.user.id,
          email: req.user.email,
          tenant_id: req.user.tenant_id,
          tier: req.user.tier,
          role: req.user.role,
          facebook_connected: true
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${token}`);
    }
  );

  // Get Facebook Pages for posting
  app.get('/facebook/pages', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = Array.from(users.values()).find(u => u.id === decoded.id);
      
      if (!user || !user.facebook_access_token) {
        return res.status(404).json({ error: 'Facebook not connected' });
      }

      // Fetch user's Facebook pages
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/me/accounts`,
        {
          params: {
            access_token: user.facebook_access_token
          }
        }
      );

      const pages = response.data.data.map(page => ({
        id: page.id,
        name: page.name,
        access_token: page.access_token,
        category: page.category
      }));

      // Store pages in user profile
      user.social_accounts.facebook.pages = pages;

      res.json({
        success: true,
        pages,
        total: pages.length
      });
    } catch (error) {
      console.error('Error fetching Facebook pages:', error);
      res.status(500).json({ error: 'Failed to fetch Facebook pages' });
    }
  });

  // Post to Facebook Page
  app.post('/facebook/post', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { page_id, message, link, image_url } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = Array.from(users.values()).find(u => u.id === decoded.id);
      
      if (!user || !user.social_accounts?.facebook?.pages) {
        return res.status(404).json({ error: 'Facebook pages not connected' });
      }

      const page = user.social_accounts.facebook.pages.find(p => p.id === page_id);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      // Prepare post data
      const postData = {
        message,
        access_token: page.access_token
      };

      if (link) postData.link = link;
      if (image_url) {
        // Post with image
        const response = await axios.post(
          `https://graph.facebook.com/v18.0/${page_id}/photos`,
          {
            url: image_url,
            caption: message,
            access_token: page.access_token
          }
        );
        
        res.json({
          success: true,
          post_id: response.data.id,
          post_url: `https://facebook.com/${response.data.id}`
        });
      } else {
        // Text post
        const response = await axios.post(
          `https://graph.facebook.com/v18.0/${page_id}/feed`,
          postData
        );
        
        res.json({
          success: true,
          post_id: response.data.id,
          post_url: `https://facebook.com/${response.data.id}`
        });
      }
    } catch (error) {
      console.error('Error posting to Facebook:', error);
      res.status(500).json({ error: 'Failed to post to Facebook' });
    }
  });

  // Schedule Facebook post
  app.post('/facebook/schedule', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { page_id, message, scheduled_publish_time, link, image_url } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = Array.from(users.values()).find(u => u.id === decoded.id);
      
      if (!user || !user.social_accounts?.facebook?.pages) {
        return res.status(404).json({ error: 'Facebook pages not connected' });
      }

      const page = user.social_accounts.facebook.pages.find(p => p.id === page_id);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      // Schedule post
      const postData = {
        message,
        published: false,
        scheduled_publish_time: Math.floor(new Date(scheduled_publish_time).getTime() / 1000),
        access_token: page.access_token
      };

      if (link) postData.link = link;

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${page_id}/feed`,
        postData
      );
      
      res.json({
        success: true,
        scheduled_post_id: response.data.id,
        scheduled_time: scheduled_publish_time
      });
    } catch (error) {
      console.error('Error scheduling Facebook post:', error);
      res.status(500).json({ error: 'Failed to schedule Facebook post' });
    }
  });

  // Get Facebook insights
  app.get('/facebook/insights/:page_id', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { page_id } = req.params;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = Array.from(users.values()).find(u => u.id === decoded.id);
      
      if (!user || !user.social_accounts?.facebook?.pages) {
        return res.status(404).json({ error: 'Facebook pages not connected' });
      }

      const page = user.social_accounts.facebook.pages.find(p => p.id === page_id);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      // Fetch page insights
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${page_id}/insights`,
        {
          params: {
            metric: 'page_views_total,page_engaged_users,page_post_engagements',
            period: 'day',
            access_token: page.access_token
          }
        }
      );
      
      res.json({
        success: true,
        insights: response.data.data,
        page_name: page.name
      });
    } catch (error) {
      console.error('Error fetching Facebook insights:', error);
      res.status(500).json({ error: 'Failed to fetch Facebook insights' });
    }
  });

  return passport;
}

module.exports = { initializeFacebookAuth };