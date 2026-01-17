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
        light: { active: false, sensor: null },
        radiation: { active: false, stream: null, hits: 0, lastFrame: null }
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

// ============================================
// INITIALIZATION
// ============================================

function init() {
    console.log('CosmicLink initializing...');
    
    // Get DOM references
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
        ultrasonicIndicator: document.getElementById('ultrasonicIndicator'),
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
        radiationSensor: document.getElementById('radiationSensor'),
        radiationLevel: document.getElementById('radiationLevel'),
        radiationReading: document.getElementById('radiationReading'),
        radiationVideo: document.getElementById('radiationVideo'),
        radiationCanvas: document.getElementById('radiationCanvas'),
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
    
    // Initialize canvas contexts
    freqCtx = dom.frequencyCanvas.getContext('2d');
    detailCtx = dom.signalDetailCanvas.getContext('2d');
    previewCtx = dom.transmitPreview.getContext('2d');
    
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    
    // Setup event listeners
    setupNavigation();
    setupScanner();
    setupSignals();
    setupTransmit();
    setupLog();
    
    // Get user location
    getUserLocation();
    
    // Check device capabilities
    checkDeviceCapabilities();
    
    // Log initialization
    addLogEntry('system', 'CosmicLink v1.0 initialized. All systems nominal.');
    addLogEntry('system', 'Sensor array configured. Awaiting scan command.');
    
    // Start idle visualization
    drawIdleVisualization();
    
    console.log('CosmicLink ready!');
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
    
    // Update UI
    dom.masterScan.classList.add('active');
    dom.masterScan.querySelector('.scan-button-text').textContent = 'SCANNING...';
    dom.masterScan.querySelector('.scan-icon').innerHTML = '<rect x="6" y="6" width="12" height="12"/>';
    dom.vizPrimary.classList.add('scanning');
    dom.statusDot.classList.add('active');
    dom.statusText.textContent = 'SCANNING';
    
    addLogEntry('system', 'Initiating multi-spectrum scan sequence...');
    showToast('info', 'Scan initiated - activating sensors');
    
    // Start all available sensors
    await initAudioCapture();
    await initMagnetometer();
    await initMotionSensor();
    await initLightSensor();
    await initRadiationDetector();
    
    // Start visualization loop
    requestAnimationFrame(visualizationLoop);
    
    // Start scan timer
    updateScanTimer();
    
    // Start anomaly detection
    startAnomalyDetection();
}

