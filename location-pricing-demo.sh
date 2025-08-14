#!/bin/bash

echo "================================================================"
echo "🎯 Invisible Fence Location-Based Pricing System Demo"
echo "================================================================"
echo ""

# Check if servers are running
echo "🔍 Checking system status..."
if curl -s http://localhost:3333/api/status > /dev/null 2>&1; then
    echo "✅ Complete Platform is running on port 3333"
else
    echo "❌ Platform not running. Please start with: node server.js"
    exit 1
fi

echo ""
echo "🌐 Access Points:"
echo "  📊 ROI Calculator: http://localhost:3333"
echo "  👥 CRM Dashboard: http://localhost:3333/crm"
echo "  💰 Quote Generator: http://localhost:3333/quote"
echo ""

echo "================================================================"
echo "Location-Based Pricing Demonstrations"
echo "================================================================"
echo ""

# Test 1: High-cost market (San Francisco)
echo "📍 Test 1: High-Cost Market - San Francisco, CA"
echo "------------------------------------------------------------"
curl -s -X POST http://localhost:3333/api/quote/basic \
  -H "Content-Type: application/json" \
  -d '{
    "quote_request": {
      "address": "123 Market St",
      "city": "San Francisco", 
      "state": "CA",
      "zip_code": "94102",
      "property_size": 8000,
      "fence_perimeter": 500,
      "property_type": "Standard Residential",
      "terrain_type": "Steep Terrain",
      "num_pets": 1,
      "selected_tier": "Professional"
    }
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
pricing = data['pricing']
print(f'  Zone: {pricing[\"location\"][\"zone_name\"]}')
print(f'  Market Demand: {pricing[\"location\"][\"market_demand\"]}')
print(f'  Location Multiplier: {pricing[\"pricing\"][\"location_multiplier\"]}x')
print(f'  Terrain Multiplier: {pricing[\"pricing\"][\"terrain_multiplier\"]}x')
print(f'  💰 Installation Cost: \${pricing[\"totals\"][\"one_time_installation\"]:,}')
print(f'  📅 Install Time: {pricing[\"totals\"][\"estimated_install_time\"]}')
"

echo ""

# Test 2: Mid-cost market (Dallas)
echo "📍 Test 2: Mid-Cost Market - Dallas, TX"
echo "------------------------------------------------------------"
curl -s -X POST http://localhost:3333/api/quote/basic \
  -H "Content-Type: application/json" \
  -d '{
    "quote_request": {
      "address": "456 Elm St",
      "city": "Dallas", 
      "state": "TX",
      "zip_code": "75201",
      "property_size": 12000,
      "fence_perimeter": 700,
      "property_type": "Large Residential",
      "terrain_type": "Flat/Easy",
      "num_pets": 3,
      "selected_tier": "Enterprise"
    }
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
pricing = data['pricing']
print(f'  Zone: {pricing[\"location\"][\"zone_name\"]}')
print(f'  Market Demand: {pricing[\"location\"][\"market_demand\"]}')
print(f'  Location Multiplier: {pricing[\"pricing\"][\"location_multiplier\"]}x')
print(f'  Pet Multiplier: {pricing[\"pricing\"][\"pet_multiplier\"]}x')
print(f'  💰 Installation Cost: \${pricing[\"totals\"][\"one_time_installation\"]:,}')
print(f'  📊 Monthly Service: \${pricing[\"totals\"][\"monthly_service\"]} (Enterprise)')
"

echo ""

# Test 3: Low-cost market (Rural)
echo "📍 Test 3: Low-Cost Market - Rural Kansas"
echo "------------------------------------------------------------"
curl -s -X POST http://localhost:3333/api/quote/basic \
  -H "Content-Type: application/json" \
  -d '{
    "quote_request": {
      "address": "789 Country Rd",
      "city": "Kansas City", 
      "state": "MO",
      "zip_code": "64101",
      "property_size": 20000,
      "fence_perimeter": 1200,
      "property_type": "Farm/Ranch",
      "terrain_type": "Moderate Hills",
      "num_pets": 1,
      "selected_tier": "Essentials"
    }
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
pricing = data['pricing']
print(f'  Zone: {pricing[\"location\"][\"zone_name\"]}')
print(f'  Market Demand: {pricing[\"location\"][\"market_demand\"]}')
print(f'  Location Multiplier: {pricing[\"pricing\"][\"location_multiplier\"]}x')
print(f'  Property Type: {pricing[\"property\"][\"type\"]}')
print(f'  💰 Installation Cost: \${pricing[\"totals\"][\"one_time_installation\"]:,}')
print(f'  📊 Monthly Service: \${pricing[\"totals\"][\"monthly_service\"]} (Essentials)')
"

