import { convertCurrency, getRates } from './api.js';
import { detectPriceToken } from './ocrUtils.js';
import { getCurrencyCodes, populateCurrencySelect } from './currencyMeta.js';

const OCR_INTERVAL_MS = 1200;

let elements = null;
let scannerActive = false;
let stream = null;
let videoTrack = null;
let torchEnabled = false;
let torchSupported = false;
let worker = null;
let intervalId = null;
let isRecognizing = false;
let lastKey = '';
let lastConversion = null;
let freezeMode = false;
let confidenceThreshold = 60;

const captureCanvas = document.createElement('canvas');
const captureContext = captureCanvas.getContext('2d', { willReadFrequently: true });
const frozenCanvas = document.createElement('canvas');
const frozenContext = frozenCanvas.getContext('2d', { willReadFrequently: true });

function setStatus(message) {
    elements.status.textContent = message;
}

function formatPrice(amount, currencyCode) {
    return `${amount.toFixed(2)} ${currencyCode}`;
}

function setFreezeMode(enabled) {
    freezeMode = enabled;
    elements.freezeButton.textContent = enabled ? 'Unfreeze Frame' : 'Freeze Frame';
    elements.preview.classList.toggle('ocr-is-frozen', enabled);

    if (!enabled) {
        elements.frozenFrame.classList.add('hidden');
        elements.frozenFrame.src = '';
    }
}

function populateBaseCurrencies() {
    const currencies = getCurrencyCodes(getRates());
    populateCurrencySelect(elements.baseCurrency, currencies, 'USD');
}

function updateThresholdDisplay() {
    elements.thresholdValue.textContent = String(confidenceThreshold);
}

function maybeAutoSelectSourceCurrency(candidate) {
    if (!candidate || !candidate.currency || candidate.confidence < confidenceThreshold) {
        return;
    }

    const fromSelect = document.getElementById('from-currency');
    if (!fromSelect) {
        return;
    }

    const hasOption = Array.from(fromSelect.options).some((option) => option.value === candidate.currency);
    if (!hasOption || fromSelect.value === candidate.currency) {
        return;
    }

    fromSelect.value = candidate.currency;
    fromSelect.dispatchEvent(new Event('change'));
}

function getCombinedCandidate(firstWord, secondWord) {
    const candidate = detectPriceToken(`${firstWord.text} ${secondWord.text}`);
    if (!candidate) {
        return null;
    }

    const bbox1 = firstWord.bbox || {};
    const bbox2 = secondWord.bbox || {};

    return {
        ...candidate,
        confidence: (Number(firstWord.confidence || 0) + Number(secondWord.confidence || 0)) / 2,
        bbox: {
            x0: Math.min(Number(bbox1.x0 || 0), Number(bbox2.x0 || 0)),
            y0: Math.min(Number(bbox1.y0 || 0), Number(bbox2.y0 || 0)),
            x1: Math.max(Number(bbox1.x1 || 0), Number(bbox2.x1 || 0)),
            y1: Math.max(Number(bbox1.y1 || 0), Number(bbox2.y1 || 0))
        }
    };
}

function getBestCandidate(recognitionData) {
    const words = recognitionData?.words || [];
    const candidates = [];

    words.forEach((word, index) => {
        const fromWord = detectPriceToken(word.text || '');
        if (fromWord) {
            candidates.push({
                ...fromWord,
                confidence: Number(word.confidence || 0),
                bbox: word.bbox || null
            });
        }

        if (index < words.length - 1) {
            const combined = getCombinedCandidate(word, words[index + 1]);
            if (combined) {
                candidates.push(combined);
            }
        }
    });

    if (candidates.length > 0) {
        return candidates.sort((a, b) => b.confidence - a.confidence)[0];
    }

    const fromText = detectPriceToken(recognitionData?.text || '');
    if (!fromText) {
        return null;
    }

    return {
        ...fromText,
        confidence: 0,
        bbox: null
    };
}

function clearOverlay() {
    elements.overlay.innerHTML = '';
}

