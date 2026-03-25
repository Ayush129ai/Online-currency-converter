import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { pathToFileURL } from 'url';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';
import { logger } from './logger.js';
import { evaluateAlertTransition, getPairMidMarketRate } from './alertEngine.js';

dotenv.config({ quiet: true });

const PORT = process.env.PORT || 3000;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const SENTRY_DSN = process.env.SENTRY_DSN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_AUTH_REQUIRED = process.env.JWT_AUTH_REQUIRED === 'true';
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'password123';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const RATES_CACHE_KEY = 'exchange-rates:latest:usd';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false' && process.env.NODE_ENV !== 'test';
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || '';
const ALERT_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LOCAL_FALLBACK_RATES = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.78,
    INR: 83.2,
    JPY: 150.4,
    AUD: 1.52,
    CAD: 1.35,
    CHF: 0.89,
    CNY: 7.2,
    SGD: 1.34,
    AED: 3.67,
    NZD: 1.64,
    SEK: 10.4,
    NOK: 10.7,
    DKK: 6.86,
    ZAR: 18.1,
    BRL: 4.95,
    MXN: 16.9,
    HKD: 7.82,
    KRW: 1335
};

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)
    });
}

function reportError(error, contextMessage, metadata = {}) {
    logger.error({ message: contextMessage, error: error.message, stack: error.stack, ...metadata });
    if (SENTRY_DSN) {
        Sentry.captureException(error);
    }
}

function buildFallbackRatesPayload() {
    return {
        base: 'USD',
        date: new Date().toISOString(),
        rates: LOCAL_FALLBACK_RATES
    };
}

const convertQuerySchema = Joi.object({
    amount: Joi.number().positive().required(),
    from: Joi.string().trim().length(3).uppercase().required(),
    to: Joi.string().trim().length(3).uppercase().required()
});

const historyQuerySchema = Joi.object({
    from: Joi.string().trim().length(3).uppercase().required(),
    to: Joi.string().trim().length(3).uppercase().required(),
    days: Joi.number().integer().min(2).max(365).default(7)
});

const loginSchema = Joi.object({
    username: Joi.string().trim().min(3).required(),
    password: Joi.string().min(6).required()
});

const alertCreateSchema = Joi.object({
    userId: Joi.string().trim().min(1).required(),
    from: Joi.string().trim().length(3).uppercase().required(),
    to: Joi.string().trim().length(3).uppercase().required(),
    targetRate: Joi.number().positive().required(),
    direction: Joi.string().valid('above', 'below').required(),
    fcmToken: Joi.string().trim().min(16).allow('').optional(),
    cooldownMinutes: Joi.number().integer().min(1).max(1440).default(30)
});

const alertListSchema = Joi.object({
    userId: Joi.string().trim().min(1).optional()
});

const alertDeleteSchema = Joi.object({
    userId: Joi.string().trim().min(1).optional()
});

const alertStore = new Map();
let alertSchedulerHandle = null;

const redisClient = REDIS_ENABLED ? createClient({ url: REDIS_URL }) : null;
let redisReady = false;

if (redisClient) {
    redisClient.on('ready', () => {
        redisReady = true;
        logger.info({ redisUrl: REDIS_URL }, 'Connected to Redis');
    });

    redisClient.on('error', (error) => {
        redisReady = false;
        reportError(error, 'Redis connection error');
    });

    redisClient.connect().catch((error) => {
        redisReady = false;
        reportError(error, 'Failed to initialize Redis client');
    });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ error: 'Missing authentication token' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function maybeAuthenticate(req, res, next) {
    if (!JWT_AUTH_REQUIRED) {
        return next();
    }
    return authenticateToken(req, res, next);
}

function validateRequest(schema, source = 'query') {
    return (req, res, next) => {
        const { value, error } = schema.validate(req[source], { abortEarly: false });
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }

        req[source] = value;
        next();
    };
}

function getPreviousUtcDate(offsetDays) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offsetDays);
    return date;
}

function formatDateForHistoryPath(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return { year, month, day, isoDate: `${year}-${month}-${day}` };
}

function buildFallbackHistorySeries(from, to, days, rates = LOCAL_FALLBACK_RATES) {
    if (!rates[from] || !rates[to]) {
        throw new Error('Invalid currency pair for historical fallback');
    }

    const baseRate = rates[to] / rates[from];
    const safeDays = Math.max(2, Number(days) || 7);
    const series = [];

    for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
        const historyDate = getPreviousUtcDate(offset);
        const formattedDate = formatDateForHistoryPath(historyDate);

        // Add a small deterministic variation so the chart remains readable.
        const step = safeDays - 1 - offset;
        const variation = (Math.sin(step / 3) * 0.0035) + (Math.cos(step / 5) * 0.0015);
        const rate = baseRate * (1 + variation);

        series.push({ date: formattedDate.isoDate, rate: Number(rate.toFixed(6)) });
    }

    return series;
}

