// ui.js
import { getRates, getLastUpdated, convertCurrency } from './api.js';
import { STORAGE_KEY } from './config.js';
import { getCurrencyCodes, populateCurrencySelect } from './currencyMeta.js';

let historyChart = null;

export function populateCurrencies() {
    const currencies = getCurrencyCodes(getRates());
    const fromSelect = document.getElementById('from-currency');
    const toSelect = document.getElementById('to-currency');
    const multiBaseSelect = document.getElementById('multi-base-currency');
    const multiTargetsSelect = document.getElementById('multi-target-currencies');

    if (!fromSelect || !toSelect) {
        return;
    }

    populateCurrencySelect(fromSelect, currencies, 'USD');
    populateCurrencySelect(toSelect, currencies, 'EUR');
    populateCurrencySelect(multiBaseSelect, currencies, 'USD');
    populateCurrencySelect(multiTargetsSelect, currencies, 'EUR');

    // Set defaults
    if (multiTargetsSelect) {
        const defaultTargets = ['EUR', 'GBP', 'JPY'];
        Array.from(multiTargetsSelect.options).forEach((option) => {
            option.selected = defaultTargets.includes(option.value);
        });
    }
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

export function calculateBankMarginTotals(amount, converted, marginPercent = 0) {
    const safeMargin = Number.isFinite(Number(marginPercent)) ? Number(marginPercent) : 0;
    const googleTotal = Number(converted);
    const actualTotal = googleTotal * (1 + (safeMargin / 100));
    const extraCost = actualTotal - googleTotal;

    return {
        amount: Number(amount),
        marginPercent: safeMargin,
        googleTotal,
        actualTotal,
        extraCost
    };
}

export async function displayResult(amount, from, to, marginPercent = 0) {
    try {
        const converted = await convertCurrency(amount, from, to);
        const totals = calculateBankMarginTotals(amount, converted, marginPercent);

        document.getElementById('result').textContent = `${amount} ${from} = ${totals.actualTotal.toFixed(2)} ${to}`;

        const googleTotalEl = document.getElementById('bank-google-total');
        const actualTotalEl = document.getElementById('bank-actual-total');
        const differenceEl = document.getElementById('bank-difference');
        const differenceCardEl = document.getElementById('bank-difference-card');
        const feeStatusEl = document.getElementById('bank-fee-status');

        if (googleTotalEl && actualTotalEl && differenceEl) {
            googleTotalEl.textContent = `Google Rate Total: ${totals.googleTotal.toFixed(2)} ${to}`;
            actualTotalEl.textContent = `Actual POS Total: ${totals.actualTotal.toFixed(2)} ${to} (${totals.marginPercent.toFixed(2)}% margin)`;
            differenceEl.textContent = `Extra Cost Due To Margin: ${totals.extraCost.toFixed(2)} ${to}`;

            differenceEl.classList.remove('bank-difference-zero', 'bank-difference-positive');
            differenceEl.classList.add(totals.extraCost > 0 ? 'bank-difference-positive' : 'bank-difference-zero');

            if (differenceCardEl) {
                differenceCardEl.classList.remove('bank-card-zero', 'bank-card-positive');
                differenceCardEl.classList.add(totals.extraCost > 0 ? 'bank-card-positive' : 'bank-card-zero');
            }

            if (feeStatusEl) {
                feeStatusEl.classList.remove('bank-fee-status-zero', 'bank-fee-status-positive');

                if (totals.extraCost > 0) {
                    feeStatusEl.textContent = 'Status: Bank markup detected';
                    feeStatusEl.classList.add('bank-fee-status-positive');
                } else {
                    feeStatusEl.textContent = 'Status: No extra bank fee';
                    feeStatusEl.classList.add('bank-fee-status-zero');
                }
            }
        }
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

    if (!list) {
        return;
    }

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

export function renderHistoricalChart(historyPayload) {
    const canvas = document.getElementById('history-chart');
    const emptyState = document.getElementById('history-empty-state');

    if (!canvas || !emptyState || !window.Chart) {
        return;
    }

    if (!historyPayload || !historyPayload.series || historyPayload.series.length === 0) {
        emptyState.textContent = 'No historical data available.';
        return;
    }

    emptyState.textContent = '';
    const labels = historyPayload.series.map((entry) => entry.date);
    const values = historyPayload.series.map((entry) => Number(entry.rate.toFixed(6)));

    if (historyChart) {
        historyChart.destroy();
    }

    historyChart = new window.Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: `${historyPayload.from} to ${historyPayload.to}`,
                data: values,
                borderColor: '#0b7285',
                backgroundColor: 'rgba(11, 114, 133, 0.2)',
                fill: true,
                tension: 0.25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Exchange Rate'
                    }
                }
            }
        }
    });
}

export function renderOneToMany(amount, baseCurrency, targetCurrencies) {
    const rates = getRates();
    const tableBody = document.getElementById('one-to-many-body');
    const message = document.getElementById('one-to-many-message');

    if (!tableBody || !message) {
        return;
    }

    tableBody.innerHTML = '';

    if (!rates[baseCurrency]) {
        message.textContent = `Base currency ${baseCurrency} is unavailable.`;
        return;
    }

    if (targetCurrencies.length === 0) {
        message.textContent = 'Select one or more target currencies.';
        return;
    }

    message.textContent = '';

    targetCurrencies.forEach((targetCurrency) => {
        if (!rates[targetCurrency]) {
            return;
        }

        const conversionRate = rates[targetCurrency] / rates[baseCurrency];
        const convertedAmount = amount * conversionRate;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${baseCurrency}</td>
            <td>${targetCurrency}</td>
            <td>${conversionRate.toFixed(6)}</td>
            <td>${convertedAmount.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });
}

export function setAuthStatus(isLoggedIn, username = '') {
    const authStatus = document.getElementById('auth-status');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-btn');

    if (!authStatus || !loginForm || !logoutButton) {
        return;
    }

    if (isLoggedIn) {
        authStatus.textContent = `Authenticated as ${username || 'user'}`;
        loginForm.classList.add('hidden');
        logoutButton.classList.remove('hidden');
        return;
    }

    authStatus.textContent = 'Not authenticated';
    loginForm.classList.remove('hidden');
    logoutButton.classList.add('hidden');
}