/**
 * Sample Shipping Data for India-based E-commerce
 * 
 * This file contains sample data for:
 * - Shipping Zones
 * - Shipping Rates (weight slabs)
 * - Pincode-Zone Mappings
 * - Shipping Configuration
 * 
 * Use this as a reference for setting up your shipping cost system
 */

// Sample Shipping Zones
export const sampleZones = [
  {
    name: "Local",
    description: "Same city/local area deliveries"
  },
  {
    name: "Zonal",
    description: "Within the same zone/region"
  },
  {
    name: "Metro",
    description: "Metro cities: Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad, Pune"
  },
  {
    name: "Rest of India",
    description: "All other locations in India"
  },
  {
    name: "Remote/North East/J&K",
    description: "Remote areas, North East states, Jammu & Kashmir"
  }
]

// Sample Shipping Rates (weight-based)
export const sampleRates = [
  // Local Zone Rates
  {
    zone: "Local",
    minWeight: 0,
    maxWeight: 500,
    rate: 50,
    additionalWeight: 500,
    additionalRate: 20
  },
  {
    zone: "Local",
    minWeight: 500,
    maxWeight: 1000,
    rate: 70,
    additionalWeight: 500,
    additionalRate: 20
  },
  
  // Zonal Zone Rates
  {
    zone: "Zonal",
    minWeight: 0,
    maxWeight: 500,
    rate: 80,
    additionalWeight: 500,
    additionalRate: 30
  },
  {
    zone: "Zonal",
    minWeight: 500,
    maxWeight: 1000,
    rate: 110,
    additionalWeight: 500,
    additionalRate: 30
  },
  
  // Metro Zone Rates
  {
    zone: "Metro",
    minWeight: 0,
    maxWeight: 500,
    rate: 100,
    additionalWeight: 500,
    additionalRate: 40
  },
  {
    zone: "Metro",
    minWeight: 500,
    maxWeight: 1000,
    rate: 140,
    additionalWeight: 500,
    additionalRate: 40
  },
  
  // Rest of India Rates
  {
    zone: "Rest of India",
    minWeight: 0,
    maxWeight: 500,
    rate: 120,
    additionalWeight: 500,
    additionalRate: 50
  },
  {
    zone: "Rest of India",
    minWeight: 500,
    maxWeight: 1000,
    rate: 170,
    additionalWeight: 500,
    additionalRate: 50
  },
  
  // Remote/North East/J&K Rates
  {
    zone: "Remote/North East/J&K",
    minWeight: 0,
    maxWeight: 500,
    rate: 200,
    additionalWeight: 500,
    additionalRate: 80
  },
  {
    zone: "Remote/North East/J&K",
    minWeight: 500,
    maxWeight: 1000,
    rate: 280,
    additionalWeight: 500,
    additionalRate: 80
  }
]

// Sample Pincode-Zone Mappings
// Note: These are examples. You'll need to map all Indian pincodes to zones
export const samplePincodeMappings = [
  // Mumbai (Metro)
  { pincode: "400001", zone: "Metro", state: "Maharashtra", city: "Mumbai" },
  { pincode: "400002", zone: "Metro", state: "Maharashtra", city: "Mumbai" },
  { pincode: "400003", zone: "Metro", state: "Maharashtra", city: "Mumbai" },
  
  // Delhi (Metro)
  { pincode: "110001", zone: "Metro", state: "Delhi", city: "New Delhi" },
  { pincode: "110002", zone: "Metro", state: "Delhi", city: "New Delhi" },
  
  // Bangalore (Metro)
  { pincode: "560001", zone: "Metro", state: "Karnataka", city: "Bangalore" },
  { pincode: "560002", zone: "Metro", state: "Karnataka", city: "Bangalore" },
  
  // Chennai (Metro)
  { pincode: "600001", zone: "Metro", state: "Tamil Nadu", city: "Chennai" },
  { pincode: "600002", zone: "Metro", state: "Tamil Nadu", city: "Chennai" },
  
  // Kolkata (Metro)
  { pincode: "700001", zone: "Metro", state: "West Bengal", city: "Kolkata" },
  
  // Hyderabad (Metro)
  { pincode: "500001", zone: "Metro", state: "Telangana", city: "Hyderabad" },
  
  // Pune (Metro)
  { pincode: "411001", zone: "Metro", state: "Maharashtra", city: "Pune" },
  
  // Sample Rest of India
  { pincode: "302001", zone: "Rest of India", state: "Rajasthan", city: "Jaipur" },
  { pincode: "380001", zone: "Rest of India", state: "Gujarat", city: "Ahmedabad" },
  
  // Sample Remote/North East/J&K
  { pincode: "790001", zone: "Remote/North East/J&K", state: "Arunachal Pradesh", city: "Itanagar" },
  { pincode: "190001", zone: "Remote/North East/J&K", state: "Jammu and Kashmir", city: "Srinagar" }
]

// Sample Shipping Configuration
export const sampleConfig = {
  codSurcharge: 30,
  codSurchargeType: "fixed",
  freeShippingThreshold: 999
}

/**
 * Example Usage:
 * 
 * 1. Calculate shipping for a 750g package to Mumbai (400001) with COD:
 *    POST /api/shipping-cost/calculate
 *    {
 *      "pincode": "400001",
 *      "weight": 750,
 *      "paymentMode": "cod",
 *      "orderValue": 500
 *    }
 * 
 * 2. Calculate shipping for a 1200g package to Delhi (110001) with Prepaid:
 *    POST /api/shipping-cost/calculate
 *    {
 *      "pincode": "110001",
 *      "weight": 1200,
 *      "paymentMode": "prepaid",
 *      "orderValue": 1500
 *    }
 * 
 * 3. Get zone for a pincode:
 *    GET /api/shipping-cost/zone/400001
 * 
 * Expected Response Format:
 * {
 *   "success": true,
 *   "shippingCost": 150,
 *   "baseCost": 120,
 *   "codSurcharge": 30,
 *   "totalCost": 150,
 *   "zone": "Metro",
 *   "weight": 750,
 *   "paymentMode": "cod",
 *   "isFreeShipping": false,
 *   "freeShippingThreshold": 999,
 *   "rateDetails": {
 *     "minWeight": 500,
 *     "maxWeight": 1000,
 *     "rate": 140,
 *     "additionalWeight": 500,
 *     "additionalRate": 40
 *   }
 * }
 */
