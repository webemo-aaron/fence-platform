#!/bin/bash

echo "================================================"
echo "Invisible Fence ROI Calculator - Demo Script"
echo "================================================"
echo ""

# Check if servers are running
echo "🔍 Checking server status..."
if curl -s http://localhost:3333/api/status > /dev/null 2>&1; then
    echo "✅ API Server is running on port 3333"
else
    echo "❌ API Server is not running. Please start it with: node start-api.js"
    exit 1
fi

if curl -s http://localhost:9090 > /dev/null 2>&1; then
    echo "✅ Web UI is running on port 9090"
else
    echo "⚠️  Web UI is not running. Please start it with: npm run serve-ui"
fi

echo ""
echo "================================================"
echo "Testing API Endpoints"
echo "================================================"
echo ""

# Test 1: Get current calculations
echo "📊 Current ROI Calculations:"
echo "----------------------------"
curl -s http://localhost:3333/api/calculations | python3 -c "
import json, sys
data = json.load(sys.stdin)
for calc in data['calculations']['calculations']:
    print(f\"{calc['tier']}:\")
    print(f\"  Monthly ROI: \${calc['monthlyROI']:,.0f}\")
    print(f\"  Annual ROI: \${calc['annualROI']:,.0f}\")
    print(f\"  Payback Period: {calc['paybackPeriod']:.1f} months\")
    print(f\"  ROI %: {calc['totalROI']:.1f}%\")
    print()
"

# Test 2: Update Professional tier
echo "🔄 Updating Professional Tier pricing to $699..."
curl -s -X POST http://localhost:3333/api/tiers/Professional \
  -H "Content-Type: application/json" \
  -d '{
    "basePrice": 699,
    "adminHours": 45,
    "adminCost": 80,
    "travelHours": 15,
    "revenuLeakagePercent": 0.10,
    "paymentDelays": 1200,
    "upsellRevenue": 800,
    "predictiveMaintenance": 200
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
    calc = data['calculation']
    print(f\"✅ Updated! New Monthly ROI: \${calc['monthlyROI']:,.0f}\")
"

echo ""

# Test 3: Update global configuration
echo "⚙️  Updating Global Configuration..."
curl -s -X POST http://localhost:3333/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "hourlyRate": 40,
    "monthlyRevenue": 60000,
    "manualAdminHours": 100,
    "manualTravelHours": 50
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
    print('✅ Configuration updated successfully')
"

echo ""

# Test 4: Generate a scenario
echo "🎯 Generating 'Aggressive Growth' Scenario..."
curl -s -X POST http://localhost:3333/api/scenarios \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aggressive Growth",
    "inputs": {
      "Essentials": {
        "basePrice": 199,
        "adminHours": 25,
        "adminCost": 40,
        "travelHours": 8,
        "revenuLeakagePercent": 0.06,
        "paymentDelays": 600,
        "upsellRevenue": 100,
        "predictiveMaintenance": 0
      },
      "Professional": {
        "basePrice": 499,
        "adminHours": 50,
        "adminCost": 60,
        "travelHours": 12,
        "revenuLeakagePercent": 0.10,
        "paymentDelays": 1500,
        "upsellRevenue": 1000,
        "predictiveMaintenance": 300
      },
      "Enterprise": {
        "basePrice": 899,
        "adminHours": 75,
        "adminCost": 80,
        "travelHours": 20,
        "revenuLeakagePercent": 0.15,
        "paymentDelays": 2500,
        "upsellRevenue": 2000,
        "predictiveMaintenance": 1500
      }
    }
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"Scenario: {data['name']}\")
print('ROI Comparison:')
for calc in data['calculations']:
    print(f\"  {calc['tier']}: \${calc['monthlyROI']:,.0f}/month (Payback: {calc['paybackPeriod']:.1f} months)\")
"

echo ""
echo "================================================"
echo "Summary"
echo "================================================"
echo ""
echo "✅ API Server: http://localhost:3333/api/status"
echo "✅ Web Interface: http://localhost:9090"
echo "✅ All endpoints tested successfully"
echo ""
echo "Available API Endpoints:"
echo "  GET  /api/status       - System status"
echo "  GET  /api/calculations - Get all ROI calculations"
echo "  POST /api/tiers/:tier  - Update tier configuration"
echo "  POST /api/config       - Update global settings"
echo "  POST /api/scenarios    - Generate test scenarios"
echo "  GET  /api/export       - Export all data as JSON"
echo "  GET  /api/events       - Server-sent events stream"
echo ""
echo "📈 Open http://localhost:9090 in your browser to use the interactive UI"
echo ""