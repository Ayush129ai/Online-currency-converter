export const SYMBOL_TO_CURRENCY = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',           // Japanese Yen
    '₹': 'INR',           // Indian Rupee
    '₩': 'KRW',           // South Korean Won
    'د.إ': 'AED',          // UAE Dirham
    'kr': 'SEK',          // Swedish Krona (also NOK/DKK but SEK is default)
    'R': 'ZAR',           // South African Rand (also BRL with $)
    'A$': 'AUD',          // Australian Dollar
    'C$': 'CAD',          // Canadian Dollar
    'NZ$': 'NZD',         // New Zealand Dollar
    'HK$': 'HKD',         // Hong Kong Dollar
    'CHF': 'CHF'          // Swiss Franc
};

// All supported currency codes
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD', 'AED', 'NZD', 'SEK', 'NOK', 'DKK', 'ZAR', 'BRL', 'MXN', 'HKD', 'KRW'];

function normalizeAmount(rawAmount) {
    const cleaned = String(rawAmount || '').replace(/\s/g, '').replace(/[^0-9.,]/g, '');
    if (!cleaned) {
        return NaN;
    }

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            return Number.parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        }
        return Number.parseFloat(cleaned.replace(/,/g, ''));
    }

    if (hasComma && !hasDot) {
        const commaParts = cleaned.split(',');
        if (commaParts.length === 2 && commaParts[1].length <= 2) {
            return Number.parseFloat(cleaned.replace(',', '.'));
        }
        return Number.parseFloat(cleaned.replace(/,/g, ''));
    }

    return Number.parseFloat(cleaned);
}

function normalizeCurrencySymbolOrCode(token) {
    const normalized = String(token || '').trim().toUpperCase();
    
    // Check symbol-to-currency mapping first
    if (SYMBOL_TO_CURRENCY[token]) {
        return SYMBOL_TO_CURRENCY[token];
    }

    // Check if it's a valid currency code
    if (SUPPORTED_CURRENCIES.includes(normalized)) {
        return normalized;
    }

    return '';
}

export function detectPriceToken(token) {
    const raw = String(token || '').trim();
    if (!raw) {
        return null;
    }

    // Try multi-char symbol leading FIRST (longer patterns first to avoid partial matches)
    // e.g., "A$50", "C$75", "NZ$99.99", "HK$600", "CHF150"
    const multiSymbolLeadingMatch = raw.match(/^(A\$|C\$|NZ\$|HK\$|CHF)\s*([0-9][0-9.,]*)/i);
    if (multiSymbolLeadingMatch) {
        const amount = normalizeAmount(multiSymbolLeadingMatch[2]);
        if (Number.isFinite(amount) && amount > 0) {
            const currency = normalizeCurrencySymbolOrCode(multiSymbolLeadingMatch[1]);
            if (currency) {
                return { amount, currency };
            }
        }
    }

    // Try single-char symbol-leading matches (e.g., "$19.99", "€50", "₹100", "¥1000")
    const symbolLeadingMatch = raw.match(/([$€£¥₹₩د\.إ])\s*([0-9][0-9.,]*)/);
    if (symbolLeadingMatch) {
        const amount = normalizeAmount(symbolLeadingMatch[2]);
        if (Number.isFinite(amount) && amount > 0) {
            const currency = normalizeCurrencySymbolOrCode(symbolLeadingMatch[1]);
            if (currency) {
                return { amount, currency };
            }
        }
    }

    // Try multi-char symbol trailing (e.g., "50 A$", "100 NZ$")
    const multiSymbolTrailingMatch = raw.match(/([0-9][0-9.,]*)\s*(A\$|C\$|NZ\$|HK\$)$/i);
    if (multiSymbolTrailingMatch) {
        const amount = normalizeAmount(multiSymbolTrailingMatch[1]);
        if (Number.isFinite(amount) && amount > 0) {
            const currency = normalizeCurrencySymbolOrCode(multiSymbolTrailingMatch[2]);
            if (currency) {
                return { amount, currency };
            }
        }
    }

    // Try symbol-trailing matches (e.g., "29,50 €", "100 £")
    const symbolTrailingMatch = raw.match(/([0-9][0-9.,]*)\s*([$€£¥₹₩د\.إ])/);
    if (symbolTrailingMatch) {
        const amount = normalizeAmount(symbolTrailingMatch[1]);
        if (Number.isFinite(amount) && amount > 0) {
            const currency = normalizeCurrencySymbolOrCode(symbolTrailingMatch[2]);
            if (currency) {
                return { amount, currency };
            }
        }
    }

    // Try code-leading matches (e.g., "USD 19.99", "EUR 50")
    // Use word boundaries to avoid matching partial codes like 'R' from ZAR/BRL
    const codeLeadingMatch = raw.match(/\b(USD|EUR|GBP|INR|JPY|AUD|CAD|CHF|CNY|SGD|AED|NZD|SEK|NOK|DKK|ZAR|BRL|MXN|HKD|KRW)\s+([0-9][0-9.,]*)\b/i);
    if (codeLeadingMatch) {
        const amount = normalizeAmount(codeLeadingMatch[2]);
        if (Number.isFinite(amount) && amount > 0) {
            const currency = normalizeCurrencySymbolOrCode(codeLeadingMatch[1]);
            if (currency) {
                return { amount, currency };
            }
        }
    }

    // Try code-trailing matches (e.g., "19.99 USD", "50 EUR")
    const codeTrailingMatch = raw.match(/\b([0-9][0-9.,]*)\s+(USD|EUR|GBP|INR|JPY|AUD|CAD|CHF|CNY|SGD|AED|NZD|SEK|NOK|DKK|ZAR|BRL|MXN|HKD|KRW)\b/i);
    if (codeTrailingMatch) {
        const amount = normalizeAmount(codeTrailingMatch[1]);
        if (Number.isFinite(amount) && amount > 0) {
            const currency = normalizeCurrencySymbolOrCode(codeTrailingMatch[2]);
            if (currency) {
                return { amount, currency };
            }
        }
    }

    return null;
}
