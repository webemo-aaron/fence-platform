// Google Maps API Configuration
// IMPORTANT: Replace with your actual API key from Google Cloud Console

const MAPS_CONFIG = {
    // Your Google Maps API Key
    // Get one at: https://console.cloud.google.com/apis/credentials
    API_KEY: process.env.GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE',
    
    // Default map settings
    DEFAULT_CENTER: {
        lat: 32.7767,  // Dallas, TX
        lng: -96.7970
    },
    
    // Map options
    DEFAULT_ZOOM: 18,
    DEFAULT_MAP_TYPE: 'satellite',
    
    // Drawing options
    FENCE_COLOR: '#667eea',
    FENCE_OPACITY: 0.3,
    FENCE_STROKE_WEIGHT: 3,
    
    // Pricing configuration (per linear foot)
    PRICE_PER_FOOT: 15,
    GATE_PRICE: 250,
    CORNER_CHARGE: 25,
    
    // Service areas (for demo/testing)
    SERVICE_AREAS: [
        { name: 'Dallas-Fort Worth', lat: 32.7767, lng: -96.7970, radius: 50 },
        { name: 'Austin', lat: 30.2672, lng: -97.7431, radius: 30 },
        { name: 'Houston', lat: 29.7604, lng: -95.3698, radius: 40 },
        { name: 'San Antonio', lat: 29.4241, lng: -98.4936, radius: 35 }
    ],
    
    // API Libraries to load
    LIBRARIES: ['drawing', 'places', 'geometry'],
    
    // Autocomplete options
    AUTOCOMPLETE_OPTIONS: {
        types: ['geocode'],
        componentRestrictions: { country: 'us' }
    }
};

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MAPS_CONFIG;
}

// For browser environments
if (typeof window !== 'undefined') {
    window.MAPS_CONFIG = MAPS_CONFIG;
}