function stopScan() {
    state.isScanning = false;
    const scanDuration = Date.now() - state.scanStartTime;
    state.totalScanTime += scanDuration;
    
    // Update UI
    dom.masterScan.classList.remove('active');
    dom.masterScan.querySelector('.scan-button-text').textContent = 'INITIATE SCAN';
    dom.masterScan.querySelector('.scan-icon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    dom.vizPrimary.classList.remove('scanning');
    dom.statusDot.classList.remove('active');
    dom.statusText.textContent = 'STANDBY';
    
    // Stop sensors
    stopAllSensors();
    
    // Update stats
    updateSessionStats();
    
    addLogEntry('system', `Scan terminated. Duration: ${formatTime(scanDuration)}`);
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
    if (state.sensors.radiation.stream) {
        state.sensors.radiation.stream.getTracks().forEach(track => track.stop());
        state.sensors.radiation.active = false;
        updateSensorCard(dom.radiationSensor, false);
    }
}

// ============================================
// AUDIO CAPTURE
// ============================================

async function initAudioCapture() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = state.audioContext.createMediaStreamSource(stream);
        const analyser = state.audioContext.createAnalyser();
        
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        state.sensors.audio = {
            active: true,
            stream: stream,
            analyser: analyser,
            dataArray: dataArray
        };
        
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
            
            sensor.addEventListener('error', (e) => {
                console.error('Magnetometer error:', e);
                updateSensorCard(dom.magSensor, false, true);
            });
            
            sensor.start();
            state.sensors.magnetometer = { active: true, sensor: sensor };
            updateSensorCard(dom.magSensor, true);
            addLogEntry('system', 'Magnetometer online. Monitoring EM field fluctuations.');
            
        } catch (err) {
            console.error('Magnetometer init failed:', err);
            updateSensorCard(dom.magSensor, false, true);
            addLogEntry('system', 'Magnetometer unavailable on this device');
        }
    } else {
        updateSensorCard(dom.magSensor, false, true);
        addLogEntry('system', 'Magnetometer not supported on this device');
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
                if (permission !== 'granted') {
                    throw new Error('Motion permission denied');
                }
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
            state.sensors.motion = { active: true, sensor: sensor };
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
        state.sensors.motion = { 
            active: true, 
            sensor: { stop: () => window.removeEventListener('devicemotion', handler) }
        };
        updateSensorCard(dom.motionSensor, true);
        addLogEntry('system', 'Motion sensor online (fallback mode).');
    } else {
        updateSensorCard(dom.motionSensor, false, true);
        addLogEntry('system', 'Motion sensor not supported on this device');
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
            state.sensors.light = { active: true, sensor: sensor };
            updateSensorCard(dom.lightSensor, true);
            addLogEntry('system', 'Ambient light sensor online.');
            
        } catch (err) {
            console.error('Light sensor init failed:', err);
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
// COSMIC RAY / RADIATION DETECTOR
// Uses camera sensor in darkness to detect particle hits
// ============================================

let radiationAnimationId = null;
let radiationCtx = null;

async function initRadiationDetector() {
    try {
        // Request back camera (better for radiation detection)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 320 },
                height: { ideal: 240 }
            }
        });
        
        const video = dom.radiationVideo;
        const canvas = dom.radiationCanvas;
        
        video.srcObject = stream;
        await video.play();
        
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        radiationCtx = canvas.getContext('2d', { willReadFrequently: true });
        
        state.sensors.radiation = {
            active: true,
            stream: stream,
            hits: 0,
            lastFrame: null,
            totalHits: 0
        };
        
        updateSensorCard(dom.radiationSensor, true);
        addLogEntry('system', 'Cosmic ray detector online. Cover camera lens for best results.');
        showToast('info', 'Cover your camera lens for cosmic ray detection');
        
        // Start detection loop
        detectRadiation();
        
    } catch (err) {
        console.error('Radiation detector init failed:', err);
        updateSensorCard(dom.radiationSensor, false, true);
        addLogEntry('system', 'Camera unavailable for cosmic ray detection');
    }
}

function detectRadiation() {
    if (!state.isScanning || !state.sensors.radiation.active) {
        return;
    }
    
    const video = dom.radiationVideo;
    const canvas = dom.radiationCanvas;
    const ctx = radiationCtx;
    
    if (!ctx || !video.videoWidth) {
        radiationAnimationId = requestAnimationFrame(detectRadiation);
        return;
    }
    
    // Capture current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = currentFrame.data;
    
    let hits = 0;
    const threshold = 80; // Brightness threshold for a "hit" (increased from 60)
    const clusterThreshold = 5; // Minimum bright pixels for a valid hit (increased from 3)
    
    // Look for bright pixel clusters (cosmic ray signature)
    const brightPixels = [];
    
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        
        if (brightness > threshold) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            brightPixels.push({ x, y, brightness });
        }
    }
    
    // Cluster detection - look for groups of bright pixels
    if (state.sensors.radiation.lastFrame) {
        const lastPixels = state.sensors.radiation.lastFrame.data;
        
        for (const pixel of brightPixels) {
            const idx = (pixel.y * canvas.width + pixel.x) * 4;
            const lastBrightness = (lastPixels[idx] + lastPixels[idx + 1] + lastPixels[idx + 2]) / 3;
            
            // Sudden bright flash that wasn't there before = potential hit
            if (pixel.brightness - lastBrightness > 40) {
                hits++;
            }
        }
    }
    
    // Update state
    state.sensors.radiation.lastFrame = currentFrame;
    state.sensors.radiation.hits = hits;
    state.sensors.radiation.totalHits += hits;
    
    // Update display
    updateRadiationDisplay(hits, state.sensors.radiation.totalHits);
    
    // Register anomaly for significant hits (rate limited to every 5 seconds)
    const now = Date.now();
    if (hits >= clusterThreshold) {
        if (!state.sensors.radiation.lastAnomalyTime || now - state.sensors.radiation.lastAnomalyTime > 5000) {
            console.log('Cosmic ray hit detected! Hits:', hits);
            registerAnomaly('COSMIC', {
                hits: hits,
                totalHits: state.sensors.radiation.totalHits,
                timestamp: now,
                hasPattern: hits > 8 // Multiple simultaneous hits is unusual
            });
            state.sensors.radiation.lastAnomalyTime = now;
        }
    }
    
    radiationAnimationId = requestAnimationFrame(detectRadiation);
}

