// api.js
import { API_URL, CONVERT_URL } from './config.js';

let rates = {};
let lastUpdated = null;

export async function fetchRates() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch rates');
        }
        const data = await response.json();
        rates = data.rates;
        lastUpdated = new Date();
        return rates;
    } catch (error) {
        console.error('Error fetching rates:', error);
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
        const response = await fetch(`${CONVERT_URL}?amount=${amount}&from=${from}&to=${to}`);
        if (!response.ok) {
            throw new Error('Conversion failed');
        }
        const data = await response.json();
        return data.result;
    } catch (error) {
        // Fallback to local calculation if API fails
        if (!rates[from] || !rates[to]) {
            throw new Error('Invalid currency');
        }
        return amount * (rates[to] / rates[from]);
    }
}