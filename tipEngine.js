export const DEFAULT_TIP_RULE = {
    countryCode: 'DEFAULT',
    countryName: 'General',
    tipPercent: 10,
    currency: 'USD',
    proTip: 'A modest tip is usually appreciated when service is attentive.'
};

function normalizeCountryCode(countryCode) {
    return String(countryCode || '').trim().toUpperCase();
}

export function getRuleForCountry(rulesPayload, countryCode) {
    const normalizedCode = normalizeCountryCode(countryCode);
    const countries = Array.isArray(rulesPayload?.countries) ? rulesPayload.countries : [];

    const match = countries.find((rule) => normalizeCountryCode(rule.countryCode) === normalizedCode);
    if (match) {
        return match;
    }

    return rulesPayload?.defaultRule || DEFAULT_TIP_RULE;
}

export function calculateTipBreakdown(billAmount, tipPercent) {
    const numericBill = Number(billAmount);
    const numericTipPercent = Number(tipPercent);

    if (!Number.isFinite(numericBill) || numericBill < 0) {
        throw new Error('Invalid bill amount');
    }

    if (!Number.isFinite(numericTipPercent) || numericTipPercent < 0) {
        throw new Error('Invalid tip percentage');
    }

    const tipAmount = numericBill * (numericTipPercent / 100);
    const totalWithTip = numericBill + tipAmount;

    return {
        billAmount: numericBill,
        tipPercent: numericTipPercent,
        tipAmount,
        totalWithTip
    };
}

export function createSmartTipResult(rulesPayload, billAmount, countryCode) {
    const rule = getRuleForCountry(rulesPayload, countryCode);
    const breakdown = calculateTipBreakdown(billAmount, rule.tipPercent);

    return {
        rule,
        ...breakdown
    };
}
