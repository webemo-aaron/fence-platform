# 🗺️ Google Maps API Setup Guide

## Quick Setup (5 minutes)

### Step 1: Get Your API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a New Project** (or select existing)
   - Click "Select a project" → "New Project"
   - Name: "Invisible Fence Platform"
   - Click "Create"

3. **Enable Required APIs**
   ```
   Enable these 3 APIs:
   ✅ Maps JavaScript API
   ✅ Places API
   ✅ Geocoding API
   ```
   
   Direct links:
   - [Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com)
   - [Places API](https://console.cloud.google.com/apis/library/places-backend.googleapis.com)
   - [Geocoding API](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com)

4. **Create API Key**
   - Go to: [Credentials Page](https://console.cloud.google.com/apis/credentials)
   - Click "+ CREATE CREDENTIALS" → "API key"
   - Copy your API key

5. **Secure Your API Key** (Important!)
   - Click on your API key to edit
   - Under "Application restrictions":
     - Select "HTTP referrers"
     - Add these URLs:
       ```
       http://localhost:9090/*
       http://localhost:3333/*
       http://127.0.0.1:9090/*
       http://127.0.0.1:3333/*
       YOUR_PRODUCTION_DOMAIN/*
       ```
   - Under "API restrictions":
     - Select "Restrict key"
     - Check: Maps JavaScript API, Places API, Geocoding API
   - Click "Save"

### Step 2: Add API Key to Platform

1. **Create/Edit the configuration file:**
   ```bash
   cd /mnt/c/GCP/ServiceHive/src/invisible-fence-automation
   ```

2. **Edit the `.env` file:**
   ```
   GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
   ```

3. **Or update directly in the HTML:**
   - Open `ui/map-visualizer.html`
   - Find line 823
   - Replace `YOUR_API_KEY` with your actual key

### Step 3: Test Your Setup

1. **Restart the server if needed:**
   ```bash
   # If using the API server
   cd /mnt/c/GCP/ServiceHive/src/invisible-fence-automation
   npm start
   ```

2. **Access the Fence Designer:**
   http://localhost:9090/map-visualizer.html

3. **Verify functionality:**
   - ✅ Map loads properly
   - ✅ Address search works
   - ✅ Can draw fence polygons
   - ✅ Measurements calculate correctly

## Billing & Costs

### Free Tier
- **$200 monthly credit** for Maps, Routes, and Places
- Covers approximately:
  - 28,000 map loads/month
  - 28,000 place searches/month
  - 40,000 geocoding requests/month

### Pricing (after free tier)
- Maps JavaScript API: $7 per 1,000 loads
- Places Autocomplete: $2.83 per 1,000 requests
- Geocoding API: $5 per 1,000 requests

### Cost Optimization Tips
1. **Implement caching** for geocoding results
2. **Use session tokens** for Places Autocomplete
3. **Lazy load maps** only when needed
4. **Set daily quotas** in Google Cloud Console

## Troubleshooting

### Common Issues

1. **"This page can't load Google Maps correctly"**
   - Check API key is correct
   - Verify billing is enabled
   - Check API restrictions

2. **Address search not working**
   - Ensure Places API is enabled
   - Check API key permissions

3. **Drawing tools not appearing**
   - Verify Drawing library is loaded
   - Check browser console for errors

4. **CORS errors**
   - Add your domain to HTTP referrer restrictions
   - Check API key configuration

## Security Best Practices

1. **Never commit API keys to Git**
   ```bash
   # Add to .gitignore
   .env
   config/maps.config.js
   ```

2. **Use environment variables**
   ```javascript
   const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
   ```

3. **Implement server-side proxy** for production
   ```javascript
   // Server endpoint to hide API key
   app.get('/api/maps-config', (req, res) => {
     res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
   });
   ```

4. **Monitor usage** in Google Cloud Console
   - Set up billing alerts
   - Review API usage weekly
   - Implement rate limiting

## Additional Features

### Advanced Capabilities Available
- **Street View** integration
- **Directions** service for route planning
- **Distance Matrix** for multi-location calculations
- **Elevation** service for terrain analysis
- **Static Maps** for reports/PDFs

### Custom Styling
```javascript
// Custom map style for branding
const mapStyles = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#667eea" }]
  }
];
```

## Support & Resources

- **Google Maps Documentation**: https://developers.google.com/maps/documentation/javascript
- **Pricing Calculator**: https://cloud.google.com/maps-platform/pricing
- **Support Forum**: https://stackoverflow.com/questions/tagged/google-maps-api-3
- **Status Dashboard**: https://status.cloud.google.com/

## Quick Test HTML

Save this as `test-maps.html` to verify your API key works:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Google Maps</title>
  <style>
    #map { height: 400px; width: 100%; }
  </style>
</head>
<body>
  <h1>Google Maps API Test</h1>
  <div id="map"></div>
  <script>
    function initMap() {
      const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 32.7767, lng: -96.7970 },
        zoom: 12
      });
      
      new google.maps.Marker({
        position: { lat: 32.7767, lng: -96.7970 },
        map: map,
        title: 'Dallas, TX'
      });
      
      console.log('✅ Google Maps loaded successfully!');
    }
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap">
  </script>
</body>
</html>
```

---

**Ready to proceed?** Once you have your API key, update the configuration and the Fence Designer will be fully functional with real Google Maps!