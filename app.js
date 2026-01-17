/**
 * COSMICLINK - Universal Signal Detection Array
 * Real sensor capture and signal analysis
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    isScanning: false,
    scanStartTime: null,
    totalScanTime: 0,
    anomalies: [],
    totalAnomalies: 0,
    totalTransmits: 0,
    selectedSignal: null,
    sensors: {
        audio: { active: false, stream: null, analyser: null, dataArray: null },
        magnetometer: { active: false, sensor: null },
        motion: { active: false, sensor: null },
        light: { active: false, sensor: null }
    },
    audioContext: null,
    transmitAudioContext: null,
    location: null
};

// ============================================
// DOM REFERENCES
// ============================================

let dom = {};
let freqCtx, detailCtx, previewCtx;

function initDomReferences() {
    dom = {
        sliderTabs: document.querySelectorAll('.slider-tab'),
        sections: document.querySelectorAll('.content-section'),
        systemStatus: document.getElementById('systemStatus'),
        statusDot: document.querySelector('.status-dot'),
        statusText: document.querySelector('.status-text'),
        frequencyCanvas: document.getElementById('frequencyCanvas'),
        vizPrimary: document.querySelector('.viz-primary'),
        masterScan: document.getElementById('masterScan'),
        scanTime: document.getElementById('scanTime'),
        sampleRate: document.getElementById('sampleRate'),
        audioSensor: document.getElementById('audioSensor'),
        audioLevel: document.getElementById('audioLevel'),
        audioReading: document.getElementById('audioReading'),
        magSensor: document.getElementById('magSensor'),
        magLevel: document.getElementById('magLevel'),
        magReading: document.getElementById('magReading'),
        motionSensor: document.getElementById('motionSensor'),
        motionLevel: document.getElementById('motionLevel'),
        motionReading: document.getElementById('motionReading'),
        lightSensor: document.getElementById('lightSensor'),
        lightLevel: document.getElementById('lightLevel'),
        lightReading: document.getElementById('lightReading'),
        signalList: document.getElementById('signalList'),
        anomalyCount: document.getElementById('anomalyCount'),
        analysisPanel: document.getElementById('analysisPanel'),
        closeAnalysis: document.getElementById('closeAnalysis'),
        signalDetailCanvas: document.getElementById('signalDetailCanvas'),
        analysisData: document.getElementById('analysisData'),
        interpretSignal: document.getElementById('interpretSignal'),
        interpretationResult: document.getElementById('interpretationResult'),
        transmitMessage: document.getElementById('transmitMessage'),
        charCount: document.getElementById('charCount'),
        encodingOptions: document.querySelectorAll('.encoding-option'),
        transmitPreview: document.getElementById('transmitPreview'),
        beginTransmit: document.getElementById('beginTransmit'),
        transmitStatus: document.getElementById('transmitStatus'),
        transmitProgress: document.getElementById('transmitProgress'),
        logEntries: document.getElementById('logEntries'),
        logFilters: document.querySelectorAll('.log-filter'),
        clearLog: document.getElementById('clearLog'),
        totalScanTimeEl: document.getElementById('totalScanTime'),
        totalAnomaliesEl: document.getElementById('totalAnomalies'),
        totalTransmitsEl: document.getElementById('totalTransmits'),
        userCoords: document.getElementById('userCoords'),
        deviceInfo: document.getElementById('deviceInfo'),
        toastContainer: document.getElementById('toastContainer')
    };
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
    // Initialize DOM references first
    initDomReferences();
    
    freqCtx = dom.frequencyCanvas.getContext('2d');
    detailCtx = dom.signalDetailCanvas.getContext('2d');
    previewCtx = dom.transmitPreview.getContext('2d');
    
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    
    setupNavigation();
    setupScanner();
    setupSignals();
    setupTransmit();
    setupLog();
    
    getUserLocation();
    checkDeviceCapabilities();
    
    addLogEntry('system', 'CosmicLink v1.0 initialized. All systems nominal.');
    addLogEntry('system', 'Sensor array configured. Awaiting scan command.');
    
    drawIdleVisualization();
}

function resizeCanvases() {
    const freqRect = dom.frequencyCanvas.parentElement.getBoundingClientRect();
    dom.frequencyCanvas.width = freqRect.width;
    dom.frequencyCanvas.height = freqRect.height;
    
    const detailRect = dom.signalDetailCanvas.getBoundingClientRect();
    dom.signalDetailCanvas.width = detailRect.width || 300;
    dom.signalDetailCanvas.height = detailRect.height || 150;
    
    const previewRect = dom.transmitPreview.getBoundingClientRect();
    dom.transmitPreview.width = previewRect.width || 300;
    dom.transmitPreview.height = previewRect.height || 80;
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
    dom.sliderTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const section = tab.dataset.section;
            dom.sliderTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            dom.sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}-section`).classList.add('active');
        });
    });
}

// ============================================
// SCANNER
// ============================================

function setupScanner() {
    dom.masterScan.addEventListener('click', toggleScan);
}

async function toggleScan() {
    if (state.isScanning) {
        stopScan();
    } else {
        await startScan();
    }
}

async function startScan() {
    state.isScanning = true;
    state.scanStartTime = Date.now();
    
    dom.masterScan.classList.add('active');
    dom.masterScan.querySelector('.scan-button-text').textContent = 'SCANNING...';
    dom.masterScan.querySelector('.scan-icon').innerHTML = '<rect x="6" y="6" width="12" height="12"/>';
    dom.vizPrimary.classList.add('scanning');
    dom.statusDot.classList.add('active');
    dom.statusText.textContent = 'SCANNING';
    
    addLogEntry('system', 'Initiating multi-spectrum scan sequence...');
    showToast('info', 'Scan initiated - activating sensors');
    
    await initAudioCapture();
    await initMagnetometer();
    await initMotionSensor();
    await initLightSensor();
    
    requestAnimationFrame(visualizationLoop);
    updateScanTimer();
    startAnomalyDetection();
}

function stopScan() {
    state.isScanning = false;
    const scanDuration = Date.now() - state.scanStartTime;
    state.totalScanTime += scanDuration;
    
    dom.masterScan.classList.remove('active');
    dom.masterScan.querySelector('.scan-button-text').textContent = 'INITIATE SCAN';
    dom.masterScan.querySelector('.scan-icon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    dom.vizPrimary.classList.remove('scanning');
    dom.statusDot.classList.remove('active');
    dom.statusText.textContent = 'STANDBY';
    
    stopAllSensors();
    updateSessionStats();
    
    addLogEntry('system', `Scan terminated. Duration: ${formatDuration(scanDuration)}`);
    showToast('info', 'Scan complete');
}

function stopAllSensors() {
    if (state.sensors.audio.stream) {
        state.sensors.audio.stream.getTracks().forEach(track => track.stop());
        state.sensors.audio.active = false;
        updateSensorCard(dom.audioSensor, false);
    }
    if (state.sensors.magnetometer.sensor) {
        state.sensors.magnetometer.sensor.stop();
        state.sensors.magnetometer.active = false;
        updateSensorCard(dom.magSensor, false);
    }
    if (state.sensors.motion.sensor) {
        state.sensors.motion.sensor.stop();
        state.sensors.motion.active = false;
        updateSensorCard(dom.motionSensor, false);
    }
    if (state.sensors.light.sensor) {
        state.sensors.light.sensor.stop();
        state.sensors.light.active = false;
        updateSensorCard(dom.lightSensor, false);
    }
}

// ============================================
// AUDIO CAPTURE
// ============================================

async function initAudioCapture() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
        
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = state.audioContext.createMediaStreamSource(stream);
        const analyser = state.audioContext.createAnalyser();
        
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        state.sensors.audio = { active: true, stream, analyser, dataArray };
        updateSensorCard(dom.audioSensor, true);
        dom.sampleRate.textContent = state.audioContext.sampleRate + ' Hz';
        addLogEntry('system', `Audio spectrum analyzer active. Sample rate: ${state.audioContext.sampleRate}Hz`);
    } catch (err) {
        console.error('Audio capture failed:', err);
        updateSensorCard(dom.audioSensor, false, true);
        addLogEntry('error', 'Audio capture denied or unavailable');
    }
}

// ============================================
// MAGNETOMETER
// ============================================

async function initMagnetometer() {
    if ('Magnetometer' in window) {
        try {
            const sensor = new Magnetometer({ frequency: 30 });
            sensor.addEventListener('reading', () => {
                if (state.isScanning) {
                    const magnitude = Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2);
                    state.sensors.magnetometer.lastReading = magnitude;
                    updateMagDisplay(magnitude);
                }
            });
            sensor.addEventListener('error', () => updateSensorCard(dom.magSensor, false, true));
            sensor.start();
            state.sensors.magnetometer = { active: true, sensor };
            updateSensorCard(dom.magSensor, true);
            addLogEntry('system', 'Magnetometer online. Monitoring EM field fluctuations.');
        } catch (err) {
            updateSensorCard(dom.magSensor, false, true);
            addLogEntry('system', 'Magnetometer unavailable on this device');
        }
    } else {
        updateSensorCard(dom.magSensor, false, true);
        addLogEntry('system', 'Magnetometer not supported');
    }
}

function updateMagDisplay(magnitude) {
    const normalized = Math.min(magnitude / 100, 1);
    dom.magLevel.style.width = `${normalized * 100}%`;
    dom.magReading.textContent = magnitude.toFixed(2) + ' μT';
}

// ============================================
// MOTION SENSOR
// ============================================

async function initMotionSensor() {
    if ('Accelerometer' in window) {
        try {
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission !== 'granted') throw new Error('Motion permission denied');
            }
            const sensor = new Accelerometer({ frequency: 30 });
            sensor.addEventListener('reading', () => {
                if (state.isScanning) {
                    const magnitude = Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2);
                    state.sensors.motion.lastReading = magnitude;
                    updateMotionDisplay(magnitude);
                }
            });
            sensor.start();
            state.sensors.motion = { active: true, sensor };
            updateSensorCard(dom.motionSensor, true);
            addLogEntry('system', 'Accelerometer online. Monitoring vibration patterns.');
        } catch (err) {
            initDeviceMotionFallback();
        }
    } else {
        initDeviceMotionFallback();
    }
}

function initDeviceMotionFallback() {
    if ('DeviceMotionEvent' in window) {
        const handler = (event) => {
            if (state.isScanning && event.accelerationIncludingGravity) {
                const acc = event.accelerationIncludingGravity;
                const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
                state.sensors.motion.lastReading = magnitude;
                updateMotionDisplay(magnitude);
            }
        };
        window.addEventListener('devicemotion', handler);
        state.sensors.motion = { active: true, sensor: { stop: () => window.removeEventListener('devicemotion', handler) } };
        updateSensorCard(dom.motionSensor, true);
        addLogEntry('system', 'Motion sensor online (fallback mode).');
    } else {
        updateSensorCard(dom.motionSensor, false, true);
        addLogEntry('system', 'Motion sensor not supported');
    }
}

function updateMotionDisplay(magnitude) {
    const normalized = Math.min(magnitude / 20, 1);
    dom.motionLevel.style.width = `${normalized * 100}%`;
    dom.motionReading.textContent = magnitude.toFixed(2) + ' m/s²';
}

// ============================================
// LIGHT SENSOR
// ============================================

async function initLightSensor() {
    if ('AmbientLightSensor' in window) {
        try {
            const sensor = new AmbientLightSensor();
            sensor.addEventListener('reading', () => {
                if (state.isScanning) {
                    state.sensors.light.lastReading = sensor.illuminance;
                    updateLightDisplay(sensor.illuminance);
                }
            });
            sensor.start();
            state.sensors.light = { active: true, sensor };
            updateSensorCard(dom.lightSensor, true);
            addLogEntry('system', 'Ambient light sensor online.');
        } catch (err) {
            updateSensorCard(dom.lightSensor, false, true);
            addLogEntry('system', 'Light sensor unavailable');
        }
    } else {
        updateSensorCard(dom.lightSensor, false, true);
        addLogEntry('system', 'Ambient light sensor not supported');
    }
}

function updateLightDisplay(lux) {
    const normalized = Math.min(lux / 1000, 1);
    dom.lightLevel.style.width = `${normalized * 100}%`;
    dom.lightReading.textContent = lux.toFixed(0) + ' lux';
}

// ============================================
// VISUALIZATION
// ============================================

function visualizationLoop() {
    if (!state.isScanning) {
        drawIdleVisualization();
        return;
    }
    drawFrequencyVisualization();
    requestAnimationFrame(visualizationLoop);
}

function drawFrequencyVisualization() {
    const canvas = dom.frequencyCanvas;
    const ctx = freqCtx;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = 'rgba(19, 25, 38, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    if (state.sensors.audio.active && state.sensors.audio.analyser) {
        const analyser = state.sensors.audio.analyser;
        const dataArray = state.sensors.audio.dataArray;
        analyser.getByteFrequencyData(dataArray);
        
        const avgLevel = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = avgLevel / 255;
        dom.audioLevel.style.width = `${normalizedLevel * 100}%`;
        dom.audioReading.textContent = (normalizedLevel * 100).toFixed(0) + ' dB';
        
        const barWidth = (width / dataArray.length) * 2.5;
        let x = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * height * 0.8;
            const hue = (i / dataArray.length) * 60 + 160;
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
            ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.2)`;
            ctx.fillRect(x, height, barWidth - 1, barHeight * 0.3);
            x += barWidth;
        }
        drawGrid(ctx, width, height);
    }
}

function drawIdleVisualization() {
    const canvas = dom.frequencyCanvas;
    const ctx = freqCtx;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#131926';
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, width, height);
    
    const time = Date.now() * 0.001;
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 4) {
        const y = height / 2 + Math.sin(x * 0.05 + time) * 10 + (Math.random() - 0.5) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    if (!state.isScanning) requestAnimationFrame(drawIdleVisualization);
}

function drawGrid(ctx, width, height) {
    ctx.strokeStyle = 'rgba(30, 42, 58, 0.5)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += height / 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    for (let x = 0; x < width; x += width / 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
}

// ============================================
// ANOMALY DETECTION
// ============================================

let anomalyCheckInterval;
let baselineAudio = null;
let baselineMag = null;

function startAnomalyDetection() {
    setTimeout(() => {
        if (state.sensors.audio.active && state.sensors.audio.analyser) {
            const dataArray = state.sensors.audio.dataArray;
            state.sensors.audio.analyser.getByteFrequencyData(dataArray);
            baselineAudio = Array.from(dataArray);
        }
        if (state.sensors.magnetometer.lastReading) {
            baselineMag = state.sensors.magnetometer.lastReading;
        }
        addLogEntry('system', 'Baseline calibration complete. Monitoring for anomalies.');
    }, 3000);
    
    anomalyCheckInterval = setInterval(checkForAnomalies, 500);
}

function checkForAnomalies() {
    if (!state.isScanning) {
        clearInterval(anomalyCheckInterval);
        return;
    }
    
    if (state.sensors.audio.active && baselineAudio) {
        const analyser = state.sensors.audio.analyser;
        const dataArray = state.sensors.audio.dataArray;
        analyser.getByteFrequencyData(dataArray);
        
        let deviation = 0;
        for (let i = 0; i < dataArray.length; i++) {
            deviation += Math.abs(dataArray[i] - baselineAudio[i]);
        }
        deviation /= dataArray.length;
        
        const peaks = findPeaks(dataArray);
        const hasUnusualPattern = peaks.length >= 3 && hasRegularSpacing(peaks);
        
        if (deviation > 30 || hasUnusualPattern) {
            if (Math.random() < 0.15) {
                registerAnomaly('AUDIO', {
                    deviation,
                    peaks,
                    timestamp: Date.now(),
                    frequencyData: Array.from(dataArray),
                    hasPattern: hasUnusualPattern
                });
            }
        }
    }
    
    if (state.sensors.magnetometer.active && baselineMag) {
        const current = state.sensors.magnetometer.lastReading;
        if (current) {
            const magDeviation = Math.abs(current - baselineMag);
            if (magDeviation > 5 && Math.random() < 0.1) {
                registerAnomaly('EM', {
                    baseline: baselineMag,
                    current,
                    deviation: magDeviation,
                    timestamp: Date.now()
                });
            }
        }
    }
}

function findPeaks(data) {
    const peaks = [];
    const threshold = 100;
    for (let i = 2; i < data.length - 2; i++) {
        if (data[i] > threshold && data[i] > data[i-1] && data[i] > data[i-2] && data[i] > data[i+1] && data[i] > data[i+2]) {
            peaks.push({ index: i, value: data[i] });
        }
    }
    return peaks;
}

function hasRegularSpacing(peaks) {
    if (peaks.length < 3) return false;
    const spacings = [];
    for (let i = 1; i < peaks.length; i++) {
        spacings.push(peaks[i].index - peaks[i-1].index);
    }
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const variance = spacings.reduce((sum, s) => sum + Math.pow(s - avgSpacing, 2), 0) / spacings.length;
    return variance < avgSpacing * 0.3;
}

function registerAnomaly(type, data) {
    const anomaly = {
        id: generateId(),
        type,
        timestamp: data.timestamp,
        data,
        analyzed: false
    };
    
    state.anomalies.unshift(anomaly);
    state.totalAnomalies++;
    
    updateAnomalyDisplay();
    dom.anomalyCount.textContent = state.anomalies.length;
    dom.totalAnomaliesEl.textContent = state.totalAnomalies;
    
    addLogEntry('signal', `Anomaly detected: ${type} signal deviation at ${formatTimestamp(data.timestamp)}`);
    showToast('anomaly', `Potential ${type} signal detected!`);
}

function updateAnomalyDisplay() {
    if (state.anomalies.length === 0) {
        dom.signalList.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="32" cy="32" r="28" stroke-dasharray="4 4"/>
                    <path d="M32 16v16l12 8"/>
                </svg>
                <p class="empty-text">No anomalies detected yet</p>
                <p class="empty-subtext">Start scanning to detect potential signals</p>
            </div>
        `;
        return;
    }
    
    dom.signalList.innerHTML = state.anomalies.map(anomaly => `
        <div class="signal-card" data-id="${anomaly.id}">
            <div class="signal-card-header">
                <span class="signal-id">SIG-${anomaly.id}</span>
                <span class="signal-time">${formatTimestamp(anomaly.timestamp)}</span>
            </div>
            <div class="signal-preview">
                <canvas class="signal-mini-canvas" data-anomaly="${anomaly.id}"></canvas>
            </div>
            <div class="signal-meta">
                <div class="signal-meta-item">
                    <span class="meta-label">TYPE</span>
                    <span class="meta-value">${anomaly.type}</span>
                </div>
                <div class="signal-meta-item">
                    <span class="meta-label">STRENGTH</span>
                    <span class="meta-value">${anomaly.data.deviation ? anomaly.data.deviation.toFixed(1) : 'N/A'}</span>
                </div>
                <div class="signal-meta-item">
                    <span class="meta-label">PATTERN</span>
                    <span class="meta-value">${anomaly.data.hasPattern ? 'DETECTED' : 'IRREGULAR'}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // Draw mini visualizations
    state.anomalies.forEach(anomaly => {
        const canvas = document.querySelector(`canvas[data-anomaly="${anomaly.id}"]`);
        if (canvas && anomaly.data.frequencyData) {
            drawMiniVisualization(canvas, anomaly.data.frequencyData);
        }
    });
    
    // Add click handlers
    document.querySelectorAll('.signal-card').forEach(card => {
        card.addEventListener('click', () => openSignalAnalysis(card.dataset.id));
    });
}

function drawMiniVisualization(canvas, data) {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#0f1422';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const step = Math.floor(data.length / canvas.width);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = 0; x < canvas.width; x++) {
        const dataIndex = x * step;
        const y = canvas.height - (data[dataIndex] / 255) * canvas.height;
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

// ============================================
// SIGNAL ANALYSIS
// ============================================

function setupSignals() {
    dom.closeAnalysis.addEventListener('click', closeSignalAnalysis);
    dom.interpretSignal.addEventListener('click', interpretCurrentSignal);
}

function openSignalAnalysis(signalId) {
    const anomaly = state.anomalies.find(a => a.id === signalId);
    if (!anomaly) return;
    
    state.selectedSignal = anomaly;
    
    // Draw detailed visualization
    if (anomaly.data.frequencyData) {
        drawDetailedVisualization(anomaly.data.frequencyData);
    }
    
    // Populate analysis data
    dom.analysisData.innerHTML = `
        <div class="signal-meta-item">
            <span class="meta-label">SIGNAL ID</span>
            <span class="meta-value">SIG-${anomaly.id}</span>
        </div>
        <div class="signal-meta-item">
            <span class="meta-label">CAPTURED</span>
            <span class="meta-value">${formatTimestamp(anomaly.timestamp)}</span>
        </div>
        <div class="signal-meta-item">
            <span class="meta-label">TYPE</span>
            <span class="meta-value">${anomaly.type}</span>
        </div>
        <div class="signal-meta-item">
            <span class="meta-label">DEVIATION</span>
            <span class="meta-value">${anomaly.data.deviation?.toFixed(2) || 'N/A'}</span>
        </div>
        <div class="signal-meta-item">
            <span class="meta-label">PEAKS DETECTED</span>
            <span class="meta-value">${anomaly.data.peaks?.length || 0}</span>
        </div>
        <div class="signal-meta-item">
            <span class="meta-label">PATTERN</span>
            <span class="meta-value">${anomaly.data.hasPattern ? 'REGULAR' : 'CHAOTIC'}</span>
        </div>
    `;
    
    // Hide previous interpretation
    dom.interpretationResult.classList.add('hidden');
    
    // Show panel
    dom.analysisPanel.classList.remove('hidden');
}

function closeSignalAnalysis() {
    dom.analysisPanel.classList.add('hidden');
    state.selectedSignal = null;
}

function drawDetailedVisualization(data) {
    const canvas = dom.signalDetailCanvas;
    const ctx = detailCtx;
    
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 150;
    
    ctx.fillStyle = '#131926';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw frequency bars
    const barWidth = canvas.width / data.length * 2.5;
    let x = 0;
    
    for (let i = 0; i < data.length && x < canvas.width; i++) {
        const barHeight = (data[i] / 255) * canvas.height * 0.9;
        const hue = (i / data.length) * 60 + 160;
        
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        
        x += barWidth;
    }
    
    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);
}

async function interpretCurrentSignal() {
    if (!state.selectedSignal) return;
    
    const anomaly = state.selectedSignal;
    
    // Show loading state
    dom.interpretSignal.disabled = true;
    dom.interpretSignal.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
        </svg>
        ANALYZING...
    `;
    
    addLogEntry('system', `Initiating AI interpretation of signal SIG-${anomaly.id}...`);
    
    // Prepare signal data for interpretation
    const signalSummary = {
        type: anomaly.type,
        timestamp: new Date(anomaly.timestamp).toISOString(),
        deviation: anomaly.data.deviation,
        peakCount: anomaly.data.peaks?.length || 0,
        hasRegularPattern: anomaly.data.hasPattern,
        frequencyProfile: anomaly.data.frequencyData ? 
            summarizeFrequencyProfile(anomaly.data.frequencyData) : null
    };
    
    try {
        // Call Claude API for interpretation
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `You are an advanced signal analysis AI for CosmicLink, a universal signal detection array. Analyze this anomalous signal data and provide an interpretation. Be scientific but open to the possibility this could be an attempt at non-terrestrial communication. Consider the patterns, frequencies, and timing.

Signal Data:
- Type: ${signalSummary.type}
- Timestamp: ${signalSummary.timestamp}
- Deviation from baseline: ${signalSummary.deviation?.toFixed(2) || 'Unknown'}
- Peak frequencies detected: ${signalSummary.peakCount}
- Regular pattern detected: ${signalSummary.hasRegularPattern ? 'Yes' : 'No'}
- Frequency profile: ${signalSummary.frequencyProfile || 'N/A'}

Provide a brief but intriguing analysis (2-3 paragraphs). Include:
1. What type of signal this could represent
2. If the pattern suggests intentionality or natural origin
3. A possible interpretation if this were an attempt at communication

Be creative and engaging while remaining grounded in the actual data. Make it feel like a real SETI analysis.`
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        const interpretation = data.content[0].text;
        
        // Display interpretation
        dom.interpretationResult.innerHTML = `
            <h4>AI INTERPRETATION</h4>
            <p>${interpretation}</p>
        `;
        dom.interpretationResult.classList.remove('hidden');
        
        addLogEntry('signal', `AI interpretation complete for SIG-${anomaly.id}`);
        showToast('success', 'Signal interpretation complete');
        
    } catch (err) {
        console.error('Interpretation failed:', err);
        
        // Fallback interpretation
        const fallbackInterpretation = generateFallbackInterpretation(signalSummary);
        dom.interpretationResult.innerHTML = `
            <h4>PRELIMINARY ANALYSIS</h4>
            <p>${fallbackInterpretation}</p>
        `;
        dom.interpretationResult.classList.remove('hidden');
        
        addLogEntry('system', 'Using local analysis algorithms (API unavailable)');
    }
    
    // Reset button
    dom.interpretSignal.disabled = false;
    dom.interpretSignal.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
        </svg>
        INTERPRET WITH AI
    `;
}

function summarizeFrequencyProfile(data) {
    const lowFreq = data.slice(0, data.length / 3).reduce((a, b) => a + b, 0) / (data.length / 3);
    const midFreq = data.slice(data.length / 3, 2 * data.length / 3).reduce((a, b) => a + b, 0) / (data.length / 3);
    const highFreq = data.slice(2 * data.length / 3).reduce((a, b) => a + b, 0) / (data.length / 3);
    
    return `Low: ${lowFreq.toFixed(0)}, Mid: ${midFreq.toFixed(0)}, High: ${highFreq.toFixed(0)}`;
}

function generateFallbackInterpretation(data) {
    const interpretations = [
        `This ${data.type} signal exhibits ${data.hasRegularPattern ? 'a remarkably regular pattern' : 'chaotic characteristics'} with ${data.peakCount} distinct frequency peaks. The deviation of ${data.deviation?.toFixed(1) || 'significant magnitude'} from baseline suggests this is not typical environmental noise. The frequency distribution pattern is ${data.hasRegularPattern ? 'consistent with modulated carrier wave theory' : 'more consistent with natural phenomena, though the timing is intriguing'}. Further monitoring recommended.`,
        
        `Analysis indicates this signal contains ${data.peakCount} primary frequency components with ${data.hasRegularPattern ? 'mathematically regular intervals' : 'non-uniform spacing'}. The overall deviation strength of ${data.deviation?.toFixed(1) || 'notable intensity'} warrants continued observation. ${data.hasRegularPattern ? 'The pattern regularity is statistically significant and merits deeper investigation.' : 'While the pattern appears natural, we cannot rule out intentional complexity masking.'} Signal archived for cross-reference.`,
        
        `Detected anomaly presents ${data.hasRegularPattern ? 'structured characteristics potentially indicative of artificial origin' : 'complex waveform patterns'}. With ${data.peakCount} frequency peaks and baseline deviation of ${data.deviation?.toFixed(1) || 'significant levels'}, this signal ${data.hasRegularPattern ? 'demonstrates the hallmarks of intentional transmission' : 'requires additional captures for pattern confirmation'}. Recommend sustained monitoring of this frequency range.`
    ];
    
    return interpretations[Math.floor(Math.random() * interpretations.length)];
}

// ============================================
// TRANSMIT SECTION
// ============================================

function setupTransmit() {
    // Character counter
    dom.transmitMessage.addEventListener('input', () => {
        dom.charCount.textContent = dom.transmitMessage.value.length;
        updateTransmitPreview();
    });
    
    // Encoding options
    dom.encodingOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            dom.encodingOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            updateTransmitPreview();
        });
    });
    
    // Transmit button
    dom.beginTransmit.addEventListener('click', beginTransmission);
    
    // Initial preview
    updateTransmitPreview();
}

function updateTransmitPreview() {
    const canvas = dom.transmitPreview;
    const ctx = previewCtx;
    const message = dom.transmitMessage.value || 'HELLO COSMOS';
    const encoding = document.querySelector('.encoding-option.active').dataset.encoding;
    
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 80;
    
    ctx.fillStyle = '#131926';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Generate encoded preview based on method
    let encodedData;
    switch (encoding) {
        case 'binary':
            encodedData = encodeBinary(message);
            break;
        case 'frequency':
            encodedData = encodeFrequency(message);
            break;
        case 'morse':
            encodedData = encodeMorse(message);
            break;
    }
    
    // Draw preview
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const stepWidth = canvas.width / encodedData.length;
    
    for (let i = 0; i < encodedData.length; i++) {
        const x = i * stepWidth;
        const y = canvas.height / 2 + (encodedData[i] * canvas.height * 0.4);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Grid
    ctx.strokeStyle = 'rgba(30, 42, 58, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

function encodeBinary(message) {
    const binary = message.split('').map(char => 
        char.charCodeAt(0).toString(2).padStart(8, '0')
    ).join('');
    
    const data = [];
    for (let i = 0; i < binary.length; i++) {
        data.push(binary[i] === '1' ? 1 : -1);
        data.push(binary[i] === '1' ? 1 : -1);
    }
    return data;
}

function encodeFrequency(message) {
    const data = [];
    for (let i = 0; i < message.length; i++) {
        const freq = (message.charCodeAt(i) - 32) / 95; // Normalize to 0-1
        for (let j = 0; j < 20; j++) {
            data.push(Math.sin(j * freq * Math.PI * 2) * (freq + 0.2));
        }
    }
    return data;
}

function encodeMorse(message) {
    const morse = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', ' ': ' ',
        '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
        '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
    };
    
    const data = [];
    const upperMessage = message.toUpperCase();
    
    for (let i = 0; i < upperMessage.length; i++) {
        const code = morse[upperMessage[i]] || '';
        for (let j = 0; j < code.length; j++) {
            if (code[j] === '.') {
                data.push(1, 1, 0);
            } else if (code[j] === '-') {
                data.push(1, 1, 1, 1, 1, 0);
            }
        }
        data.push(0, 0, 0); // Letter gap
    }
    
    return data.map(v => v * 2 - 1);
}

async function beginTransmission() {
    const message = dom.transmitMessage.value;
    if (!message.trim()) {
        showToast('error', 'Please enter a message to transmit');
        return;
    }
    
    const encoding = document.querySelector('.encoding-option.active').dataset.encoding;
    
    // Show transmit status
    dom.transmitStatus.classList.remove('hidden');
    dom.beginTransmit.disabled = true;
    
    addLogEntry('transmit', `Initiating transmission: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    showToast('info', 'Transmission started');
    
    // Create audio context for transmission
    state.transmitAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
        await transmitAudio(message, encoding);
        
        state.totalTransmits++;
        dom.totalTransmitsEl.textContent = state.totalTransmits;
        
        addLogEntry('transmit', 'Transmission complete');
        showToast('success', 'Message transmitted successfully');
    } catch (err) {
        console.error('Transmission failed:', err);
        addLogEntry('error', 'Transmission failed: ' + err.message);
        showToast('error', 'Transmission failed');
    }
    
    // Reset UI
    dom.transmitStatus.classList.add('hidden');
    dom.beginTransmit.disabled = false;
    dom.transmitProgress.style.width = '0%';
}

async function transmitAudio(message, encoding) {
    const ctx = state.transmitAudioContext;
    const sampleRate = ctx.sampleRate;
    
    let audioData;
    const duration = Math.min(message.length * 0.1, 10); // Max 10 seconds
    
    switch (encoding) {
        case 'binary':
            audioData = generateBinaryAudio(message, sampleRate, duration);
            break;
        case 'frequency':
            audioData = generateFrequencyAudio(message, sampleRate, duration);
            break;
        case 'morse':
            audioData = generateMorseAudio(message, sampleRate, duration);
            break;
    }
    
    const buffer = ctx.createBuffer(1, audioData.length, sampleRate);
    buffer.getChannelData(0).set(audioData);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // Animate progress
    const startTime = Date.now();
    const totalDuration = duration * 1000;
    
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalDuration * 100, 100);
        dom.transmitProgress.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(progressInterval);
        }
    }, 50);
    
    source.start();
    
    return new Promise(resolve => {
        setTimeout(resolve, totalDuration);
    });
}

function generateBinaryAudio(message, sampleRate, duration) {
    const samples = Math.floor(sampleRate * duration);
    const data = new Float32Array(samples);
    const binary = encodeBinary(message);
    const samplesPerBit = Math.floor(samples / binary.length);
    
    for (let i = 0; i < binary.length; i++) {
        const freq = binary[i] > 0 ? 1200 : 800;
        for (let j = 0; j < samplesPerBit; j++) {
            const sampleIndex = i * samplesPerBit + j;
            if (sampleIndex < samples) {
                data[sampleIndex] = Math.sin(2 * Math.PI * freq * sampleIndex / sampleRate) * 0.3;
            }
        }
    }
    
    return data;
}

function generateFrequencyAudio(message, sampleRate, duration) {
    const samples = Math.floor(sampleRate * duration);
    const data = new Float32Array(samples);
    const samplesPerChar = Math.floor(samples / message.length);
    
    for (let i = 0; i < message.length; i++) {
        const freq = 200 + (message.charCodeAt(i) - 32) * 20;
        for (let j = 0; j < samplesPerChar; j++) {
            const sampleIndex = i * samplesPerChar + j;
            if (sampleIndex < samples) {
                const envelope = Math.sin(Math.PI * j / samplesPerChar);
                data[sampleIndex] = Math.sin(2 * Math.PI * freq * sampleIndex / sampleRate) * 0.3 * envelope;
            }
        }
    }
    
    return data;
}

function generateMorseAudio(message, sampleRate, duration) {
    const samples = Math.floor(sampleRate * duration);
    const data = new Float32Array(samples);
    const morseData = encodeMorse(message);
    const samplesPerUnit = Math.floor(samples / morseData.length);
    const freq = 700;
    
    for (let i = 0; i < morseData.length; i++) {
        if (morseData[i] > 0) {
            for (let j = 0; j < samplesPerUnit; j++) {
                const sampleIndex = i * samplesPerUnit + j;
                if (sampleIndex < samples) {
                    data[sampleIndex] = Math.sin(2 * Math.PI * freq * sampleIndex / sampleRate) * 0.3;
                }
            }
        }
    }
    
    return data;
}

// ============================================
// LOG SECTION
// ============================================

function setupLog() {
    // Filter buttons
    dom.logFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            dom.logFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            filterLog(filter.dataset.filter);
        });
    });
    
    // Clear button
    dom.clearLog.addEventListener('click', () => {
        dom.logEntries.innerHTML = '';
        addLogEntry('system', 'Log cleared');
    });
}

function addLogEntry(type, message) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${formatTime(Date.now())}</span>
        <span class="log-type">${type.toUpperCase()}</span>
        <span class="log-message">${message}</span>
    `;
    
    dom.logEntries.insertBefore(entry, dom.logEntries.firstChild);
    
    // Keep only last 100 entries
    while (dom.logEntries.children.length > 100) {
        dom.logEntries.removeChild(dom.logEntries.lastChild);
    }
}

function filterLog(filter) {
    const entries = dom.logEntries.querySelectorAll('.log-entry');
    entries.forEach(entry => {
        if (filter === 'all' || entry.classList.contains(filter)) {
            entry.style.display = '';
        } else {
            entry.style.display = 'none';
        }
    });
}

// ============================================
// UTILITIES
// ============================================

function updateSensorCard(card, active, error = false) {
    card.classList.toggle('active', active);
    card.classList.toggle('error', error);
    card.querySelector('.sensor-state').textContent = error ? 'UNAVAILABLE' : (active ? 'ACTIVE' : 'INACTIVE');
}

function updateScanTimer() {
    if (!state.isScanning) return;
    
    const elapsed = Date.now() - state.scanStartTime;
    dom.scanTime.textContent = formatTime(elapsed);
    
    requestAnimationFrame(updateScanTimer);
}

function updateSessionStats() {
    dom.totalScanTimeEl.textContent = formatTime(state.totalScanTime);
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
}

function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getUserLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.location = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                dom.userCoords.textContent = `${state.location.lat.toFixed(4)}°N, ${Math.abs(state.location.lon).toFixed(4)}°W`;
                addLogEntry('system', `Location acquired: ${state.location.lat.toFixed(4)}, ${state.location.lon.toFixed(4)}`);
            },
            (error) => {
                dom.userCoords.textContent = 'LOCATION UNAVAILABLE';
                addLogEntry('system', 'Location access denied or unavailable');
            }
        );
    } else {
        dom.userCoords.textContent = 'GEOLOCATION NOT SUPPORTED';
    }
}

function checkDeviceCapabilities() {
    const capabilities = [];
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        capabilities.push('AUDIO');
    }
    if ('Magnetometer' in window) {
        capabilities.push('MAG');
    }
    if ('Accelerometer' in window || 'DeviceMotionEvent' in window) {
        capabilities.push('MOTION');
    }
    if ('AmbientLightSensor' in window) {
        capabilities.push('LIGHT');
    }
    
    dom.deviceInfo.textContent = capabilities.length > 0 ? 
        `SENSORS: ${capabilities.join(' | ')}` : 
        'LIMITED SENSOR ACCESS';
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
        error: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        anomaly: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'
    };
    
    toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${icons[type]}
        </svg>
        <span class="toast-message">${message}</span>
    `;
    
    dom.toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// SERVICE WORKER REGISTRATION (PWA)
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', init);card-header">
                <span class="signal-id">SIG-${anomaly.id.toUpperCase()}</span>
                <span class="signal-time">${formatTimestamp(anomaly.timestamp)}</span>
            </div>
            <div class="signal-preview">
                <canvas class="signal-mini-canvas" data-anomaly="${anomaly.id}"></canvas>
            </div>
            <div class="signal-meta">
                <div class="signal-meta-item">
                    <span class="meta-label">TYPE</span>
                    <span class="meta-value">${anomaly.type}</span>
                </div>
                <div class="signal-meta-item">
                    <span class="meta-label">STRENGTH</span>
                    <span class="meta-value">${anomaly.data.deviation ? anomaly.data.deviation.toFixed(1) : 'N/A'}</span>
                </div>
                <div class="signal-meta-item">
                    <span class="meta-label">PATTERN</span>
                    <span class="meta-value">${anomaly.data.hasPattern ? 'DETECTED' : 'CHAOTIC'}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    state.anomalies.forEach(anomaly => {
        const canvas = document.querySelector(`canvas[data-anomaly="${anomaly.id}"]`);
        if (canvas && anomaly.data.frequencyData) {
            drawMiniVisualization(canvas, anomaly.data.frequencyData);
        }
    });
    
    document.querySelectorAll('.signal-card').forEach(card => {
        card.addEventListener('click', () => openSignalAnalysis(card.dataset.id));
    });
}

function drawMiniVisualization(canvas, data) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#0f1422';
    ctx.fillRect(0, 0, width, height);
    if (!data || data.length === 0) return;
    
    const step = Math.floor(data.length / width) || 1;
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
        const i = Math.floor(x * step);
        const y = height - (data[i] / 255) * height;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// ============================================
// SIGNAL ANALYSIS
// ============================================

function setupSignals() {
    dom.closeAnalysis.addEventListener('click', closeSignalAnalysis);
    dom.interpretSignal.addEventListener('click', interpretSelectedSignal);
}

function openSignalAnalysis(id) {
    const anomaly = state.anomalies.find(a => a.id === id);
    if (!anomaly) return;
    
    state.selectedSignal = anomaly;
    dom.analysisPanel.classList.remove('hidden');
    drawDetailedVisualization(anomaly);
    
    dom.analysisData.innerHTML = `
        <div class="data-item"><span class="data-label">SIGNAL ID</span><span class="data-value">SIG-${anomaly.id.toUpperCase()}</span></div>
        <div class="data-item"><span class="data-label">TIMESTAMP</span><span class="data-value">${new Date(anomaly.timestamp).toISOString()}</span></div>
        <div class="data-item"><span class="data-label">TYPE</span><span class="data-value">${anomaly.type}</span></div>
        <div class="data-item"><span class="data-label">DEVIATION</span><span class="data-value">${anomaly.data.deviation?.toFixed(2) || 'N/A'}</span></div>
        <div class="data-item"><span class="data-label">PEAK COUNT</span><span class="data-value">${anomaly.data.peaks?.length || 0}</span></div>
        <div class="data-item"><span class="data-label">PATTERN</span><span class="data-value">${anomaly.data.hasPattern ? 'STRUCTURED' : 'RANDOM'}</span></div>
    `;
    
    dom.interpretationResult.classList.add('hidden');
}

function closeSignalAnalysis() {
    dom.analysisPanel.classList.add('hidden');
    state.selectedSignal = null;
}

function drawDetailedVisualization(anomaly) {
    const canvas = dom.signalDetailCanvas;
    const ctx = detailCtx;
    canvas.width = canvas.parentElement.offsetWidth || 300;
    canvas.height = 150;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#131926';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(30, 42, 58, 0.5)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    if (anomaly.data.frequencyData) {
        const data = anomaly.data.frequencyData;
        const barWidth = width / data.length;
        
        for (let i = 0; i < data.length; i++) {
            const barHeight = (data[i] / 255) * height * 0.9;
            const hue = (i / data.length) * 60 + 160;
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
            ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
        }
        
        if (anomaly.data.peaks) {
            ctx.fillStyle = '#ff3366';
            anomaly.data.peaks.forEach(peak => {
                const x = (peak.index / data.length) * width;
                ctx.beginPath();
                ctx.arc(x, height - (peak.value / 255) * height, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }
}

async function interpretSelectedSignal() {
    if (!state.selectedSignal) return;
    
    const anomaly = state.selectedSignal;
    dom.interpretSignal.disabled = true;
    dom.interpretSignal.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10"/></svg> ANALYZING...`;
    
    addLogEntry('system', `Initiating AI interpretation of signal SIG-${anomaly.id.toUpperCase()}`);
    
    const signalProfile = {
        type: anomaly.type,
        timestamp: anomaly.timestamp,
        deviation: anomaly.data.deviation,
        peakCount: anomaly.data.peaks?.length || 0,
        hasPattern: anomaly.data.hasPattern,
        frequencyProfile: anomaly.data.frequencyData ? summarizeFrequencyData(anomaly.data.frequencyData) : null
    };
    
    try {
        const interpretation = await callClaudeAPI(signalProfile);
        dom.interpretationResult.innerHTML = `<h4>AI INTERPRETATION</h4><p>${interpretation}</p>`;
        dom.interpretationResult.classList.remove('hidden');
        addLogEntry('signal', `Interpretation complete for SIG-${anomaly.id.toUpperCase()}`);
    } catch (error) {
        const fallbackInterpretation = generateLocalInterpretation(signalProfile);
        dom.interpretationResult.innerHTML = `<h4>SIGNAL ANALYSIS</h4><p>${fallbackInterpretation}</p>`;
        dom.interpretationResult.classList.remove('hidden');
    }
    
    dom.interpretSignal.disabled = false;
    dom.interpretSignal.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> INTERPRET WITH AI`;
}

function summarizeFrequencyData(data) {
    const low = data.slice(0, Math.floor(data.length * 0.33));
    const mid = data.slice(Math.floor(data.length * 0.33), Math.floor(data.length * 0.66));
    const high = data.slice(Math.floor(data.length * 0.66));
    return {
        lowFreqAvg: low.reduce((a, b) => a + b, 0) / low.length,
        midFreqAvg: mid.reduce((a, b) => a + b, 0) / mid.length,
        highFreqAvg: high.reduce((a, b) => a + b, 0) / high.length,
        dominantBand: low.reduce((a, b) => a + b, 0) > high.reduce((a, b) => a + b, 0) ? 'LOW' : 'HIGH'
    };
}

async function callClaudeAPI(signalProfile) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': window.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages: [{
                role: 'user',
                content: `You are analyzing potential extraterrestrial signals detected by CosmicLink. Analyze this signal and provide a brief, intriguing interpretation. Be creative but scientific-sounding.

Type: ${signalProfile.type}
Deviation: ${signalProfile.deviation?.toFixed(2)}
Peak count: ${signalProfile.peakCount}
Pattern: ${signalProfile.hasPattern ? 'Regular spacing - possible intentional structure' : 'No clear pattern'}
Dominant band: ${signalProfile.frequencyProfile?.dominantBand || 'Unknown'}

Provide a 2-3 sentence interpretation. Be mysterious but not absurd.`
            }]
        })
    });
    
    if (!response.ok) throw new Error('API call failed');
    const data = await response.json();
    return data.content[0].text;
}

function generateLocalInterpretation(profile) {
    const interpretations = [
        `Signal exhibits ${profile.hasPattern ? 'structured periodicity suggesting artificial origin' : 'chaotic variance typical of natural phenomena'}. ${profile.peakCount > 2 ? `The ${profile.peakCount} distinct frequency peaks warrant further monitoring.` : 'Continued observation recommended.'}`,
        `Analysis indicates a ${profile.deviation > 40 ? 'significant' : 'moderate'} deviation from baseline. ${profile.frequencyProfile?.dominantBand === 'LOW' ? 'Low frequency dominance is consistent with deep-space signal propagation.' : 'High frequency components suggest a proximate or high-energy source.'}`,
        `${profile.type} anomaly with ${profile.hasPattern ? 'mathematical regularity defying random noise' : 'stochastic distribution'}. Signal strength of ${profile.deviation?.toFixed(1)} exceeds threshold. ${profile.peakCount >= 3 ? 'Multiple harmonic peaks detected - possible carrier wave.' : 'Source classification: uncertain.'}`,
        `Spectral analysis reveals ${profile.hasPattern ? 'non-random energy distribution' : 'broadband noise characteristics'}. The ${profile.deviation > 30 ? 'pronounced' : 'subtle'} deviation could indicate ${profile.peakCount > 3 ? 'an information-bearing signal' : 'environmental interference or exotic phenomena'}.`
    ];
    return interpretations[Math.floor(Math.random() * interpretations.length)];
}

// ============================================
// TRANSMIT
// ============================================

function setupTransmit() {
    dom.transmitMessage.addEventListener('input', () => {
        dom.charCount.textContent = dom.transmitMessage.value.length;
        updateTransmitPreview();
    });
    
    dom.encodingOptions.forEach(option => {
        option.addEventListener('click', () => {
            dom.encodingOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            updateTransmitPreview();
        });
    });
    
    dom.beginTransmit.addEventListener('click', beginTransmission);
    updateTransmitPreview();
}

function updateTransmitPreview() {
    const message = dom.transmitMessage.value || 'Hello Cosmos';
    const encoding = document.querySelector('.encoding-option.active').dataset.encoding;
    
    const canvas = dom.transmitPreview;
    const ctx = previewCtx;
    canvas.width = canvas.parentElement.offsetWidth || 300;
    canvas.height = 80;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#131926';
    ctx.fillRect(0, 0, width, height);
    
    switch (encoding) {
        case 'binary': drawBinaryPreview(ctx, textToBinary(message), width, height); break;
        case 'frequency': drawFrequencyPreview(ctx, textToFrequencies(message), width, height); break;
        case 'morse': drawMorsePreview(ctx, textToMorse(message), width, height); break;
    }
}

function textToBinary(text) {
    return text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('');
}

function textToFrequencies(text) {
    return text.split('').map(char => 200 + (char.charCodeAt(0) * 20));
}

function textToMorse(text) {
    const morseMap = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', ' ': '/', '0': '-----', '1': '.----',
        '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....',
        '7': '--...', '8': '---..', '9': '----.'
    };
    return text.toUpperCase().split('').map(char => morseMap[char] || '').join(' ');
}

function drawBinaryPreview(ctx, binary, width, height) {
    const bitWidth = width / Math.min(binary.length, 100);
    for (let i = 0; i < Math.min(binary.length, 100); i++) {
        ctx.fillStyle = binary[i] === '1' ? '#00d4ff' : '#1e2a3a';
        ctx.fillRect(i * bitWidth, 10, bitWidth - 1, height - 20);
    }
}

function drawFrequencyPreview(ctx, frequencies, width, height) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const segmentWidth = width / frequencies.length;
    frequencies.forEach((freq, i) => {
        const normalizedFreq = (freq - 200) / 2500;
        const y = height - (normalizedFreq * (height - 20)) - 10;
        if (i === 0) ctx.moveTo(i * segmentWidth, y);
        else ctx.lineTo(i * segmentWidth, y);
    });
    ctx.stroke();
}

function drawMorsePreview(ctx, morse, width, height) {
    const unitWidth = width / Math.max(morse.length * 2, 50);
    let x = 0;
    morse.split('').forEach(symbol => {
        if (symbol === '.') {
            ctx.fillStyle = '#7b2fff';
            ctx.fillRect(x, height / 2 - 5, unitWidth, 10);
            x += unitWidth * 2;
        } else if (symbol === '-') {
            ctx.fillStyle = '#7b2fff';
            ctx.fillRect(x, height / 2 - 5, unitWidth * 3, 10);
            x += unitWidth * 4;
        } else if (symbol === ' ') {
            x += unitWidth * 2;
        } else if (symbol === '/') {
            x += unitWidth * 4;
        }
    });
}

async function beginTransmission() {
    const message = dom.transmitMessage.value;
    if (!message.trim()) {
        showToast('error', 'Please enter a message to transmit');
        return;
    }
    
    const encoding = document.querySelector('.encoding-option.active').dataset.encoding;
    dom.beginTransmit.disabled = true;
    dom.transmitStatus.classList.remove('hidden');
    
    addLogEntry('transmit', `Initiating transmission: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    showToast('info', 'Transmission in progress...');
    
    state.transmitAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
        switch (encoding) {
            case 'binary': await transmitBinary(message); break;
            case 'frequency': await transmitFrequency(message); break;
            case 'morse': await transmitMorse(message); break;
        }
        
        state.totalTransmits++;
        dom.totalTransmitsEl.textContent = state.totalTransmits;
        addLogEntry('transmit', 'Transmission complete');
        showToast('success', 'Message transmitted successfully!');
    } catch (error) {
        addLogEntry('error', 'Transmission failed: ' + error.message);
        showToast('error', 'Transmission failed');
    }
    
    dom.beginTransmit.disabled = false;
    dom.transmitStatus.classList.add('hidden');
    dom.transmitProgress.style.width = '0%';
}

async function transmitBinary(message) {
    const binary = textToBinary(message);
    const bitDuration = 50;
    for (let i = 0; i < binary.length; i++) {
        dom.transmitProgress.style.width = `${((i + 1) / binary.length) * 100}%`;
        if (binary[i] === '1') playTone(1000, bitDuration);
        await sleep(bitDuration);
    }
}

async function transmitFrequency(message) {
    const frequencies = textToFrequencies(message);
    const charDuration = 150;
    for (let i = 0; i < frequencies.length; i++) {
        dom.transmitProgress.style.width = `${((i + 1) / frequencies.length) * 100}%`;
        playTone(frequencies[i], charDuration * 0.8);
        await sleep(charDuration);
    }
}

async function transmitMorse(message) {
    const morse = textToMorse(message);
    const unitDuration = 80;
    const frequency = 700;
    
    let totalUnits = morse.split('').reduce((acc, s) => {
        if (s === '.') return acc + 2;
        if (s === '-') return acc + 4;
        if (s === ' ') return acc + 2;
        if (s === '/') return acc + 4;
        return acc;
    }, 0);
    
    let currentUnit = 0;
    for (const symbol of morse) {
        if (symbol === '.') {
            playTone(frequency, unitDuration);
            await sleep(unitDuration * 2);
            currentUnit += 2;
        } else if (symbol === '-') {
            playTone(frequency, unitDuration * 3);
            await sleep(unitDuration * 4);
            currentUnit += 4;
        } else if (symbol === ' ') {
            await sleep(unitDuration * 2);
            currentUnit += 2;
        } else if (symbol === '/') {
            await sleep(unitDuration * 4);
            currentUnit += 4;
        }
        dom.transmitProgress.style.width = `${(currentUnit / totalUnits) * 100}%`;
    }
}

function playTone(frequency, duration) {
    const ctx = state.transmitAudioContext;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
}

// ============================================
// LOG
// ============================================

function setupLog() {
    dom.clearLog.addEventListener('click', clearLog);
    dom.logFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            dom.logFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            filterLog(filter.dataset.filter);
        });
    });
}

function addLogEntry(type, message) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${formatTime(Date.now())}</span>
        <span class="log-type">${type.toUpperCase()}</span>
        <span class="log-message">${message}</span>
    `;
    dom.logEntries.insertBefore(entry, dom.logEntries.firstChild);
    while (dom.logEntries.children.length > 100) {
        dom.logEntries.removeChild(dom.logEntries.lastChild);
    }
}

function clearLog() {
    dom.logEntries.innerHTML = '';
    addLogEntry('system', 'Log cleared');
}

function filterLog(filter) {
    const entries = dom.logEntries.querySelectorAll('.log-entry');
    entries.forEach(entry => {
        entry.style.display = (filter === 'all' || entry.classList.contains(filter)) ? '' : 'none';
    });
}

// ============================================
// UTILITIES
// ============================================

function updateSensorCard(card, active, error = false) {
    card.classList.toggle('active', active);
    card.classList.toggle('error', error);
    card.querySelector('.sensor-state').textContent = error ? 'UNAVAILABLE' : (active ? 'ACTIVE' : 'INACTIVE');
}

function updateScanTimer() {
    if (!state.isScanning) return;
    const elapsed = Date.now() - state.scanStartTime;
    dom.scanTime.textContent = formatDuration(elapsed);
    requestAnimationFrame(updateScanTimer);
}

function updateSessionStats() {
    dom.totalScanTimeEl.textContent = formatDuration(state.totalScanTime);
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return [hours.toString().padStart(2, '0'), (minutes % 60).toString().padStart(2, '0'), (seconds % 60).toString().padStart(2, '0')].join(':');
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false });
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function generateId() {
    return Math.random().toString(36).substring(2, 8);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getUserLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.location = { lat: position.coords.latitude, lon: position.coords.longitude };
                dom.userCoords.textContent = `${state.location.lat.toFixed(4)}°N, ${Math.abs(state.location.lon).toFixed(4)}°${state.location.lon < 0 ? 'W' : 'E'}`;
                addLogEntry('system', `Location acquired: ${state.location.lat.toFixed(4)}°, ${state.location.lon.toFixed(4)}°`);
            },
            () => {
                dom.userCoords.textContent = 'LOCATION UNAVAILABLE';
                addLogEntry('system', 'Location services unavailable');
            }
        );
    }
}

function checkDeviceCapabilities() {
    const capabilities = [];
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) capabilities.push('AUDIO');
    if ('Magnetometer' in window) capabilities.push('MAG');
    if ('Accelerometer' in window || 'DeviceMotionEvent' in window) capabilities.push('MOTION');
    if ('AmbientLightSensor' in window) capabilities.push('LIGHT');
    dom.deviceInfo.textContent = capabilities.length > 0 ? `SENSORS: ${capabilities.join(' | ')}` : 'LIMITED SENSOR ACCESS';
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: '<path d="M20 6L9 17l-5-5"/>',
        error: '<path d="M18 6L6 18M6 6l12 12"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        anomaly: '<path d="M12 2L2 19h20L12 2zM12 16v.01M12 10v3"/>'
    };
    toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[type]}</svg>
        <span class="toast-message">${message}</span>
    `;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', init);
