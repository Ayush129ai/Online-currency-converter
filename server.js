import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Cache for rates
let ratesCache = null;
let lastFetch = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Function to fetch rates from external API
async function fetchRates() {
    const now = Date.now();
    if (ratesCache && lastFetch && (now - lastFetch) < CACHE_DURATION) {
        return ratesCache;
    }

    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!response.ok) {
            throw new Error('Failed to fetch from external API');
        }
        const data = await response.json();
        ratesCache = data;
        lastFetch = now;
        console.log('Rates updated at', new Date().toISOString());
        return data;
    } catch (error) {
        console.error('Error fetching rates:', error);
        if (ratesCache) {
            console.log('Returning cached rates');
            return ratesCache;
        }
        throw error;
    }
}

// API endpoint to get rates
app.get('/api/rates', async (req, res) => {
    try {
        const data = await fetchRates();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch exchange rates' });
    }
});

// API endpoint for conversion
app.get('/api/convert', async (req, res) => {
    try {
        const { amount, from, to } = req.query;
        if (!amount || !from || !to) {
            return res.status(400).json({ error: 'Missing required parameters: amount, from, to' });
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const data = await fetchRates();
        const rates = data.rates;

        if (!rates[from] || !rates[to]) {
            return res.status(400).json({ error: 'Invalid currency code' });
        }

        const converted = numAmount * (rates[to] / rates[from]);
        res.json({
            amount: numAmount,
            from,
            to,
            result: converted,
            rate: rates[to] / rates[from],
            timestamp: data.date || new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Conversion failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        cache: {
            lastFetch: lastFetch ? new Date(lastFetch).toISOString() : null,
            hasCache: !!ratesCache
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});