function updateRadiationDisplay(hits, total) {
    const normalized = Math.min(hits / 10, 1);
    dom.radiationLevel.style.width = `${normalized * 100}%`;
    dom.radiationReading.textContent = `${total} hits`;
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
        
        // Check for ultrasonic activity (upper 20% of frequency range = above ~18kHz)
        const ultrasonicStart = Math.floor(dataArray.length * 0.8);
        let ultrasonicActivity = 0;
        for (let i = ultrasonicStart; i < dataArray.length; i++) {
            ultrasonicActivity += dataArray[i];
        }
        ultrasonicActivity /= (dataArray.length - ultrasonicStart);
        
        // Show ultrasonic indicator if activity detected above threshold
        if (ultrasonicActivity > 15) {
            dom.ultrasonicIndicator.classList.add('active');
            // Ultrasonic signals are especially interesting - could be non-human
            if (ultrasonicActivity > 30 && Math.random() < 0.3) {
                registerAnomaly('ULTRASONIC', {
                    deviation: ultrasonicActivity,
                    timestamp: Date.now(),
                    frequencyData: Array.from(dataArray),
                    hasPattern: true,
                    note: 'Signal detected above human hearing range (18kHz+)'
                });
            }
        } else {
            dom.ultrasonicIndicator.classList.remove('active');
        }
        
        const barWidth = (width / dataArray.length) * 2.5;
        let x = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * height * 0.8;
            // Color ultrasonic range differently (purple instead of cyan/green)
            const isUltrasonic = i >= ultrasonicStart;
            const hue = isUltrasonic ? 280 : (i / dataArray.length) * 60 + 160;
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
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    if (!state.isScanning) {
        requestAnimationFrame(drawIdleVisualization);
    }
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
        
        // Only register if significant AND rate limited (2 seconds between audio anomalies)
        const now = Date.now();
        if ((deviation > 20 || hasUnusualPattern) && 
            (!state.lastAudioAnomalyTime || now - state.lastAudioAnomalyTime > 2000)) {
            console.log('REGISTERING AUDIO ANOMALY - deviation:', deviation, 'pattern:', hasUnusualPattern);
            registerAnomaly('AUDIO', {
                deviation: deviation,
                peaks: peaks,
                timestamp: now,
                frequencyData: Array.from(dataArray),
                hasPattern: hasUnusualPattern
            });
            state.lastAudioAnomalyTime = now;
        }
    }
    
    if (state.sensors.magnetometer.active && baselineMag) {
        const current = state.sensors.magnetometer.lastReading;
        if (current) {
            const magDeviation = Math.abs(current - baselineMag);
            if (magDeviation > 5) {
                if (Math.random() < 0.1) {
                    registerAnomaly('EM', {
                        baseline: baselineMag,
                        current: current,
                        deviation: magDeviation,
                        timestamp: Date.now()
                    });
                }
            }
        }
    }
}