echo ""
echo "================================================================"
echo "Smart Scheduling & Fuel Savings Demo"
echo "================================================================"
echo ""

# Test 4: Optimized pricing with scheduling
echo "⚡ Test 4: Smart Scheduling Optimization"
echo "------------------------------------------------------------"
echo "Testing flexible scheduling to demonstrate fuel savings..."

curl -s -X POST http://localhost:3333/api/quote/optimized \
  -H "Content-Type: application/json" \
  -d '{
    "quote_request": {
      "address": "321 Oak Ave",
      "city": "Austin", 
      "state": "TX",
      "zip_code": "78701",
      "property_size": 9000,
      "fence_perimeter": 550,
      "property_type": "Standard Residential",
      "terrain_type": "Slight Slope",
      "num_pets": 2,
      "selected_tier": "Professional",
      "latitude": 30.2672,
      "longitude": -97.7431
    },
    "scheduling_preferences": {
      "flexible_scheduling": true,
      "preferred_date": "2024-02-15",
      "time_preference": "any"
    }
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
pricing = data['pricing']
scheduling = pricing.get('scheduling_optimization', {})
print(f'  Base Installation Cost: \${pricing[\"totals\"][\"one_time_installation\"]:,}')
if scheduling.get('potential_savings', 0) > 0:
    print(f'  🚀 Scheduling Savings: \${scheduling[\"potential_savings\"]:.0f}')
    best_option = scheduling.get('best_option', {})
    if best_option:
        print(f'  📅 Best Option: {best_option.get(\"type\", \"N/A\")}')
        print(f'  💰 Final Price: \${best_option.get(\"final_price\", 0):,.0f}')
else:
    print('  📅 No scheduling optimizations available at this time')
print(f'  🔍 Nearby Opportunities: {scheduling.get(\"nearby_opportunities\", 0)}')
"

echo ""
echo "================================================================"
echo "Pricing Zone Analysis"
echo "================================================================"
echo ""

echo "📊 Available Pricing Zones:"
echo "------------------------------------------------------------"
curl -s http://localhost:3333/api/quote/zones/list | python3 -c "
import json, sys
zones = json.load(sys.stdin)
print(f'Total Zones: {len(zones)}')
print()
for zone in zones[:10]:  # Show first 10 zones
    print(f'  🏠 {zone[\"zone_name\"]} ({zone[\"state\"]})')
    print(f'      Base Multiplier: {zone[\"base_multiplier\"]}x')
    print(f'      Labor Rate: \${zone[\"labor_rate_hourly\"]}/hour')
    print(f'      Market: {zone[\"market_demand\"]} demand, {zone[\"competition_level\"]} competition')
    print()
"

echo ""
echo "================================================================"
echo "System Capabilities Summary"
echo "================================================================"
echo ""

echo "✅ LOCATION-BASED PRICING:"
echo "   • 15+ regional pricing zones with market-specific multipliers"
echo "   • Terrain difficulty adjustments (flat to rocky/steep)"
echo "   • Property type optimization (residential to commercial)"
echo "   • Distance-based travel charges"
echo "   • Market demand and competition analysis"
echo ""

echo "✅ SMART SCHEDULING:"
echo "   • Job clustering for fuel savings (5-20% discounts)"
echo "   • Route optimization for multiple jobs"
echo "   • Flexible scheduling bonuses"
echo "   • Dynamic pricing based on technician availability"
echo ""

echo "✅ CUSTOMER EXPERIENCE:"
echo "   • Instant quote generation with real-time pricing"
echo "   • Multiple scheduling options with savings breakdown"
echo "   • Transparent pricing with detailed breakdown"
echo "   • Lead capture integration with CRM"
echo ""

echo "✅ BUSINESS INTELLIGENCE:"
echo "   • Pricing analytics by zone and tier"
echo "   • Scheduling efficiency metrics"
echo "   • Competitor pricing tracking"
echo "   • Conversion rate optimization"
echo ""

echo "================================================================"
echo "🎉 Demo Complete! Access the full system:"
echo "================================================================"
echo ""
echo "💰 Customer Quote Generator: http://localhost:3333/quote"
echo "📊 Business ROI Calculator: http://localhost:3333/"
echo "👥 CRM & Analytics Dashboard: http://localhost:3333/crm"
echo ""
echo "🔑 Admin Login: admin / admin123"
echo ""
echo "The system now provides intelligent, location-based pricing with"
echo "fuel-saving scheduling optimization for maximum profitability!"
echo ""