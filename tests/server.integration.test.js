import request from 'supertest';
import { jest } from '@jest/globals';

const fetchMock = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
    default: fetchMock
}));

describe('server endpoints', () => {
    beforeEach(() => {
        jest.resetModules();
        fetchMock.mockReset();
        process.env.EXCHANGE_RATE_API_KEY = 'test-api-key';
        process.env.API_BASE_URL = 'http://localhost:3000';
    });

    test('GET /api/health returns service status', async () => {
        const { createApp } = await import('../server.js');
        const app = createApp();

        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
        expect(response.body.cache.hasCache).toBe(false);
    });

    test('GET /api/rates returns normalized rates payload', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                result: 'success',
                base_code: 'USD',
                time_last_update_utc: 'Wed, 25 Mar 2026 00:00:01 +0000',
                conversion_rates: {
                    USD: 1,
                    EUR: 0.9
                }
            })
        });

        const { createApp } = await import('../server.js');
        const app = createApp();

        const response = await request(app).get('/api/rates');

        expect(response.status).toBe(200);
        expect(response.body.base).toBe('USD');
        expect(response.body.rates.EUR).toBe(0.9);
    });

    test('GET /api/convert converts amount and returns metadata', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                result: 'success',
                base_code: 'USD',
                time_last_update_utc: 'Wed, 25 Mar 2026 00:00:01 +0000',
                conversion_rates: {
                    USD: 1,
                    EUR: 0.9
                }
            })
        });

        const { createApp } = await import('../server.js');
        const app = createApp();

        const response = await request(app).get('/api/convert').query({ amount: 100, from: 'USD', to: 'EUR' });

        expect(response.status).toBe(200);
        expect(response.body.amount).toBe(100);
        expect(response.body.result).toBeCloseTo(90);
        expect(response.body.rate).toBeCloseTo(0.9);
    });
});
