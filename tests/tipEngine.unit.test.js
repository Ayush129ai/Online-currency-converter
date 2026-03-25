import { createSmartTipResult, getRuleForCountry, calculateTipBreakdown } from '../tipEngine.js';

const sampleRules = {
    defaultRule: {
        countryCode: 'DEFAULT',
        countryName: 'General',
        tipPercent: 10,
        currency: 'USD',
        proTip: 'Default etiquette.'
    },
    countries: [
        {
            countryCode: 'GB',
            countryName: 'United Kingdom',
            tipPercent: 10,
            currency: 'GBP',
            proTip: 'Service charge may apply.'
        },
        {
            countryCode: 'JP',
            countryName: 'Japan',
            tipPercent: 0,
            currency: 'JPY',
            proTip: 'No tipping expected.'
        }
    ]
};

describe('tipEngine logic', () => {
    test('returns exact rule for known country', () => {
        const rule = getRuleForCountry(sampleRules, 'GB');
        expect(rule.currency).toBe('GBP');
        expect(rule.tipPercent).toBe(10);
    });

    test('falls back to default rule when country is unknown', () => {
        const rule = getRuleForCountry(sampleRules, 'ZZ');
        expect(rule.countryCode).toBe('DEFAULT');
        expect(rule.tipPercent).toBe(10);
    });

    test('calculates zero tip country correctly', () => {
        const result = createSmartTipResult(sampleRules, 100, 'JP');
        expect(result.tipAmount).toBe(0);
        expect(result.totalWithTip).toBe(100);
        expect(result.rule.currency).toBe('JPY');
    });

    test('calculates percentage tip totals correctly', () => {
        const result = createSmartTipResult(sampleRules, 82.5, 'GB');
        expect(result.tipAmount).toBeCloseTo(8.25);
        expect(result.totalWithTip).toBeCloseTo(90.75);
    });

    test('throws on invalid bill input', () => {
        expect(() => calculateTipBreakdown(-2, 10)).toThrow('Invalid bill amount');
    });
});
