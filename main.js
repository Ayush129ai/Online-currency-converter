// main.js
import { fetchRates } from './api.js';
import { populateCurrencies, updateRateDisplay, displayResult, swapCurrencies, loadFavorites, addFavorite } from './ui.js';

async function init() {
    try {
        await fetchRates();
        populateCurrencies();
        updateRateDisplay('USD', 'EUR');
        loadFavorites();
    } catch (error) {
        document.getElementById('result').textContent = 'Error loading exchange rates. Please try again later.';
    }
}

document.getElementById('converter-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('amount').value);
    const from = document.getElementById('from-currency').value;
    const to = document.getElementById('to-currency').value;

    if (isNaN(amount) || amount <= 0) {
        document.getElementById('result').textContent = 'Please enter a valid amount.';
        return;
    }

    await displayResult(amount, from, to);
});

document.getElementById('swap-btn').addEventListener('click', () => {
    swapCurrencies();
});

document.getElementById('from-currency').addEventListener('change', () => {
    const from = document.getElementById('from-currency').value;
    const to = document.getElementById('to-currency').value;
    updateRateDisplay(from, to);
});

document.getElementById('to-currency').addEventListener('change', () => {
    const from = document.getElementById('from-currency').value;
    const to = document.getElementById('to-currency').value;
    updateRateDisplay(from, to);
});

document.getElementById('add-favorite').addEventListener('click', () => {
    const from = document.getElementById('from-currency').value;
    const to = document.getElementById('to-currency').value;
    addFavorite(from, to);
});

// Initialize the app
init();