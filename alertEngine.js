export function getPairMidMarketRate(rates, from, to) {
    if (!rates || !rates[from] || !rates[to]) {
        throw new Error('Invalid currency pair for alert evaluation');
    }

    return rates[to] / rates[from];
}

export function evaluateAlertTransition(alert, currentRate, nowMs) {
    const direction = String(alert.direction || '').toLowerCase();
    const targetRate = Number(alert.targetRate);
    const cooldownMinutes = Number(alert.cooldownMinutes || 30);

    if (!Number.isFinite(currentRate) || currentRate <= 0) {
        throw new Error('Invalid current rate');
    }

    if (!Number.isFinite(targetRate) || targetRate <= 0) {
        throw new Error('Invalid target rate');
    }

    const conditionMet = direction === 'above'
        ? currentRate >= targetRate
        : currentRate <= targetRate;

    const lastTriggeredAtMs = alert.lastTriggeredAt ? Date.parse(alert.lastTriggeredAt) : 0;
    const cooldownMs = Math.max(1, cooldownMinutes) * 60 * 1000;
    const isOutOfCooldown = !lastTriggeredAtMs || (nowMs - lastTriggeredAtMs) >= cooldownMs;
    const crossedIntoCondition = conditionMet && !alert.inCondition;

    const shouldNotify = crossedIntoCondition && isOutOfCooldown;

    return {
        conditionMet,
        shouldNotify,
        nextState: {
            inCondition: conditionMet,
            lastTriggeredAt: shouldNotify ? new Date(nowMs).toISOString() : alert.lastTriggeredAt || null
        }
    };
}