function drawOverlayLabel(candidate, convertedAmount, baseCurrency) {
    clearOverlay();

    const label = document.createElement('div');
    label.className = 'ocr-label';
    label.textContent = `${formatPrice(candidate.amount, candidate.currency)} -> ${formatPrice(convertedAmount, baseCurrency)}`;

    if (!candidate.bbox) {
        label.style.left = '12px';
        label.style.top = '12px';
        elements.overlay.appendChild(label);
        return;
    }

    const scaleX = elements.preview.clientWidth / captureCanvas.width;
    const scaleY = elements.preview.clientHeight / captureCanvas.height;

    label.style.left = `${Math.max(0, candidate.bbox.x0 * scaleX)}px`;
    label.style.top = `${Math.max(0, (candidate.bbox.y0 * scaleY) - 36)}px`;

    elements.overlay.appendChild(label);
}

async function ensureTorchSupport() {
    torchSupported = false;

    if (!videoTrack || typeof videoTrack.getCapabilities !== 'function') {
        elements.flashButton.disabled = true;
        return;
    }

    const capabilities = videoTrack.getCapabilities();
    torchSupported = !!capabilities.torch;
    elements.flashButton.disabled = !torchSupported;
}

async function setTorch(enabled) {
    if (!torchSupported || !videoTrack || typeof videoTrack.applyConstraints !== 'function') {
        return;
    }

    await videoTrack.applyConstraints({
        advanced: [{ torch: enabled }]
    });

    torchEnabled = enabled;
    elements.flashButton.textContent = `Flash: ${enabled ? 'On' : 'Off'}`;
}

function updateLastResult(original, converted, baseCurrency) {
    elements.lastResult.textContent = `Detected ${original} -> ${converted.toFixed(2)} ${baseCurrency}`;
}

async function processFrame() {
    if (!scannerActive || isRecognizing || !worker || !elements.video.videoWidth || !elements.video.videoHeight) {
        return;
    }

    isRecognizing = true;

    try {
        const frameWidth = Math.max(320, Math.floor(elements.video.videoWidth * 0.6));
        const frameHeight = Math.max(240, Math.floor(elements.video.videoHeight * 0.6));

        captureCanvas.width = frameWidth;
        captureCanvas.height = frameHeight;
        if (freezeMode) {
            if (!frozenCanvas.width || !frozenCanvas.height) {
                setStatus('Freeze frame unavailable. Capture a frame first.');
                clearOverlay();
                return;
            }
            captureContext.drawImage(frozenCanvas, 0, 0, frameWidth, frameHeight);
        } else {
            captureContext.drawImage(elements.video, 0, 0, frameWidth, frameHeight);
        }

        const recognition = await worker.recognize(captureCanvas);
        const bestCandidate = getBestCandidate(recognition.data);

        if (!bestCandidate || !bestCandidate.currency) {
            setStatus('Scanning... no valid price detected yet.');
            clearOverlay();
            return;
        }

        if (bestCandidate.confidence < confidenceThreshold) {
            setStatus(`Scanning... low confidence (${bestCandidate.confidence.toFixed(0)}%).`);
            clearOverlay();
            return;
        }

        maybeAutoSelectSourceCurrency(bestCandidate);

        const targetCurrency = elements.baseCurrency.value;
        const candidateKey = `${bestCandidate.currency}-${bestCandidate.amount.toFixed(2)}-${targetCurrency}`;

        let convertedAmount = lastConversion;
        if (candidateKey !== lastKey || convertedAmount === null) {
            convertedAmount = await convertCurrency(bestCandidate.amount, bestCandidate.currency, targetCurrency);
            lastKey = candidateKey;
            lastConversion = convertedAmount;
        }

        drawOverlayLabel(bestCandidate, convertedAmount, targetCurrency);
        updateLastResult(formatPrice(bestCandidate.amount, bestCandidate.currency), convertedAmount, targetCurrency);
        setStatus(`Price detected and converted (${bestCandidate.confidence.toFixed(0)}% confidence).`);
    } catch (error) {
        setStatus(`Scanner error: ${error.message}`);
    } finally {
        isRecognizing = false;
    }
}

function captureFreezeFrame() {
    if (!elements.video.videoWidth || !elements.video.videoHeight) {
        return false;
    }

    const frameWidth = Math.max(320, Math.floor(elements.video.videoWidth * 0.6));
    const frameHeight = Math.max(240, Math.floor(elements.video.videoHeight * 0.6));

    frozenCanvas.width = frameWidth;
    frozenCanvas.height = frameHeight;
    frozenContext.drawImage(elements.video, 0, 0, frameWidth, frameHeight);

    elements.frozenFrame.src = frozenCanvas.toDataURL('image/jpeg', 0.92);
    elements.frozenFrame.classList.remove('hidden');
    return true;
}

