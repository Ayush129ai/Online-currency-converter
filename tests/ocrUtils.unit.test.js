import { detectPriceToken } from '../ocrUtils.js';

describe('ocrUtils price detection', () => {
    test('detects symbol-leading USD amount', () => {
        expect(detectPriceToken('$19.99')).toEqual({ amount: 19.99, currency: 'USD' });
    });

    test('detects symbol-trailing EUR amount', () => {
        expect(detectPriceToken('29,50 €')).toEqual({ amount: 29.5, currency: 'EUR' });
    });

    test('detects code-leading GBP amount', () => {
        expect(detectPriceToken('GBP 120.00')).toEqual({ amount: 120, currency: 'GBP' });
    });

    test('parses thousands and decimals correctly', () => {
        expect(detectPriceToken('USD 1,299.95')).toEqual({ amount: 1299.95, currency: 'USD' });
    });

    test('returns null for non-price text', () => {
        expect(detectPriceToken('hello world')).toBeNull();
    });
});
