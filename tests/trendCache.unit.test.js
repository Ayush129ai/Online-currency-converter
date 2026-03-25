import { jest } from '@jest/globals';
import { createHistoricalCache } from '../trendCache.js';

describe('trendCache caching layer', () => {
    test('reuses cached value within ttl', async () => {
        const fetcher = jest.fn().mockResolvedValue({ series: [1, 2, 3] });
        const cache = createHistoricalCache(fetcher, 10000);

        const a = await cache.get('USD', 'EUR', '7d');
        const b = await cache.get('USD', 'EUR', '7d');

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(a).toEqual(b);
    });

    test('deduplicates in-flight requests', async () => {
        let resolveFetcher;
        const fetcher = jest.fn().mockImplementation(
            () => new Promise((resolve) => {
                resolveFetcher = resolve;
            })
        );

        const cache = createHistoricalCache(fetcher, 10000);

        const p1 = cache.get('USD', 'EUR', '1m');
        const p2 = cache.get('USD', 'EUR', '1m');
        resolveFetcher({ series: ['ok'] });

        const [r1, r2] = await Promise.all([p1, p2]);

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(r1).toEqual(r2);
    });

    test('clear removes cached entries', async () => {
        const fetcher = jest.fn().mockResolvedValue({ series: [5] });
        const cache = createHistoricalCache(fetcher, 10000);

        await cache.get('USD', 'EUR', '24h');
        cache.clear();
        await cache.get('USD', 'EUR', '24h');

        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});
