# JunkYard Profit API

A Node.js/Express API for calculating junkyard part profits with market value lookup, shipping quotes, and ROI calculations.

## Features

- 🔐 API key authentication
- 📊 Market value estimation with Google Shopping API
- 🚚 Real shipping quotes with Shippo API
- 💰 ROI calculation with fees and margins
- 📈 Google Trends demand analysis
- 🚗 NHTSA vehicle specifications
- 🔧 CarQuery detailed vehicle information
- 🎯 Complete analysis combining all data sources
- 🚀 Ready for Railway deployment

## API Endpoints

### Health Check
```
GET /health
```

### Market Value
```
GET /market/value?part=instrument+cluster&make=Toyota&model=4Runner&year=1996
```

### Shipping Quote
```
GET /shipping/quote?from_zip=92101&to_zip=10001&weight_lb=6&dims_in=14x10x6
```

### ROI Calculation
```
POST /roi
Content-Type: application/json

{
  "buy_cost": 50,
  "sale_price": 150,
  "fees_pct": 0.13,
  "ship_cost": 15,
  "misc": 0
}
```

### Google Trends - Demand Analysis
```
GET /trends/demand?part=alternator&make=Honda&model=Civic&year=2005
```

### NHTSA Vehicle Specifications
```
GET /vehicle/specs?make=Toyota&model=4Runner&year=1996
```

### CarQuery Vehicle Details
```
GET /vehicle/details?make=Toyota&model=4Runner&year=1996
```

### Complete Analysis (All Data Combined)
```
GET /analysis/complete?part=alternator&make=Honda&model=Civic&year=2005
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
export SERVICE_API_KEY=dev-local-secret
```

3. Start the server:
```bash
npm start
```

4. Test the API:
```bash
curl -H "X-API-Key: dev-local-secret" http://localhost:3000/health
```

## Railway Deployment

1. Push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create junkyard-api --public --source=. --remote=origin --push
```

2. Deploy on Railway:
   - Go to [Railway](https://railway.app)
   - New Project → Deploy from GitHub repo
   - Select your `junkyard-api` repository
   - Add environment variable: `SERVICE_API_KEY` = your-secret-key

3. Test your deployed API:
```bash
curl -H "X-API-Key: your-secret-key" https://your-app.up.railway.app/health
```

## Custom GPT Integration

Use this OpenAPI schema in your Custom GPT Actions:

```yaml
openapi: 3.1.0
info: { title: JunkYard Profit API, version: 1.0.0 }
servers:
  - url: https://your-app.up.railway.app
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
  schemas:
    PriceComp:
      type: object
      properties:
        title: { type: string }
        price: { type: number }
        url: { type: string }
        condition: { type: string }
    PriceStats:
      type: object
      properties:
        avg: { type: number }
        p50: { type: number }
        p90: { type: number }
        comps:
          type: array
          items: { $ref: '#/components/schemas/PriceComp' }
    ShipQuote:
      type: object
      properties:
        service: { type: string }
        est_cost: { type: number }
        eta_days: { type: integer }
    ROIResult:
      type: object
      properties:
        sale_price: { type: number }
        total_fees: { type: number }
        ship_cost: { type: number }
        net_profit: { type: number }
        margin_pct: { type: number }
paths:
  /market/value:
    get:
      summary: Get resale price stats and comps for a part
      security: [{ ApiKeyAuth: [] }]
      parameters:
        - in: query; name: part; required: true; schema: { type: string }
        - in: query; name: oem; schema: { type: string }
        - in: query; name: make; schema: { type: string }
        - in: query; name: model; schema: { type: string }
        - in: query; name: year; schema: { type: string }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PriceStats' }
  /shipping/quote:
    get:
      summary: Get shipping quotes
      security: [{ ApiKeyAuth: [] }]
      parameters:
        - in: query; name: from_zip; required: true; schema: { type: string }
        - in: query; name: to_zip; required: true; schema: { type: string }
        - in: query; name: weight_lb; required: true; schema: { type: number }
        - in: query; name: dims_in; schema: { type: string, description: "LxWxH inches" }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ShipQuote' }
  /roi:
    post:
      summary: Compute ROI given costs and fees
      security: [{ ApiKeyAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                buy_cost: { type: number }
                sale_price: { type: number }
                fees_pct: { type: number, description: "Marketplace+payment %" }
                ship_cost: { type: number }
                misc: { type: number, default: 0 }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ROIResult' }
```

## Next Steps

- [ ] Integrate real eBay Browse API for market prices
- [ ] Add real shipping APIs (Shippo/EasyPost)
- [ ] Implement image search for part identification
- [ ] Add caching for frequently requested parts
- [ ] Set up monitoring and logging
