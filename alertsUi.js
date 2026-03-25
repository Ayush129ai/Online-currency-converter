import { getRates, createRateAlert, listRateAlerts, deleteRateAlert } from './api.js';
import { getCurrencyCodes, populateCurrencySelect } from './currencyMeta.js';

let elements = null;

function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('error-text', isError);
}

function populateCurrencySelects() {
    const currencies = getCurrencyCodes(getRates());
    populateCurrencySelect(elements.fromCurrency, currencies, 'USD');
    populateCurrencySelect(elements.toCurrency, currencies, 'EUR');
}

function renderAlerts(alerts) {
    elements.list.innerHTML = '';

    if (!alerts || alerts.length === 0) {
        elements.list.innerHTML = '<p class="helper-text">No alerts found for the selected user.</p>';
        return;
    }

    alerts.forEach((alert) => {
        const card = document.createElement('article');
        card.className = 'alert-card';

        const title = document.createElement('h3');
        title.textContent = `${alert.from}/${alert.to} ${alert.direction} ${Number(alert.targetRate).toFixed(6)}`;

        const meta = document.createElement('p');
        meta.className = 'alert-meta';
        meta.textContent = `User: ${alert.userId} | Cool-down: ${alert.cooldownMinutes} min | Last Triggered: ${alert.lastTriggeredAt || 'Never'}`;

        const actions = document.createElement('div');
        actions.className = 'alerts-actions';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'task-remove-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', async () => {
            try {
                await deleteRateAlert(alert.id, elements.userId.value.trim());
                setStatus('Alert deleted.');
                await refreshAlerts();
            } catch (error) {
                setStatus(error.message, true);
            }
        });

        actions.appendChild(deleteButton);
        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(actions);
        elements.list.appendChild(card);
    });
}

async function refreshAlerts() {
    const userId = elements.userId.value.trim();
    const payload = await listRateAlerts(userId);
    renderAlerts(payload.alerts || []);
}

async function onCreateAlert(event) {
    event.preventDefault();

    const payload = {
        userId: elements.userId.value.trim(),
        from: elements.fromCurrency.value,
        to: elements.toCurrency.value,
        targetRate: Number.parseFloat(elements.targetRate.value),
        direction: elements.direction.value,
        cooldownMinutes: Number.parseInt(elements.cooldown.value, 10),
        fcmToken: elements.fcmToken.value.trim()
    };

    if (!payload.userId) {
        setStatus('User ID is required.', true);
        return;
    }

    if (!payload.fcmToken) {
        delete payload.fcmToken;
    }

    if (payload.from === payload.to) {
        setStatus('From and To currencies must be different.', true);
        return;
    }

    try {
        await createRateAlert(payload);
        setStatus(payload.fcmToken
            ? 'Alert created successfully.'
            : 'Alert created (local mode: no push token).');
        await refreshAlerts();
    } catch (error) {
        setStatus(error.message, true);
    }
}

export async function initAlertsUi() {
    const form = document.getElementById('alert-form');
    const userId = document.getElementById('alert-user-id');
    const fromCurrency = document.getElementById('alert-from-currency');
    const toCurrency = document.getElementById('alert-to-currency');
    const targetRate = document.getElementById('alert-target-rate');
    const direction = document.getElementById('alert-direction');
    const cooldown = document.getElementById('alert-cooldown');
    const fcmToken = document.getElementById('alert-fcm-token');
    const refreshButton = document.getElementById('alerts-refresh-btn');
    const status = document.getElementById('alerts-status');
    const list = document.getElementById('alerts-list');

    if (!form || !userId || !fromCurrency || !toCurrency || !targetRate || !direction || !cooldown || !fcmToken || !refreshButton || !status || !list) {
        return;
    }

    elements = {
        form,
        userId,
        fromCurrency,
        toCurrency,
        targetRate,
        direction,
        cooldown,
        fcmToken,
        refreshButton,
        status,
        list
    };

    populateCurrencySelects();

    form.addEventListener('submit', onCreateAlert);
    refreshButton.addEventListener('click', async () => {
        try {
            await refreshAlerts();
            setStatus('Alerts refreshed.');
        } catch (error) {
            setStatus(error.message, true);
        }
    });
}