async function sendFcmNotification(alert, currentRate) {
    if (!alert.fcmToken) {
        logger.warn({ alertId: alert.id }, 'Skipping FCM send because alert has no token');
        return;
    }

    if (!FCM_SERVER_KEY) {
        logger.warn({ alertId: alert.id }, 'Skipping FCM send because FCM_SERVER_KEY is missing');
        return;
    }

    const payload = {
        to: alert.fcmToken,
        notification: {
            title: 'Currency Alert Triggered',
            body: `${alert.from}/${alert.to} is ${currentRate.toFixed(6)} and moved ${alert.direction} ${alert.targetRate.toFixed(6)}`
        },
        data: {
            alertId: alert.id,
            from: alert.from,
            to: alert.to,
            direction: alert.direction,
            targetRate: String(alert.targetRate),
            currentRate: String(currentRate)
        }
    };

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${FCM_SERVER_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FCM send failed: ${response.status} ${errorText}`);
    }
}

export function createApp() {
    const app = express();
    const apiBaseUrl = process.env.API_BASE_URL || '';
    const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY;

    // Middleware
    app.use(cors());
    app.use(express.json());

    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests from this IP. Please try again later.' }
    });

    app.use('/api', apiLimiter);

    app.post('/api/auth/login', validateRequest(loginSchema, 'body'), (req, res) => {
        const { username, password } = req.body;

        if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { username, role: 'user' },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({ token, expiresIn: JWT_EXPIRES_IN });
    });

    app.get('/api/auth/verify', authenticateToken, (req, res) => {
        res.json({ valid: true, user: req.user });
    });

    app.get('/app-config.js', (req, res) => {
        res.type('application/javascript');
        res.send(`window.__APP_CONFIG__ = ${JSON.stringify({ API_BASE_URL: apiBaseUrl })};`);
    });

    app.use(express.static('.')); // Serve static files from current directory

    // Function to fetch rates from external API
    async function fetchRates() {
        if (redisClient && redisReady) {
            const cachedValue = await redisClient.get(RATES_CACHE_KEY);
            if (cachedValue) {
                return JSON.parse(cachedValue);
            }
        }

        try {
            if (!exchangeRateApiKey) {
                logger.warn('EXCHANGE_RATE_API_KEY missing, serving local fallback rates');
                return buildFallbackRatesPayload();
            }

            const response = await fetch(`https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/USD`);
            if (!response.ok) {
                throw new Error('Failed to fetch from external API');
            }
            const data = await response.json();
            if (data.result && data.result !== 'success') {
                throw new Error(data['error-type'] || 'External API returned an error');
            }

            const normalizedData = {
                base: data.base_code || data.base || 'USD',
                date: data.time_last_update_utc || data.date || new Date().toISOString(),
                rates: data.conversion_rates || data.rates
            };

            if (!normalizedData.rates) {
                throw new Error('External API did not return currency rates');
            }

            if (redisClient && redisReady) {
                await redisClient.set(RATES_CACHE_KEY, JSON.stringify(normalizedData), {
                    EX: Math.floor(CACHE_DURATION / 1000)
                });
            }

            logger.info({ updatedAt: new Date().toISOString() }, 'Exchange rates cache updated in Redis');
            return normalizedData;
        } catch (error) {
            reportError(error, 'Failed to fetch exchange rates from external API');
            if (redisClient && redisReady) {
                const staleValue = await redisClient.get(RATES_CACHE_KEY);
                if (staleValue) {
                    logger.warn({ cacheKey: RATES_CACHE_KEY }, 'Returning cached rates after upstream failure');
                    return JSON.parse(staleValue);
                }
            }

            logger.warn('Falling back to local rates because upstream data is unavailable');
            return buildFallbackRatesPayload();
        }
    }

    // API endpoint to get rates
    app.get('/api/rates', async (req, res) => {
        try {
            const data = await fetchRates();
            res.json(data);
        } catch (error) {
            reportError(error, 'Request failed: /api/rates');
            res.status(500).json({ error: 'Failed to fetch exchange rates' });
        }
    });

    // API endpoint for conversion
    app.get('/api/convert', maybeAuthenticate, validateRequest(convertQuerySchema), async (req, res) => {
        try {
            const { amount, from, to } = req.query;

            const data = await fetchRates();
            const rates = data.rates;

            if (!rates[from] || !rates[to]) {
                return res.status(400).json({ error: 'Invalid currency code' });
            }

            const converted = amount * (rates[to] / rates[from]);
            res.json({
                amount,
                from,
                to,
                result: converted,
                rate: rates[to] / rates[from],
                timestamp: data.date || new Date().toISOString()
            });
        } catch (error) {
            reportError(error, 'Request failed: /api/convert');
            res.status(500).json({ error: 'Conversion failed' });
        }
    });

    app.get('/api/history', maybeAuthenticate, validateRequest(historyQuerySchema), async (req, res) => {
        try {
            const { from, to, days } = req.query;

            if (!exchangeRateApiKey) {
                logger.warn('EXCHANGE_RATE_API_KEY missing, serving fallback historical rates');
                const series = buildFallbackHistorySeries(from, to, days);
                res.json({ from, to, days, series, source: 'fallback' });
                return;
            }

            const series = [];
            for (let offset = days - 1; offset >= 0; offset -= 1) {
                const historyDate = getPreviousUtcDate(offset);
                const formattedDate = formatDateForHistoryPath(historyDate);
                const endpoint = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/history/${from}/${formattedDate.year}/${formattedDate.month}/${formattedDate.day}`;

                const response = await fetch(endpoint);
                if (!response.ok) {
                    throw new Error(`Failed to fetch history for ${formattedDate.isoDate}`);
                }

                const historyData = await response.json();
                if (historyData.result && historyData.result !== 'success') {
                    throw new Error(historyData['error-type'] || `History API error for ${formattedDate.isoDate}`);
                }

                const historyRates = historyData.conversion_rates || historyData.rates;
                if (!historyRates || !historyRates[to]) {
                    throw new Error(`Missing rate for ${to} on ${formattedDate.isoDate}`);
                }

                series.push({ date: formattedDate.isoDate, rate: historyRates[to] });
            }

            res.json({ from, to, days, series });
        } catch (error) {
            reportError(error, 'Request failed: /api/history');

            try {
                const { from, to, days } = req.query;
                const liveRatesPayload = await fetchRates();
                const series = buildFallbackHistorySeries(from, to, days, liveRatesPayload.rates || LOCAL_FALLBACK_RATES);
                logger.warn('Serving fallback historical series after upstream history failure');
                res.json({ from, to, days, series, source: 'fallback' });
                return;
            } catch (fallbackError) {
                reportError(fallbackError, 'Fallback historical series generation failed');
                res.status(500).json({ error: 'Failed to fetch historical rates' });
            }
        }
    });

    app.post('/api/alerts', maybeAuthenticate, validateRequest(alertCreateSchema, 'body'), async (req, res) => {
        try {
            const { userId, from, to, targetRate, direction, fcmToken, cooldownMinutes } = req.body;

            if (from === to) {
                return res.status(400).json({ error: 'Currency pair must contain two different currencies' });
            }

            const ratesPayload = await fetchRates();
            if (!ratesPayload.rates[from] || !ratesPayload.rates[to]) {
                return res.status(400).json({ error: 'Invalid currency pair for alert' });
            }

            const nowIso = new Date().toISOString();
            const alert = {
                id: randomUUID(),
                userId,
                from,
                to,
                targetRate,
                direction,
                fcmToken,
                cooldownMinutes,
                inCondition: false,
                lastTriggeredAt: null,
                createdAt: nowIso,
                updatedAt: nowIso
            };

            alertStore.set(alert.id, alert);
            res.status(201).json(alert);
        } catch (error) {
            reportError(error, 'Request failed: /api/alerts POST');
            res.status(500).json({ error: 'Failed to create alert' });
        }
    });

    app.get('/api/alerts', maybeAuthenticate, validateRequest(alertListSchema), (req, res) => {
        const { userId } = req.query;
        const alerts = Array.from(alertStore.values()).filter((alert) => !userId || alert.userId === userId);
        res.json({ count: alerts.length, alerts });
    });

    app.delete('/api/alerts/:id', maybeAuthenticate, validateRequest(alertDeleteSchema), (req, res) => {
        const { id } = req.params;
        const { userId } = req.query;
        const existing = alertStore.get(id);

        if (!existing) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        if (userId && existing.userId !== userId) {
            return res.status(403).json({ error: 'Alert does not belong to the provided userId' });
        }

        alertStore.delete(id);
        res.json({ deleted: true, id });
    });

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            cache: {
                hasCache: false,
                provider: 'redis',
                connected: redisReady,
                enabled: REDIS_ENABLED,
                key: RATES_CACHE_KEY
            }
        });
    });

    app.use((error, req, res, next) => {
        reportError(error, 'Unhandled express error');
        if (res.headersSent) {
            return next(error);
        }
        res.status(500).json({ error: 'Internal server error' });
    });

    async function checkAlertsNow() {
        if (alertStore.size === 0) {
            return;
        }

        const nowMs = Date.now();
        const ratesPayload = await fetchRates();
        const rates = ratesPayload.rates;

        const alerts = Array.from(alertStore.values());
        for (const alert of alerts) {
            try {
                const currentRate = getPairMidMarketRate(rates, alert.from, alert.to);
                const transition = evaluateAlertTransition(alert, currentRate, nowMs);

                if (transition.shouldNotify) {
                    await sendFcmNotification(alert, currentRate);
                }

                alert.inCondition = transition.nextState.inCondition;
                alert.lastTriggeredAt = transition.nextState.lastTriggeredAt;
                alert.updatedAt = new Date(nowMs).toISOString();
                alertStore.set(alert.id, alert);
            } catch (error) {
                reportError(error, 'Currency alert check failed', { alertId: alert.id });
            }
        }
    }

    if (process.env.NODE_ENV !== 'test' && !alertSchedulerHandle) {
        alertSchedulerHandle = setInterval(() => {
            checkAlertsNow().catch((error) => {
                reportError(error, 'Periodic alert scheduler failed');
            });
        }, ALERT_CHECK_INTERVAL_MS);
    }

    app.locals.checkAlertsNow = checkAlertsNow;

    return app;
}

export const app = createApp();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Server running');
    });
}