async function startScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Camera is not supported on this device/browser.');
        return;
    }

    if (!window.Tesseract || typeof window.Tesseract.createWorker !== 'function') {
        setStatus('OCR engine unavailable. Please refresh and try again.');
        return;
    }

    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    });

    elements.video.srcObject = stream;
    videoTrack = stream.getVideoTracks()[0] || null;
    await ensureTorchSupport();

    if (!worker) {
        worker = await window.Tesseract.createWorker('eng');
    }

    scannerActive = true;
    elements.toggleButton.textContent = 'Stop Scanner';
    elements.freezeButton.disabled = false;
    setStatus('Scanner active. Hold steady over a price tag.');

    intervalId = window.setInterval(processFrame, OCR_INTERVAL_MS);
}

async function stopScanner() {
    scannerActive = false;

    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }

    if (torchEnabled) {
        try {
            await setTorch(false);
        } catch (_error) {
            // Ignore torch shutoff errors on unsupported devices.
        }
    }

    if (worker) {
        await worker.terminate();
        worker = null;
    }

    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
    }

    elements.video.srcObject = null;
    videoTrack = null;
    clearOverlay();
    setFreezeMode(false);

    elements.toggleButton.textContent = 'Start Scanner';
    elements.flashButton.disabled = true;
    elements.flashButton.textContent = 'Flash: Off';
    elements.freezeButton.disabled = true;
    setStatus('Scanner idle.');
}

export function initOcrScanner() {
    const toggleButton = document.getElementById('ocr-toggle-btn');
    const flashButton = document.getElementById('ocr-flash-btn');
    const freezeButton = document.getElementById('ocr-freeze-btn');
    const baseCurrency = document.getElementById('ocr-base-currency');
    const thresholdInput = document.getElementById('ocr-confidence-threshold');
    const thresholdValue = document.getElementById('ocr-threshold-value');
    const video = document.getElementById('ocr-video');
    const frozenFrame = document.getElementById('ocr-frozen-frame');
    const overlay = document.getElementById('ocr-overlay');
    const status = document.getElementById('ocr-status');
    const lastResult = document.getElementById('ocr-last-result');
    const preview = document.getElementById('ocr-preview');

    if (!toggleButton || !flashButton || !freezeButton || !baseCurrency || !thresholdInput || !thresholdValue || !video || !frozenFrame || !overlay || !status || !lastResult || !preview) {
        return;
    }

    elements = {
        toggleButton,
        flashButton,
        freezeButton,
        baseCurrency,
        thresholdInput,
        thresholdValue,
        video,
        frozenFrame,
        overlay,
        status,
        lastResult,
        preview
    };

    populateBaseCurrencies();
    confidenceThreshold = Number.parseInt(thresholdInput.value, 10) || 60;
    updateThresholdDisplay();

    toggleButton.addEventListener('click', async () => {
        try {
            if (scannerActive) {
                await stopScanner();
                return;
            }
            await startScanner();
        } catch (error) {
            setStatus(`Unable to start scanner: ${error.message}`);
            await stopScanner();
        }
    });

    flashButton.addEventListener('click', async () => {
        if (!scannerActive || !torchSupported) {
            return;
        }

        try {
            await setTorch(!torchEnabled);
        } catch (error) {
            setStatus(`Flash is unavailable: ${error.message}`);
        }
    });

    freezeButton.addEventListener('click', async () => {
        if (!scannerActive) {
            return;
        }

        if (freezeMode) {
            setFreezeMode(false);
            setStatus('Live scanner resumed.');
            return;
        }

        const captured = captureFreezeFrame();
        if (!captured) {
            setStatus('Unable to freeze. Wait for camera stream to warm up.');
            return;
        }

        setFreezeMode(true);
        setStatus('Frame frozen. Running OCR on frozen image.');
        await processFrame();
    });

    baseCurrency.addEventListener('change', () => {
        lastKey = '';
        lastConversion = null;
    });

    thresholdInput.addEventListener('input', () => {
        confidenceThreshold = Number.parseInt(thresholdInput.value, 10) || 60;
        updateThresholdDisplay();
        lastKey = '';
        lastConversion = null;
    });
}
