const CURRENCY_METADATA = {
    USD: { currencyName: 'US Dollar', country: 'United States', flag: '🇺🇸' },
    EUR: { currencyName: 'Euro', country: 'Eurozone', flag: '🇪🇺' },
    GBP: { currencyName: 'Pound Sterling', country: 'United Kingdom', flag: '🇬🇧' },
    INR: { currencyName: 'Indian Rupee', country: 'India', flag: '🇮🇳' },
    JPY: { currencyName: 'Japanese Yen', country: 'Japan', flag: '🇯🇵' },
    AUD: { currencyName: 'Australian Dollar', country: 'Australia', flag: '🇦🇺' },
    CAD: { currencyName: 'Canadian Dollar', country: 'Canada', flag: '🇨🇦' },
    CHF: { currencyName: 'Swiss Franc', country: 'Switzerland', flag: '🇨🇭' },
    CNY: { currencyName: 'Chinese Yuan', country: 'China', flag: '🇨🇳' },
    SGD: { currencyName: 'Singapore Dollar', country: 'Singapore', flag: '🇸🇬' },
    AED: { currencyName: 'UAE Dirham', country: 'United Arab Emirates', flag: '🇦🇪' },
    NZD: { currencyName: 'New Zealand Dollar', country: 'New Zealand', flag: '🇳🇿' },
    SEK: { currencyName: 'Swedish Krona', country: 'Sweden', flag: '🇸🇪' },
    NOK: { currencyName: 'Norwegian Krone', country: 'Norway', flag: '🇳🇴' },
    DKK: { currencyName: 'Danish Krone', country: 'Denmark', flag: '🇩🇰' },
    ZAR: { currencyName: 'South African Rand', country: 'South Africa', flag: '🇿🇦' },
    BRL: { currencyName: 'Brazilian Real', country: 'Brazil', flag: '🇧🇷' },
    MXN: { currencyName: 'Mexican Peso', country: 'Mexico', flag: '🇲🇽' },
    HKD: { currencyName: 'Hong Kong Dollar', country: 'Hong Kong', flag: '🇭🇰' },
    KRW: { currencyName: 'South Korean Won', country: 'South Korea', flag: '🇰🇷' }
};

const FALLBACK_CURRENCY_CODES = Object.keys(CURRENCY_METADATA);

export function getCurrencyLabel(code) {
    const normalizedCode = String(code || '').toUpperCase();
    const metadata = CURRENCY_METADATA[normalizedCode];

    if (metadata) {
        return `${metadata.flag} ${normalizedCode} - ${metadata.currencyName} (${metadata.country})`;
    }

    let displayName = 'Unknown Currency';
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
        try {
            const currencyDisplay = new Intl.DisplayNames(['en'], { type: 'currency' });
            const resolvedName = currencyDisplay.of(normalizedCode);
            if (resolvedName) {
                displayName = resolvedName;
            }
        } catch (_error) {
            displayName = 'Unknown Currency';
        }
    }

    return `🏳️ ${normalizedCode} - ${displayName} (Unknown country)`;
}

export function getCurrencyCodes(rates = {}) {
    const rateCodes = Object.keys(rates || {});
    const source = rateCodes.length > 0 ? rateCodes : FALLBACK_CURRENCY_CODES;
    return [...source].sort((a, b) => a.localeCompare(b));
}

export function populateCurrencySelect(selectElement, currencyCodes, preferredCode = 'USD') {
    if (!selectElement) {
        return;
    }

    selectElement.innerHTML = '';

    currencyCodes.forEach((currencyCode) => {
        const option = document.createElement('option');
        option.value = currencyCode;
        option.textContent = getCurrencyLabel(currencyCode);
        selectElement.appendChild(option);
    });

    if (currencyCodes.includes(preferredCode)) {
        selectElement.value = preferredCode;
        return;
    }

    if (currencyCodes.length > 0) {
        selectElement.value = currencyCodes[0];
    }
}
