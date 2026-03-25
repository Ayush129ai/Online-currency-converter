import { evaluateAlertTransition, getPairMidMarketRate } from '../alertEngine.js';

describe('alertEngine', () => {
    test('computes pair mid-market rate from base rates', () => {
        const rate = getPairMidMarketRate({ USD: 1, EUR: 0.9 }, 'USD', 'EUR');
        expect(rate).toBeCloseTo(0.9);
    });

    test('triggers once when crossing into condition', () => {
        const now = Date.now();
        const alert = {
            direction: 'above',
            targetRate: 1.2,
            cooldownMinutes: 10,
            inCondition: false,
            lastTriggeredAt: null
        };

        const result = evaluateAlertTransition(alert, 1.21, now);
        expect(result.shouldNotify).toBe(true);
        expect(result.nextState.inCondition).toBe(true);
        expect(result.nextState.lastTriggeredAt).not.toBeNull();
    });

    test('does not retrigger while still in same condition band', () => {
        const now = Date.now();
        const alert = {
            direction: 'above',
            targetRate: 1.2,
            cooldownMinutes: 10,
            inCondition: true,
            lastTriggeredAt: new Date(now - 60 * 60 * 1000).toISOString()
        };

        const result = evaluateAlertTransition(alert, 1.22, now);
        expect(result.shouldNotify).toBe(false);
        expect(result.nextState.inCondition).toBe(true);
    });

    test('respects cooldown when re-entering condition quickly', () => {
        const now = Date.now();
        const alert = {
            direction: 'below',
            targetRate: 0.95,
            cooldownMinutes: 30,
            inCondition: false,
            lastTriggeredAt: new Date(now - 5 * 60 * 1000).toISOString()
        };

        const result = evaluateAlertTransition(alert, 0.94, now);
        expect(result.shouldNotify).toBe(false);
        expect(result.nextState.inCondition).toBe(true);
    });

    test('allows re-trigger after cooldown when condition re-enters', () => {
        const now = Date.now();
        const alert = {
            direction: 'below',
            targetRate: 0.95,
            cooldownMinutes: 10,
            inCondition: false,
            lastTriggeredAt: new Date(now - 11 * 60 * 1000).toISOString()
        };

        const result = evaluateAlertTransition(alert, 0.94, now);
        expect(result.shouldNotify).toBe(true);
    });
});
