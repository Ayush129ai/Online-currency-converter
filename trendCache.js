const DEFAULT_TTL_MS = 5 * 60 * 1000;

function createKey(from, to, interval) {
    return `${from}:${to}:${interval}`;
}

export function createHistoricalCache(fetcher, ttlMs = DEFAULT_TTL_MS) {
    const cache = new Map();

    async function get(from, to, interval) {
        const key = createKey(from, to, interval);
        const now = Date.now();
        const existing = cache.get(key);

        if (existing && existing.value && existing.expiresAt > now) {
            return existing.value;
        }

        if (existing && existing.pendingPromise) {
            return existing.pendingPromise;
        }

        const pendingPromise = fetcher(from, to, interval)
            .then((value) => {
                cache.set(key, {
                    value,
                    expiresAt: Date.now() + ttlMs,
                    pendingPromise: null
                });
                return value;
            })
            .catch((error) => {
                cache.delete(key);
                throw error;
            });

        cache.set(key, {
            value: null,
            expiresAt: 0,
            pendingPromise
        });

        return pendingPromise;
    }

    function clear() {
        cache.clear();
    }

    return {
        get,
        clear
    };
}
