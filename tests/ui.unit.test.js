import { calculateBankMarginTotals } from '../ui.js';

describe('ui bank margin calculations', () => {
    test('computes Google total, actual total and extra cost from margin percent', () => {
        const totals = calculateBankMarginTotals(100, 92.5, 3);

        expect(totals.googleTotal).toBeCloseTo(92.5);
        expect(totals.actualTotal).toBeCloseTo(95.275);
        expect(totals.extraCost).toBeCloseTo(2.775);
        expect(totals.marginPercent).toBe(3);
    });

    test('returns unchanged totals when margin is disabled', () => {
        const totals = calculateBankMarginTotals(50, 4100, 0);

        expect(totals.actualTotal).toBeCloseTo(4100);
        expect(totals.extraCost).toBeCloseTo(0);
    });

    test('falls back to zero margin for invalid input', () => {
        const totals = calculateBankMarginTotals(100, 88, Number.NaN);

        expect(totals.marginPercent).toBe(0);
        expect(totals.actualTotal).toBeCloseTo(88);
        expect(totals.extraCost).toBeCloseTo(0);
    });
});
