// server.js
import express from "express";
import cors from "cors";
import shippo from "shippo";
import { google } from "googleapis";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Shippo with API key from environment
const SHIPPO_TOKEN = process.env.SHIPPO_TOKEN;
if (SHIPPO_TOKEN) {
  shippo.config.accessToken = SHIPPO_TOKEN;
}

// Initialize Google Shopping API
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
let shopping = null;
if (GOOGLE_API_KEY) {
  shopping = google.shopping({ version: 'v1', auth: GOOGLE_API_KEY });
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

// 1) Market value — Google Shopping API + fallback
app.get("/market/value", async (req, res) => {
  const { part, oem, make, model, year } = req.query;
  
  // Build search query
  const searchQuery = `${year || ""} ${make || ""} ${model || ""} ${part} ${oem || ""}`.trim();
  
  // If no Google API key, return mock data
  if (!GOOGLE_API_KEY || !shopping) {
    return res.json({
      avg: 145.0,
      p50: 139.99,
      p90: 199.99,
      source: "mock",
      comps: [
        { title: `${year || ""} ${make || ""} ${model || ""} ${part} OEM ${oem || ""}`.trim(),
          price: 149.99, url: "https://example.com/comp1", condition: "used", platform: "mock" },
        { title: `${part} good condition`, price: 199.99, url: "https://example.com/comp2", condition: "used", platform: "mock" },
      ],
    });
  }

  try {
    // Use Google Shopping API to search for products
    const response = await shopping.products.list({
      q: searchQuery,
      maxResults: 10,
      country: 'US'
    });

    const products = response.data.items || [];
    
    if (products.length === 0) {
      // Fallback to mock data if no results
      return res.json({
        avg: 145.0,
        p50: 139.99,
        p90: 199.99,
        source: "google_shopping_no_results",
        comps: [
          { title: `${year || ""} ${make || ""} ${model || ""} ${part} OEM ${oem || ""}`.trim(),
            price: 149.99, url: "https://example.com/comp1", condition: "used", platform: "fallback" },
        ],
      });
    }

    // Process Google Shopping results
    const prices = products
      .filter(p => p.price && p.price.value)
      .map(p => parseFloat(p.price.value));
    
    const comps = products.slice(0, 5).map(product => ({
      title: product.title || "Unknown Product",
      price: product.price ? parseFloat(product.price.value) : 0,
      url: product.link || "#",
      condition: "used", // Google Shopping doesn't provide condition
      platform: product.source || "google_shopping"
    }));

    // Calculate statistics
    const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const sortedPrices = prices.sort((a, b) => a - b);
    const p50 = sortedPrices[Math.floor(sortedPrices.length * 0.5)] || 0;
    const p90 = sortedPrices[Math.floor(sortedPrices.length * 0.9)] || 0;

    res.json({
      avg: Math.round(avg * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p90: Math.round(p90 * 100) / 100,
      source: "google_shopping",
      comps: comps.filter(c => c.price > 0)
    });

  } catch (error) {
    console.error('Google Shopping API error:', error);
    // Fallback to mock data on error
    res.json({
      avg: 145.0,
      p50: 139.99,
      p90: 199.99,
      source: "google_shopping_error",
      comps: [
        { title: `${year || ""} ${make || ""} ${model || ""} ${part} OEM ${oem || ""}`.trim(),
          price: 149.99, url: "https://example.com/comp1", condition: "used", platform: "fallback" },
      ],
    });
  }
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
