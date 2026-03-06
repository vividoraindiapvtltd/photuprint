# Shipping Cost Manager System - Documentation

## Overview

A comprehensive shipping cost management system for India-based e-commerce that calculates shipping costs based on zones, weight slabs, payment mode (Prepaid/COD), and order value.

## Features

- **Zone-based Shipping**: 5 predefined zones (Local, Zonal, Metro, Rest of India, Remote/North East/J&K)
- **Weight-based Rates**: Configurable weight slabs with base rates and additional charges
- **COD Surcharge**: Fixed or percentage-based COD charges
- **Free Shipping**: Configurable minimum order value threshold
- **Pincode Mapping**: Map Indian pincodes to shipping zones
- **Multi-tenant Support**: Fully integrated with website/tenant system

## Database Models

### 1. ShippingZone
Stores shipping zones.

**Fields:**
- `name` (enum): "Local", "Zonal", "Metro", "Rest of India", "Remote/North East/J&K"
- `description` (String): Zone description
- `isActive` (Boolean): Active status
- `website` (ObjectId): Multi-tenant reference

### 2. ShippingRate
Stores weight-based rates for each zone.

**Fields:**
- `zone` (ObjectId): Reference to ShippingZone
- `minWeight` (Number): Minimum weight in grams
- `maxWeight` (Number): Maximum weight in grams
- `rate` (Number): Base shipping rate in ₹
- `additionalWeight` (Number): Weight increment for additional charges (default: 500g)
- `additionalRate` (Number): Charge per additional weight slab
- `website` (ObjectId): Multi-tenant reference

### 3. ShippingConfig
Stores global shipping configuration.

**Fields:**
- `codSurcharge` (Number): COD surcharge amount
- `codSurchargeType` (enum): "fixed" or "percentage"
- `freeShippingThreshold` (Number): Minimum order value for free shipping
- `website` (ObjectId): Multi-tenant reference (unique)

### 4. PincodeZoneMapping
Maps Indian pincodes to shipping zones.

**Fields:**
- `pincode` (String): 6-digit Indian pincode
- `zone` (ObjectId): Reference to ShippingZone
- `state` (String): State name
- `city` (String): City name
- `website` (ObjectId): Multi-tenant reference

## API Endpoints

### Shipping Zones
- `GET /api/shipping-zones` - Get all zones
- `GET /api/shipping-zones/:id` - Get zone by ID
- `POST /api/shipping-zones` - Create zone (Admin only)
- `PUT /api/shipping-zones/:id` - Update zone (Admin only)
- `DELETE /api/shipping-zones/:id` - Delete zone (Admin only)

### Shipping Rates
- `GET /api/shipping-rates` - Get all rates (optional: `?zoneId=xxx`)
- `GET /api/shipping-rates/:id` - Get rate by ID
- `POST /api/shipping-rates` - Create rate (Admin only)
- `PUT /api/shipping-rates/:id` - Update rate (Admin only)
- `DELETE /api/shipping-rates/:id` - Delete rate (Admin only)

### Shipping Configuration
- `GET /api/shipping-config` - Get configuration
- `PUT /api/shipping-config` - Update configuration (Admin only)

### Pincode-Zone Mappings
- `GET /api/pincode-zone-mappings` - Get all mappings (optional: `?zoneId=xxx&pincode=xxx&state=xxx&city=xxx`)
- `GET /api/pincode-zone-mappings/pincode/:pincode` - Get zone for pincode
- `GET /api/pincode-zone-mappings/:id` - Get mapping by ID
- `POST /api/pincode-zone-mappings` - Create mapping (Admin only)
- `POST /api/pincode-zone-mappings/bulk` - Bulk create mappings (Admin only)
- `PUT /api/pincode-zone-mappings/:id` - Update mapping (Admin only)
- `DELETE /api/pincode-zone-mappings/:id` - Delete mapping (Admin only)

### Shipping Cost Calculation
- `POST /api/shipping-cost/calculate` - Calculate shipping cost
- `GET /api/shipping-cost/zone/:pincode` - Get zone for pincode

## Usage Examples

### 1. Calculate Shipping Cost

**Request:**
```http
POST /api/shipping-cost/calculate
Content-Type: application/json
X-Website-Id: <website-id>

{
  "pincode": "400001",
  "weight": 750,
  "paymentMode": "cod",
  "orderValue": 500
}
```

