import { convertCurrency, getRates } from './api.js';
import { createSmartTipResult, getRuleForCountry } from './tipEngine.js';
import { getCurrencyCodes, populateCurrencySelect } from './currencyMeta.js';

let elements = null;
let tipRules = null;

function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('error-text', isError);
}

function formatCurrency(amount, currencyCode) {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (_error) {
        return `${amount.toFixed(2)} ${currencyCode}`;
    }
}

function populateHomeCurrencySelect(selectElement, selectedCurrency = 'USD') {
    const currencies = getCurrencyCodes(getRates());
    populateCurrencySelect(selectElement, currencies, selectedCurrency);
}

function populateCountrySelect() {
    const countries = [...tipRules.countries].sort((a, b) => a.countryName.localeCompare(b.countryName));
    elements.country.innerHTML = '';

    countries.forEach((country) => {
        const option = document.createElement('option');
        option.value = country.countryCode;
        option.textContent = country.countryName;
        elements.country.appendChild(option);
    });

    if (countries.length > 0) {
        elements.country.value = countries[0].countryCode;
    }
}

function updateEtiquette(countryCode) {
    const rule = getRuleForCountry(tipRules, countryCode);
    elements.etiquette.textContent = rule.proTip;
}

async function calculateAndRenderTip() {
    const billAmount = Number.parseFloat(elements.billAmount.value);
    const countryCode = elements.country.value;
    const homeCurrency = elements.homeCurrency.value;

    if (!Number.isFinite(billAmount) || billAmount <= 0) {
        setStatus('Enter a valid bill amount greater than zero.', true);
        return;
    }

    try {
        const result = createSmartTipResult(tipRules, billAmount, countryCode);
        const convertedTotal = await convertCurrency(result.totalWithTip, result.rule.currency, homeCurrency);

        elements.resultLocal.textContent = `Suggested Tip (${result.tipPercent}%): ${formatCurrency(result.tipAmount, result.rule.currency)} | Total with Tip: ${formatCurrency(result.totalWithTip, result.rule.currency)}`;
        elements.resultHome.textContent = `Converted Total in ${homeCurrency}: ${formatCurrency(convertedTotal, homeCurrency)}`;

        updateEtiquette(countryCode);
        setStatus(`Tip calculated using 2026 etiquette for ${result.rule.countryName}.`);
    } catch (error) {
        setStatus(`Unable to calculate smart tip: ${error.message}`, true);
    }
}

async function detectCountryFromLocation() {
    if (!navigator.geolocation) {
        setStatus('Geolocation is not supported on this browser.', true);
        return;
    }

    setStatus('Detecting location...');

    const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        });
    });

    const { latitude, longitude } = position.coords;
    const endpoint = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;

    const response = await fetch(endpoint, {
        headers: {
            'Accept-Language': 'en'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to reverse geocode location');
    }

    const payload = await response.json();
    const countryCode = String(payload?.address?.country_code || '').toUpperCase();

    if (!countryCode) {
        throw new Error('Country not found for current location');
    }

    const exists = tipRules.countries.some((country) => country.countryCode === countryCode);
    if (!exists) {
        setStatus(`Detected ${countryCode}, but no specific rule is available. You can still calculate using manual selection.`);
        return;
    }

    elements.country.value = countryCode;
    updateEtiquette(countryCode);
    setStatus(`Detected country: ${countryCode}`);
}

export async function initSmartTipCalculator() {
    const billAmount = document.getElementById('tip-bill-amount');
    const country = document.getElementById('tip-country');
    const homeCurrency = document.getElementById('tip-home-currency');
    const calcButton = document.getElementById('tip-calc-btn');
    const gpsButton = document.getElementById('tip-gps-btn');
    const status = document.getElementById('tip-status');
    const resultLocal = document.getElementById('tip-result-local');
    const resultHome = document.getElementById('tip-result-home');
    const etiquette = document.getElementById('tip-etiquette');

    if (!billAmount || !country || !homeCurrency || !calcButton || !gpsButton || !status || !resultLocal || !resultHome || !etiquette) {
        return;
    }

    elements = {
        billAmount,
        country,
        homeCurrency,
        calcButton,
        gpsButton,
        status,
        resultLocal,
        resultHome,
        etiquette
    };

    const response = await fetch('./tipping-rules.json');
    if (!response.ok) {
        throw new Error('Unable to load tipping rules');
    }

    tipRules = await response.json();

    populateCountrySelect();
    populateHomeCurrencySelect(homeCurrency, 'USD');
    updateEtiquette(country.value);

    calcButton.addEventListener('click', calculateAndRenderTip);

    gpsButton.addEventListener('click', async () => {
        try {
            await detectCountryFromLocation();
        } catch (error) {
            setStatus(`Location detection failed: ${error.message}`, true);
        }
    });

    country.addEventListener('change', () => {
        updateEtiquette(country.value);
    });
}
