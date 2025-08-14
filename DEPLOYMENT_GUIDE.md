# Invisible Fence ROI Calculator - Deployment Guide

## 🚀 Quick Start

The system is currently running with:
- **API Server**: http://localhost:3333
- **Web Interface**: http://localhost:9090

## 📦 System Components

### 1. API Server (`start-api.js`)
- REST API with real-time ROI calculations
- Event-driven updates for tier changes
- Scenario testing and comparison
- Server-sent events for real-time UI updates

### 2. Web Interface (`ui/index.html`)
- Interactive dashboard for tier configuration
- Real-time ROI visualization
- Dynamic charts and comparisons
- Export functionality

### 3. Core Services
- **ROI Calculator**: Calculates savings and ROI metrics
- **Chart Generator**: Creates dynamic visualizations
- **Google Sheets Service**: Spreadsheet integration (optional)
- **Google Slides Service**: Presentation generation (optional)
- **Automation Orchestrator**: Coordinates all services

## 🎯 Current Features

### Tiered Pricing Model
- **Essentials** ($299/month): Basic automation features
- **Professional** ($599/month): Advanced features + analytics
- **Enterprise** ($999/month): Full suite + predictive maintenance

### ROI Metrics
- Admin time savings
- Travel time optimization
- Revenue leakage recovery
- Payment delay recovery
- Upsell revenue tracking
- Predictive maintenance value

### Dynamic Calculations
- Real-time updates when inputs change
- Configurable hourly rates and revenue
- Scenario comparison tools
- Export to JSON format

## 📊 Demo Results

Based on current configuration:
- **Essentials**: $9,940/month ROI (Payback: < 1 month)
- **Professional**: $14,260/month ROI (Payback: < 1 month)
- **Enterprise**: $20,120/month ROI (Payback: < 1 month)

## 🔧 Management Commands

### Start Servers
```bash
# Start API server
cd src/invisible-fence-automation
node start-api.js

# Start Web UI (in another terminal)
npm run serve-ui
```

### Run Demo
```bash
./demo.sh
```

### Test API
```bash
# Check status
curl http://localhost:3333/api/status

# Get calculations
curl http://localhost:3333/api/calculations

# Update tier
curl -X POST http://localhost:3333/api/tiers/Professional \
  -H "Content-Type: application/json" \
  -d '{"basePrice": 699, "adminHours": 45}'
```

## 🌐 Production Deployment

### Option 1: Cloud Run (Google Cloud)
```bash
# Build Docker image
docker build -t invisible-fence-roi .

# Deploy to Cloud Run
gcloud run deploy invisible-fence-roi \
  --image invisible-fence-roi \
  --platform managed \
  --allow-unauthenticated \
  --port 3333
```

### Option 2: Node.js Server
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start start-api.js --name "invisible-fence-api"
pm2 save
pm2 startup
```

### Option 3: Integrate with ServiceHive
The system is designed as a module that can be integrated into the main ServiceHive platform:

```javascript
// In src/app.module.ts
import { InvisibleFenceModule } from './invisible-fence-automation/invisible-fence.module';

@Module({
  imports: [
    // ... other modules
    InvisibleFenceModule,
  ],
})
export class AppModule {}
```

## 📈 Google Integration (Optional)

### Enable Google APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable:
   - Google Sheets API
   - Google Slides API
   - Google Drive API

### Setup Credentials
```bash
# Download credentials.json from Google Cloud Console
# Place in src/invisible-fence-automation/

# Run authentication
node auth.js

# Token will be saved for future use
```

### Features with Google Integration
- Auto-generated spreadsheets with formulas
- Dynamic presentation slides
- Real-time chart updates
- PDF export capability

## 🎨 Customization

### Modify Tier Pricing
Edit `start-api.js`:
```javascript
let tierData = {
  Essentials: {
    basePrice: 299,  // Change this
    // ... other settings
  }
}
```

### Adjust ROI Formulas
Edit calculation function in `start-api.js`:
```javascript
function calculateROI(tier, input) {
  // Modify formulas here
}
```

### Update UI Theme
Edit `ui/index.html` CSS section:
```css
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* Change gradient colors */
}
```

## 📱 Mobile Support

The web interface is responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones

## 🔒 Security Considerations

For production deployment:
1. Add authentication middleware
2. Use HTTPS certificates
3. Set CORS policies appropriately
4. Validate all inputs
5. Rate limit API endpoints

## 📞 Support

- API Documentation: `/api/status`
- Web Interface: http://localhost:9090
- Demo Script: `./demo.sh`

## ✅ Success Metrics

The system successfully:
- Calculates ROI in real-time
- Provides tiered pricing comparison
- Generates dynamic charts
- Exports data for analysis
- Integrates with Google services (optional)
- Delivers professional presentations

## 🚀 Next Steps

1. **Immediate**: Access the web interface at http://localhost:9090
2. **Testing**: Run `./demo.sh` to see all features
3. **Customization**: Adjust pricing and formulas as needed
4. **Deployment**: Choose deployment option based on needs
5. **Integration**: Connect with existing ServiceHive platform

The Invisible Fence ROI Calculator is now fully operational and ready for demonstration to stakeholders!