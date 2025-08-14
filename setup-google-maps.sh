#!/bin/bash

# Google Maps API Setup Script
# This script helps you configure Google Maps for the Invisible Fence platform

echo "======================================"
echo "🗺️  Google Maps API Setup Helper"
echo "======================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
fi

# Check current API key status
CURRENT_KEY=$(grep GOOGLE_MAPS_API_KEY .env | cut -d '=' -f2)

if [ "$CURRENT_KEY" == "YOUR_API_KEY_HERE" ] || [ -z "$CURRENT_KEY" ]; then
    echo "⚠️  No Google Maps API key configured!"
    echo ""
    echo "To get your API key:"
    echo "1. Visit: https://console.cloud.google.com/apis/credentials"
    echo "2. Create a new API key or use an existing one"
    echo "3. Enable these APIs:"
    echo "   - Maps JavaScript API"
    echo "   - Places API"  
    echo "   - Geocoding API"
    echo ""
    echo -n "Enter your Google Maps API key: "
    read API_KEY
    
    if [ ! -z "$API_KEY" ]; then
        # Update .env file with the new key
        sed -i "s/GOOGLE_MAPS_API_KEY=.*/GOOGLE_MAPS_API_KEY=$API_KEY/" .env
        echo ""
        echo "✅ API key has been saved to .env file"
        echo ""
        echo "Restarting the API server..."
        pkill -f "node start-api.js" 2>/dev/null
        sleep 1
        node start-api.js &
        sleep 2
        echo "✅ Server restarted with new configuration"
    else
        echo "❌ No API key provided. Exiting..."
        exit 1
    fi
else
    echo "✅ Google Maps API key is already configured!"
    echo "Current key: ${CURRENT_KEY:0:10}..."
fi

echo ""
echo "======================================"
echo "📍 Testing Configuration..."
echo "======================================"

# Test the API endpoint
sleep 2
RESPONSE=$(curl -s http://localhost:3333/api/maps-config)
CONFIGURED=$(echo $RESPONSE | grep -o '"configured":true')

if [ ! -z "$CONFIGURED" ]; then
    echo "✅ Google Maps is properly configured!"
    echo ""
    echo "You can now access:"
    echo "  🗺️  Map Visualizer: http://localhost:9090/map-visualizer.html"
    echo "  📐 Fence Designer: http://localhost:9090/fence-designer-demo.html"
    echo "  📊 ROI Calculator: http://localhost:9090/"
else
    echo "⚠️  Configuration test failed. Please check your API key."
    echo "Response: $RESPONSE"
fi

echo ""
echo "======================================"
echo "✨ Setup Complete!"
echo "======================================"