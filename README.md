# 🎯 Invisible Fence Automation Platform

A comprehensive, event-driven business automation platform that transforms paper-based operations into intelligent, automated workflows with location-based pricing, fuel-saving scheduling optimization, and Firebase authentication.

## 🚀 Features

### Core Capabilities
- **Event-Driven Architecture**: Real-time updates when any input changes
- **Tiered Pricing Model**: Essentials, Professional, and Enterprise tiers
- **Dynamic ROI Calculations**: Automatic recalculation of all metrics
- **Google Sheets Integration**: Live spreadsheet with formulas and data validation
- **Google Slides Integration**: Auto-generated presentation with charts and tables
- **Chart Generation**: Dynamic bar, pie, and comparison charts
- **Scenario Testing**: Compare different pricing and configuration scenarios

### ROI Metrics Tracked
- Admin time savings
- Travel time optimization
- Revenue leakage recovery
- Payment delay recovery
- Upsell revenue potential
- Predictive maintenance savings
- Total monthly and annual ROI
- Payback period calculation

## 🏗️ Architecture

```
src/invisible-fence-automation/
├── models/
│   └── tier-input.model.ts       # Data models and interfaces
├── services/
│   ├── roi-calculator.service.ts # Core calculation engine
│   ├── chart-generator.service.ts # Chart generation with Chart.js
│   ├── google-sheets.service.ts  # Google Sheets API integration
│   ├── google-slides.service.ts  # Google Slides API integration
│   └── automation-orchestrator.ts # Event coordination service
├── api/
│   └── app.ts                    # Express REST API server
├── ui/
│   └── index.html                # Web interface
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Installation

1. Install dependencies:
```bash
cd src/invisible-fence-automation
npm install
```

2. Install TypeScript dependencies:
```bash
npm install --save-dev @types/cors @types/express @types/node ts-node ts-node-dev typescript
```

3. Build the project:
```bash
npm run build
```

## 🚀 Running the System

### Start the API Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The API server will run on `http://localhost:3333`

### Serve the Web UI
```bash
npm run serve-ui
```

The UI will be available at `http://localhost:9090`

## 📊 API Endpoints

### Status & Health
- `GET /api/status` - System status and initialization state

### Calculations
- `GET /api/calculations` - Get all current ROI calculations
- `POST /api/tiers/:tier` - Update tier configuration
- `POST /api/config` - Update global configuration

### Scenarios
- `POST /api/scenarios` - Generate and test scenarios
- `GET /api/export` - Export all data as JSON

### Real-time Events
- `GET /api/events` - Server-sent events stream

## 🎯 Usage Examples

### Update Tier Configuration
```javascript
POST /api/tiers/Professional
{
  "basePrice": 599,
  "adminHours": 40,
  "adminCost": 75,
  "travelHours": 20,
  "revenuLeakagePercent": 0.08,
  "paymentDelays": 1000,
  "upsellRevenue": 500,
  "predictiveMaintenance": 0
}
```

### Update Global Configuration
```javascript
POST /api/config
{
  "hourlyRate": 35,
  "monthlyRevenue": 50000,
  "manualAdminHours": 80,
  "manualTravelHours": 40
}
```

### Generate Scenario
```javascript
POST /api/scenarios
{
  "name": "Aggressive Pricing",
  "inputs": {
    "Essentials": { ... },
    "Professional": { ... },
    "Enterprise": { ... }
  }
}
```

## 🔐 Google API Setup (Optional)

To enable Google Sheets and Slides integration:

1. Enable APIs in Google Cloud Console:
   - Google Sheets API
   - Google Slides API
   - Google Drive API

2. Create OAuth 2.0 credentials

3. Download credentials JSON and save as `credentials.json`

4. Run authorization flow to get token

5. Pass credentials and token when initializing the orchestrator

## 📈 Event Flow

1. **Input Change** → User modifies tier pricing or configuration
2. **Event Emission** → Calculator emits `input-changed` event
3. **Recalculation** → ROI metrics automatically recalculated
4. **Chart Update** → Charts regenerated with new data
5. **Sheet Update** → Google Sheets formulas update (if connected)
6. **Slides Update** → Presentation charts refresh (if connected)
7. **UI Update** → Real-time updates via Server-Sent Events

## 🎨 Features by Tier

### Essentials ($299/month)
- Job scheduling
- Customer notifications
- Digital forms
- Invoicing automation

### Professional ($599/month)
- Everything in Essentials
- Route optimization
- Inventory management
- Advanced analytics
- Multi-location support

### Enterprise ($999/month)
- Everything in Professional
- Predictive maintenance
- Custom integrations
- API access
- Dedicated support

## 📊 Deliverables

The system produces:
1. **Dynamic Google Sheet** with live formulas and calculations
2. **Google Slides Presentation** with 17 slides including:
   - Executive summary
   - Pain points analysis
   - Digital workflow diagram
   - Tier comparisons
   - ROI analysis per tier
   - Visual charts and graphs
   - Implementation roadmap
   - Call to action

## 🧪 Testing

Run the test suite:
```bash
npm test
```

## 🚦 Development

### Start Development Server
```bash
npm run dev
```

### Lint Code
```bash
npm run lint
```

### Build for Production
```bash
npm run build
```

## 📝 License

ISC

## 🤝 Support

For issues or questions, please contact the development team.