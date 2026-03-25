// api.js
import {
    API_URL,
    CONVERT_URL,
    HISTORY_URL,
    AUTH_LOGIN_URL,
    AUTH_VERIFY_URL,
    AUTH_TOKEN_KEY
} from './config.js';

let rates = {};
let lastUpdated = null;
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

function getPreviousUtcDate(offsetDays) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offsetDays);
    return date;
}

function formatIsoDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildFallbackHistoricalSeries(from, to, days, sourceRates) {
    if (!sourceRates[from] || !sourceRates[to]) {
        throw new Error('Invalid currency');
    }

    const safeDays = Math.max(2, Number(days) || 7);
    const baseRate = sourceRates[to] / sourceRates[from];
    const series = [];

    for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
        const step = safeDays - 1 - offset;
        const variation = (Math.sin(step / 3) * 0.0035) + (Math.cos(step / 5) * 0.0015);
        const computedRate = baseRate * (1 + variation);
        const date = formatIsoDate(getPreviousUtcDate(offset));

        series.push({
            date,
            rate: Number(computedRate.toFixed(6))
        });
    }

    return series;
}

function getStorage() {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    return localStorage;
}

let authToken = (getStorage() && getStorage().getItem(AUTH_TOKEN_KEY)) || '';

function buildUrlWithQuery(baseUrl, queryParams) {
    const fallbackOrigin = (typeof window !== 'undefined' && window.location)
        ? window.location.origin
        : 'http://localhost';
    const url = new URL(baseUrl, fallbackOrigin);
    Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return url.toString();
}

async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        clearAuthToken();
    }

    return response;
}

export function setAuthToken(token) {
    authToken = token;
    const storage = getStorage();
    if (storage) {
        storage.setItem(AUTH_TOKEN_KEY, token);
    }
}

export function clearAuthToken() {
    authToken = '';
    const storage = getStorage();
    if (storage) {
        storage.removeItem(AUTH_TOKEN_KEY);
    }
}

export function hasAuthToken() {
    return !!authToken;
}

export async function login(username, password) {
    const response = await fetch(AUTH_LOGIN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        throw new Error('Login failed. Check username and password.');
    }

    const data = await response.json();
    setAuthToken(data.token);
    return data;
}

export async function verifyToken() {
    if (!authToken) {
        return false;
    }

    const response = await apiFetch(AUTH_VERIFY_URL);
    return response.ok;
}

export async function fetchRates() {
    try {
        const response = await apiFetch(API_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch rates');
        }
        const data = await response.json();
        rates = data.rates;
        lastUpdated = new Date();
        return rates;
    } catch (error) {
        throw error;
    }
}

export function getRates() {
    return rates;
}

export function getLastUpdated() {
    return lastUpdated;
}

export async function convertCurrency(amount, from, to) {
    try {
        const requestUrl = buildUrlWithQuery(CONVERT_URL, { amount, from, to });
        const response = await apiFetch(requestUrl);
        if (!response.ok) {
            throw new Error('Conversion failed');
        }
        const data = await response.json();
        return data.result;
    } catch (error) {
        // Fallback to local calculation if API fails.
        // First try in-memory rates loaded from /api/rates, then static fallback rates.
        if (!rates[from] || !rates[to]) {
            try {
                await fetchRates();
            } catch (_fetchError) {
                // Ignore fetch error and attempt static fallback rates below.
            }
        }

        const sourceRates = (rates[from] && rates[to]) ? rates : LOCAL_FALLBACK_RATES;
        if (!sourceRates[from] || !sourceRates[to]) {
            throw new Error('Invalid currency');
        }

        return amount * (sourceRates[to] / sourceRates[from]);
    }
}

export async function fetchHistoricalRates(from, to, days = 7) {
    try {
        const requestUrl = buildUrlWithQuery(HISTORY_URL, { from, to, days });
        const response = await apiFetch(requestUrl);

        if (!response.ok) {
            throw new Error('Failed to fetch historical rates');
        }

        return response.json();
    } catch (_error) {
        if (!rates[from] || !rates[to]) {
            try {
                await fetchRates();
            } catch (_fetchError) {
                // Ignore and continue to static fallback.
            }
        }

        const sourceRates = (rates[from] && rates[to]) ? rates : LOCAL_FALLBACK_RATES;
        const safeDays = Math.max(2, Number(days) || 7);
        const series = buildFallbackHistoricalSeries(from, to, safeDays, sourceRates);

        return {
            from,
            to,
            days: safeDays,
            series,
            source: 'fallback-client'
        };
    }
}

export async function createRateAlert(payload) {
    const response = await apiFetch('/api/alerts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create alert');
    }

    return response.json();
}

export async function listRateAlerts(userId = '') {
    const params = new URLSearchParams();
    if (userId) {
        params.set('userId', userId);
    }

    const url = params.toString() ? `/api/alerts?${params.toString()}` : '/api/alerts';
    const response = await apiFetch(url);

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load alerts');
    }

    return response.json();
}

export async function deleteRateAlert(alertId, userId = '') {
    const params = new URLSearchParams();
    if (userId) {
        params.set('userId', userId);
    }

    const url = params.toString() ? `/api/alerts/${encodeURIComponent(alertId)}?${params.toString()}` : `/api/alerts/${encodeURIComponent(alertId)}`;
    const response = await apiFetch(url, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete alert');
    }

    return response.json();
}