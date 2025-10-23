// server.js
import express from "express";
import cors from "cors";
import shippo from "shippo";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Shippo with API key from environment
const SHIPPO_TOKEN = process.env.SHIPPO_TOKEN;
if (SHIPPO_TOKEN) {
  shippo.config.accessToken = SHIPPO_TOKEN;
}

// Simple API-key gate so only your GPT can call this
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;
app.use((req, res, next) => {
  const key = req.header("X-API-Key");
  if (!SERVICE_API_KEY || key !== SERVICE_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));

// 1) Market value — mock now
app.get("/market/value", async (req, res) => {
  const { part, oem, make, model, year } = req.query;
  // TODO: later call eBay Browse API here
  res.json({
    avg: 145.0,
    p50: 139.99,
    p90: 199.99,
    comps: [
      { title: `${year || ""} ${make || ""} ${model || ""} ${part} OEM ${oem || ""}`.trim(),
        price: 149.99, url: "https://example.com/comp1", condition: "used" },
      { title: `${part} good condition`, price: 199.99, url: "https://example.com/comp2", condition: "used" },
    ],
  });
});

// 2) Shipping quote — real Shippo API
app.get("/shipping/quote", async (req, res) => {
  const { from_zip, to_zip, weight_lb, dims_in } = req.query;
  
  // If no Shippo token, return mock data
  if (!SHIPPO_TOKEN) {
    return res.json([
      { service: "USPS Priority (mock)", est_cost: 13.50, eta_days: 2 },
      { service: "UPS Ground (mock)", est_cost: 11.75, eta_days: 3 },
    ]);
  }

  try {
    // Parse dimensions (format: "LxWxH")
    let length = 10, width = 8, height = 6; // defaults
    if (dims_in) {
      const [l, w, h] = dims_in.split('x').map(Number);
      if (l && w && h) {
        length = l; width = w; height = h;
      }
    }

    // Create shipment request for Shippo
    const shipment = {
      address_from: {
        zip: from_zip,
        country: "US"
      },
      address_to: {
        zip: to_zip,
        country: "US"
      },
      parcels: [{
        length: length.toString(),
        width: width.toString(),
        height: height.toString(),
        distance_unit: "in",
        weight: weight_lb.toString(),
        mass_unit: "lb"
      }]
    };

    // Get rates from Shippo
    const rates = await shippo.shipment.create(shipment);
    
    // Format response to match our API
    const formattedRates = rates.rates.slice(0, 3).map(rate => ({
      service: `${rate.provider} ${rate.servicelevel.name}`,
      est_cost: parseFloat(rate.amount),
      eta_days: rate.estimated_days || 3
    }));

    res.json(formattedRates);

  } catch (error) {
    console.error('Shippo API error:', error);
    // Fallback to mock data on error
    res.json([
      { service: "USPS Priority (fallback)", est_cost: 13.50, eta_days: 2 },
      { service: "UPS Ground (fallback)", est_cost: 11.75, eta_days: 3 },
    ]);
  }
});

// 3) ROI calculator
app.post("/roi", (req, res) => {
  const { buy_cost = 0, sale_price = 0, fees_pct = 0.13, ship_cost = 0, misc = 0 } = req.body || {};
  const total_fees = sale_price * fees_pct;
  const net_profit = sale_price - total_fees - ship_cost - buy_cost - misc;
  const margin_pct = sale_price ? (net_profit / sale_price) * 100 : 0;
  res.json({ sale_price, total_fees, ship_cost, net_profit, margin_pct });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
