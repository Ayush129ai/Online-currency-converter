// ui.js
import { getRates, getLastUpdated, convertCurrency } from './api.js';
import { STORAGE_KEY } from './config.js';

export function populateCurrencies() {
    const currencies = Object.keys(getRates());
    const fromSelect = document.getElementById('from-currency');
    const toSelect = document.getElementById('to-currency');

    // Clear existing options
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';

    currencies.forEach(currency => {
        const option1 = document.createElement('option');
        option1.value = currency;
        option1.textContent = currency;
        fromSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = currency;
        option2.textContent = currency;
        toSelect.appendChild(option2);
    });

    // Set defaults
    fromSelect.value = 'USD';
    toSelect.value = 'EUR';
}

export function updateRateDisplay(from, to) {
    const rates = getRates();
    if (rates[from] && rates[to]) {
        const rate = rates[to] / rates[from];
        const lastUpdated = getLastUpdated();
        document.getElementById('rate-display').textContent = 
            `1 ${from} = ${rate.toFixed(4)} ${to} (Last updated: ${lastUpdated ? lastUpdated.toLocaleString() : 'N/A'})`;
    }
}

export function displayResult(amount, from, to) {
    try {
        const converted = convertCurrency(amount, from, to);
        document.getElementById('result').textContent = `${amount} ${from} = ${converted.toFixed(2)} ${to}`;
    } catch (error) {
        document.getElementById('result').textContent = 'Error: ' + error.message;
    }
}

export function swapCurrencies() {
    const fromSelect = document.getElementById('from-currency');
    const toSelect = document.getElementById('to-currency');
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    updateRateDisplay(fromSelect.value, toSelect.value);
}

export function loadFavorites() {
    const favorites = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const list = document.getElementById('favorites-list');
    list.innerHTML = '';
    favorites.forEach(fav => {
        const li = document.createElement('li');
        li.textContent = `${fav.from} to ${fav.to}`;
        li.addEventListener('click', () => {
            document.getElementById('from-currency').value = fav.from;
            document.getElementById('to-currency').value = fav.to;
            updateRateDisplay(fav.from, fav.to);
        });
        list.appendChild(li);
    });
}

export function addFavorite(from, to) {
    const favorites = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!favorites.some(fav => fav.from === from && fav.to === to)) {
        favorites.push({ from, to });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
        loadFavorites();
    }
}