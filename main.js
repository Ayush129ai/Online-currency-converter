// main.js
import {
    fetchRates,
    verifyToken
} from './api.js';
import {
    populateCurrencies,
    updateRateDisplay,
    displayResult,
    swapCurrencies,
    loadFavorites,
    addFavorite
} from './ui.js';
import { initTaskManager } from './taskManager.js';
import { initOcrScanner } from './ocrScanner.js';
import { initSmartTipCalculator } from './smartTip.js';
import { initHistoricalTrends } from './historicalTrends.js';
import { initAlertsUi } from './alertsUi.js';

function getSelectedBankMarginPercent() {
    const mode = document.getElementById('bank-margin-enabled');
    const preset = document.getElementById('bank-margin-preset');
    const custom = document.getElementById('bank-margin-custom');

    if (!mode || !preset || !custom) {
        return 0;
    }

    if (mode.value !== 'on') {
        return 0;
    }

    if (preset.value === 'custom') {
        const customValue = Number.parseFloat(custom.value);
        return Number.isFinite(customValue) && customValue >= 0 ? customValue : 0;
    }

    const selectedValue = Number.parseFloat(preset.value);
    return Number.isFinite(selectedValue) && selectedValue >= 0 ? selectedValue : 0;
}

function syncBankMarginControls() {
    const mode = document.getElementById('bank-margin-enabled');
    const preset = document.getElementById('bank-margin-preset');
    const customWrap = document.getElementById('bank-margin-custom-wrap');

    if (!mode || !preset || !customWrap) {
        return;
    }

    const isOn = mode.value === 'on';
    preset.disabled = !isOn;
    customWrap.classList.toggle('hidden', !isOn || preset.value !== 'custom');
}

async function initFeature(initFn, featureName) {
    try {
        await initFn();
    } catch (error) {
        console.warn(`${featureName} failed to initialize:`, error);
    }
}

async function init() {
    let ratesLoaded = false;

    try {
        await fetchRates();
        ratesLoaded = true;
    } catch (error) {
        document.getElementById('result').textContent = 'Error loading exchange rates. Please try again later.';
    }

    populateCurrencies();

    if (ratesLoaded) {
        updateRateDisplay('USD', 'EUR');
    }

    loadFavorites();

    await initFeature(() => Promise.resolve(initTaskManager()), 'Task manager');
    await initFeature(() => initOcrScanner(), 'OCR scanner');
    await initFeature(() => initSmartTipCalculator(), 'Smart tip');
    await initFeature(() => initHistoricalTrends(), 'Historical trends');
    await initFeature(() => initAlertsUi(), 'Alerts UI');
    await initFeature(() => verifyToken(), 'Authentication verification');
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

    const marginPercent = getSelectedBankMarginPercent();
    await displayResult(amount, from, to, marginPercent);
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

const bankMode = document.getElementById('bank-margin-enabled');
const bankPreset = document.getElementById('bank-margin-preset');
if (bankMode && bankPreset) {
    bankMode.addEventListener('change', syncBankMarginControls);
    bankPreset.addEventListener('change', syncBankMarginControls);
    syncBankMarginControls();
}

// Initialize the app
init();