function findPeaks(data) {
    const peaks = [];
    const threshold = 100;
    
    for (let i = 2; i < data.length - 2; i++) {
        if (data[i] > threshold &&
            data[i] > data[i-1] && data[i] > data[i-2] &&
            data[i] > data[i+1] && data[i] > data[i+2]) {
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
    console.log('registerAnomaly called with type:', type);
    
    const anomaly = {
        id: generateId(),
        type: type,
        timestamp: data.timestamp,
        data: data,
        analyzed: false
    };
    
    state.anomalies.unshift(anomaly);
    state.totalAnomalies++;
    
    // Cap at 100 stored anomalies - remove oldest
    if (state.anomalies.length > 100) {
        state.anomalies = state.anomalies.slice(0, 100);
    }
    
    console.log('Total anomalies now:', state.anomalies.length);
    
    updateAnomalyDisplay();
    dom.anomalyCount.textContent = state.anomalies.length;
    dom.totalAnomaliesEl.textContent = state.totalAnomalies;
    
    addLogEntry('signal', `Anomaly detected: ${type} signal deviation at ${formatTimestamp(data.timestamp)}`);
    
    // Rate limit toasts - only show if last toast was more than 3 seconds ago
    const now = Date.now();
    if (!state.lastToastTime || now - state.lastToastTime > 3000) {
        showToast('anomaly', `Potential ${type} signal detected!`);
        state.lastToastTime = now;
    }
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
    
    if (anomaly.data.frequencyData) {
        drawDetailedVisualization(anomaly.data.frequencyData);
    }
    
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
    
    dom.interpretationResult.classList.add('hidden');
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
    
    const barWidth = canvas.width / data.length * 2.5;
    let x = 0;
    
    for (let i = 0; i < data.length && x < canvas.width; i++) {
        const barHeight = (data[i] / 255) * canvas.height * 0.9;
        const hue = (i / data.length) * 60 + 160;
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
    }
    
    drawGrid(ctx, canvas.width, canvas.height);
}

async function interpretCurrentSignal() {
    if (!state.selectedSignal) return;
    
    const anomaly = state.selectedSignal;
    
    dom.interpretSignal.disabled = true;
    dom.interpretSignal.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
        </svg>
        ANALYZING...
    `;
    
    addLogEntry('system', `Initiating AI interpretation of signal SIG-${anomaly.id}...`);
    
    const signalSummary = {
        type: anomaly.type,
        timestamp: new Date(anomaly.timestamp).toISOString(),
        deviation: anomaly.data.deviation,
        peakCount: anomaly.data.peaks?.length || 0,
        hasRegularPattern: anomaly.data.hasPattern,
        frequencyProfile: anomaly.data.frequencyData ? summarizeFrequencyProfile(anomaly.data.frequencyData) : null,
        note: anomaly.data.note || null,
        hits: anomaly.data.hits || null
    };
    
    // Build context based on signal type
    let typeContext = '';
    if (anomaly.type === 'ULTRASONIC') {
        typeContext = 'This signal was detected in the ULTRASONIC range (18-24kHz) - frequencies ABOVE human hearing. An intelligent species might choose this frequency range specifically because humans cannot perceive it directly.';
    } else if (anomaly.type === 'COSMIC') {
        typeContext = 'This signal was detected via cosmic ray/particle impacts on the camera sensor. High-energy particles from deep space struck the device. Some theories suggest advanced civilizations could encode information in directed particle beams.';
    } else if (anomaly.type === 'EM') {
        typeContext = 'This signal was detected via electromagnetic field fluctuations captured by the magnetometer. EM manipulation is a plausible method for interstellar communication.';
    } else {
        typeContext = 'This signal was detected in the audible/near-audible audio spectrum.';
    }
    
    try {
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
                    content: `You are ARIA (Anomaly Recognition & Interpretation Algorithm), the AI decoder for CosmicLink. Your job is to DECODE detected signals and provide a mysterious, intriguing interpretation as if you're translating an alien message.

${typeContext}

Signal Data:
- Type: ${signalSummary.type}
- Timestamp: ${signalSummary.timestamp}
- Deviation from baseline: ${signalSummary.deviation?.toFixed(2) || 'Unknown'}
- Peak frequencies detected: ${signalSummary.peakCount}
- Regular pattern detected: ${signalSummary.hasRegularPattern ? 'Yes' : 'No'}
- Frequency profile: ${signalSummary.frequencyProfile || 'N/A'}
${signalSummary.note ? `- Note: ${signalSummary.note}` : ''}
${signalSummary.hits ? `- Particle hits: ${signalSummary.hits}` : ''}

Your response MUST include these sections:

**SIGNAL CLASSIFICATION**: One line - classify this (e.g., "Class III Anomaly - Structured Carrier Wave" or "Class II - Patterned Particle Burst")

**DECODED CONTENT**: This is the key part. Based on the signal characteristics, provide a mysterious "translation" or interpretation of what the signal might be saying. Be creative and evocative. Examples:
- "Repeating pattern suggests: OBSERVATION CONFIRMED / PRESENCE NOTED"
- "Mathematical structure indicates: COORDINATES RECEIVED / AWAITING RESPONSE"
- "Particle sequence translates to: WE ARE HERE / CAN YOU HEAR"
Make it feel like an actual decoded message, not just analysis.

**CONFIDENCE ASSESSMENT**: One line with a percentage and brief note (e.g., "47% - Pattern structure suggests non-random origin")

**RECOMMENDATION**: One brief line about what the user should do (e.g., "Continue monitoring. Respond via TRANSMIT if desired.")

Keep it mysterious, exciting, and formatted exactly as above. Make the user feel like they've intercepted something extraordinary.`
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        const interpretation = data.content[0].text;
        
        dom.interpretationResult.innerHTML = `
            <h4>⟨ ARIA DECODE ⟩</h4>
            <div class="decode-content">${interpretation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>
        `;
        dom.interpretationResult.classList.remove('hidden');
        
        addLogEntry('signal', `ARIA decode complete for SIG-${anomaly.id}`);
        showToast('success', 'Signal decoded');
        
    } catch (err) {
        console.error('Interpretation failed:', err);
        
        const fallbackInterpretation = generateFallbackInterpretation(signalSummary);
        dom.interpretationResult.innerHTML = `
            <h4>⟨ ARIA DECODE ⟩</h4>
            <div class="decode-content">${fallbackInterpretation}</div>
        `;
        dom.interpretationResult.classList.remove('hidden');
        
        addLogEntry('system', 'Using local decode algorithms');
    }
    
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
    const classifications = [
        'Class II Anomaly - Structured Pattern',
        'Class III Anomaly - Repeating Sequence', 
        'Class I Anomaly - Isolated Burst',
        'Class IV Anomaly - Complex Waveform'
    ];
    
    const decodedMessages = [
        'OBSERVATION ACTIVE / SIGNAL RECEIVED',
        'PRESENCE ACKNOWLEDGED / MONITORING',
        'COORDINATES LOGGED / CONTINUE TRANSMISSION',
        'WE PERCEIVE / DO YOU RECEIVE',
        'PATTERN RECOGNIZED / AWAITING RESPONSE',
        'CONTACT INITIATED / STAND BY',
        'SIGNAL ECHOED / ORIGIN UNKNOWN',
        'TRANSMISSION DETECTED / SOURCE MAPPING'
    ];
    
    const recommendations = [
        'Continue monitoring this frequency range.',
        'Consider responding via TRANSMIT function.',
        'Save this signal for pattern comparison.',
        'Increase scan duration for additional captures.'
    ];
    
    const confidence = data.hasRegularPattern ? 
        Math.floor(Math.random() * 30) + 45 : 
        Math.floor(Math.random() * 25) + 15;
    
    const classification = classifications[Math.floor(Math.random() * classifications.length)];
    const decoded = decodedMessages[Math.floor(Math.random() * decodedMessages.length)];
    const recommendation = recommendations[Math.floor(Math.random() * recommendations.length)];
    
    return `<strong>SIGNAL CLASSIFICATION</strong>: ${classification}<br><br>` +
           `<strong>DECODED CONTENT</strong>: "${decoded}"<br><br>` +
           `<strong>CONFIDENCE ASSESSMENT</strong>: ${confidence}% - ${data.hasRegularPattern ? 'Pattern structure suggests non-random origin' : 'Irregular pattern requires further analysis'}<br><br>` +
           `<strong>RECOMMENDATION</strong>: ${recommendation}`;
}

// ============================================
// TRANSMIT SECTION
// ============================================

function setupTransmit() {
    dom.transmitMessage.addEventListener('input', () => {
        dom.charCount.textContent = dom.transmitMessage.value.length;
        updateTransmitPreview();
    });
    
    dom.encodingOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            dom.encodingOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            updateTransmitPreview();
        });
    });
    
    dom.beginTransmit.addEventListener('click', beginTransmission);
    
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
        const freq = (message.charCodeAt(i) - 32) / 95;
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
        data.push(0, 0, 0);
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
    
    dom.transmitStatus.classList.remove('hidden');
    dom.beginTransmit.disabled = true;
    
    addLogEntry('transmit', `Initiating transmission: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    showToast('info', 'Transmission started');
    
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
    
    dom.transmitStatus.classList.add('hidden');
    dom.beginTransmit.disabled = false;
    dom.transmitProgress.style.width = '0%';
}

async function transmitAudio(message, encoding) {
    const ctx = state.transmitAudioContext;
    const sampleRate = ctx.sampleRate;
    
    const duration = Math.min(message.length * 0.1, 10);
    
    let audioData;
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
    dom.logFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            dom.logFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            filterLog(filter.dataset.filter);
        });
    });
    
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
        capabilities.push('COSMIC'); // Camera can detect cosmic rays
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
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// INITIALIZE ON DOM READY
// ============================================

document.addEventListener('DOMContentLoaded', init);
