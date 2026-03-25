import { jest } from '@jest/globals';

describe('api.js conversion logic', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('returns backend conversion result when API succeeds', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: 91.5 })
        });

        const { convertCurrency } = await import('../api.js');
        const result = await convertCurrency(100, 'USD', 'EUR');

        expect(result).toBe(91.5);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('/api/convert?amount=100&from=USD&to=EUR');
    });

    test('falls back to local conversion when convert endpoint fails', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ rates: { USD: 1, EUR: 0.9 } })
            })
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({})
            });

        const { fetchRates, convertCurrency } = await import('../api.js');

        await fetchRates();
        const result = await convertCurrency(50, 'USD', 'EUR');

        expect(result).toBeCloseTo(45);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('throws invalid currency when fallback cannot resolve rates', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: async () => ({})
        });

        const { convertCurrency } = await import('../api.js');

        await expect(convertCurrency(10, 'AAA', 'BBB')).rejects.toThrow('Invalid currency');
    });
});