**Response:**
```json
{
  "success": true,
  "shippingCost": 150,
  "baseCost": 120,
  "codSurcharge": 30,
  "totalCost": 150,
  "zone": "Metro",
  "zoneId": "...",
  "weight": 750,
  "paymentMode": "cod",
  "isFreeShipping": false,
  "freeShippingThreshold": 999,
  "rateDetails": {
    "minWeight": 500,
    "maxWeight": 1000,
    "rate": 140,
    "additionalWeight": 500,
    "additionalRate": 40
  }
}
```

### 2. Get Zone for Pincode

**Request:**
```http
GET /api/shipping-cost/zone/400001
X-Website-Id: <website-id>
```

**Response:**
```json
{
  "success": true,
  "zone": {
    "_id": "...",
    "name": "Metro",
    "description": "Metro cities"
  },
  "pincode": "400001",
  "state": "Maharashtra",
  "city": "Mumbai"
}
```

### 3. Create Shipping Zone

**Request:**
```http
POST /api/shipping-zones
Content-Type: application/json
X-Website-Id: <website-id>
Authorization: Bearer <token>

{
  "name": "Metro",
  "description": "Metro cities: Mumbai, Delhi, Bangalore, etc.",
  "isActive": true
}
```

### 4. Create Shipping Rate

**Request:**
```http
POST /api/shipping-rates
Content-Type: application/json
X-Website-Id: <website-id>
Authorization: Bearer <token>

{
  "zone": "<zone-id>",
  "minWeight": 0,
  "maxWeight": 500,
  "rate": 100,
  "additionalWeight": 500,
  "additionalRate": 40,
  "isActive": true
}
```

### 5. Bulk Create Pincode Mappings

**Request:**
```http
POST /api/pincode-zone-mappings/bulk
Content-Type: application/json
X-Website-Id: <website-id>
Authorization: Bearer <token>

{
  "mappings": [
    {
      "pincode": "400001",
      "zone": "<zone-id>",
      "state": "Maharashtra",
      "city": "Mumbai"
    },
    {
      "pincode": "400002",
      "zone": "<zone-id>",
      "state": "Maharashtra",
      "city": "Mumbai"
    }
  ]
}
```

## Calculation Logic

### Step 1: Check Free Shipping
If `orderValue >= freeShippingThreshold`, return ₹0 shipping cost.

### Step 2: Find Zone
Look up pincode in `PincodeZoneMapping` to get the shipping zone.

### Step 3: Find Rate
Find the applicable rate where `minWeight <= weight <= maxWeight`.

### Step 4: Calculate Base Cost
- Start with base `rate` for the weight slab
- If weight exceeds `maxWeight`, calculate additional charges:
  ```
  additionalWeight = weight - maxWeight
  additionalSlabs = ceil(additionalWeight / additionalWeight)
  additionalCost = additionalSlabs × additionalRate
  baseCost = rate + additionalCost
  ```

### Step 5: Calculate COD Surcharge
If payment mode is COD:
- If `codSurchargeType === "percentage"`: `codSurcharge = (baseCost × codSurcharge) / 100`
- If `codSurchargeType === "fixed"`: `codSurcharge = codSurcharge`

### Step 6: Calculate Total
```
totalCost = baseCost + codSurcharge
```

## Frontend Component

Access the Shipping Cost Manager at: `/dashboard/shipping-cost-manager`

The component includes 4 tabs:
1. **Shipping Zones**: Manage zones
2. **Shipping Rates**: Configure weight-based rates per zone
3. **Configuration**: Set COD surcharge and free shipping threshold
4. **Pincode Mappings**: Map pincodes to zones

## Setup Instructions

1. **Create Zones**: Use the frontend or API to create all 5 zones
2. **Configure Rates**: Set up weight slabs and rates for each zone
3. **Map Pincodes**: Bulk upload pincode-zone mappings (you can use CSV import)
4. **Set Configuration**: Configure COD surcharge and free shipping threshold

## Sample Data

See `backend/data/sampleShippingData.js` for sample zone, rate, and pincode mapping data.

## Notes

- Weight is in **grams**
- All costs are in **Indian Rupees (₹)**
- Pincodes must be exactly **6 digits**
- Weight ranges should not overlap for the same zone
- Free shipping threshold of 0 disables free shipping
- COD surcharge of 0 means no extra charge for COD orders
