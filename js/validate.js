/**
 * Face Validation Module
 * Handles face detection, matching, and validation
 */

// Configuration
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.5; // More lenient threshold for better matching
const CONFIDENT_THRESHOLD = 0.3;

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const validateBtn = document.getElementById('validate-btn');
const autoValidateBtn = document.getElementById('auto-validate-btn');
const resultsContainer = document.getElementById('results-container');

// State
let modelsLoaded = false;
let stream = null;
let currentDescriptor = null;
let isDetecting = false;
let autoValidate = false;
let autoValidateInterval = null;
let registeredFaces = [];

/**
 * Initialize the application
 */
async function init() {
    try {
        // Load face-api.js models
        await loadModels();

        // Load registered faces
        await loadRegisteredFaces();

        // Start video stream
        await startVideo();

        // Start face detection loop
        startFaceDetection();
    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus('error', 'Error: ' + error.message);
    }
}

/**
 * Load face-api.js models
 */
async function loadModels() {
    updateStatus('loading', 'Loading face detection models...');

    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        modelsLoaded = true;

        // Update status based on whether we have registered faces
        const faceCount = await faceDB.getCount();
        if (faceCount === 0) {
            updateStatus('error', 'No faces registered! Please register a face first.');
        } else {
            updateStatus('ready', `Ready! ${faceCount} face(s) registered. Position your face in the camera.`);
            enableControls();
        }
    } catch (error) {
        throw new Error('Failed to load models: ' + error.message);
    }
}

/**
 * Load registered faces from database
 */
async function loadRegisteredFaces() {
    try {
        registeredFaces = await faceDB.getAllFaces();
    } catch (error) {
        console.error('Error loading registered faces:', error);
    }
}

/**
 * Start the video stream
 */
async function startVideo() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        video.srcObject = stream;
    } catch (error) {
        throw new Error('Unable to access camera. Please grant permission.');
    }
}

/**
 * Start continuous face detection
 */
function startFaceDetection() {
    isDetecting = true;

    video.addEventListener('play', () => {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            if (!isDetecting || video.paused || video.ended) return;

            // Detect faces
            const detections = await faceapi
                .detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceDescriptors();

            // Resize detections to match video display size
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Clear canvas and draw detections
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw face boxes and landmarks
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

            // Store the first detected face descriptor
            if (detections.length > 0) {
                currentDescriptor = detections[0].descriptor;

                // Draw match indicator if auto-validate is on
                if (autoValidate) {
                    const matchResult = findMatch(currentDescriptor);
                    if (matchResult) {
                        drawMatchIndicator(ctx, resizedDetections[0].detection.box, matchResult);
                    }
                }
            } else {
                currentDescriptor = null;
            }
        }, 100);
    });
}

/**
 * Enable form controls
 */
function enableControls() {
    validateBtn.disabled = false;
    autoValidateBtn.disabled = false;
}

/**
 * Update status indicator
 */
function updateStatus(type, message) {
    statusEl.className = `status ${type}`;
    statusText.textContent = message;
}

/**
 * Calculate Euclidean distance between two descriptors
 */
function euclideanDistance(descriptor1, descriptor2) {
    return Math.sqrt(
        descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0)
    );
}

/**
 * Find the best match for a face descriptor
 */
function findMatch(descriptor) {
    if (registeredFaces.length === 0) {
        return null;
    }

    let bestMatch = null;
    let bestDistance = Infinity;

    for (const face of registeredFaces) {
        const distance = euclideanDistance(descriptor, face.descriptor);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = face;
        }
    }

    // Check if the best match is within threshold
    if (bestDistance <= MATCH_THRESHOLD) {
        const confidence = Math.max(0, Math.min(100, (1 - (bestDistance / MATCH_THRESHOLD)) * 100));
        return {
            face: bestMatch,
            distance: bestDistance,
            confidence: confidence
        };
    }

    return null;
}

/**
 * Get match level description
 */
function getMatchLevel(distance) {
    if (distance < CONFIDENT_THRESHOLD) {
        return { level: 'Very Confident', color: '#10b981' };
    } else if (distance < 0.5) {
        return { level: 'Confident', color: '#22c55e' };
    } else if (distance < MATCH_THRESHOLD) {
        return { level: 'Likely Match', color: '#f59e0b' };
    } else {
        return { level: 'No Match', color: '#ef4444' };
    }
}

/**
 * Draw match indicator on canvas
 */
function drawMatchIndicator(ctx, box, matchResult) {
    const { level, color } = getMatchLevel(matchResult.distance);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Draw label background
    ctx.fillStyle = color;
    const text = `${matchResult.face.name} (${Math.round(matchResult.confidence)}%)`;
    const textMetrics = ctx.measureText(text);
    const textHeight = 24;

    ctx.fillRect(box.x, box.y - textHeight - 8, textMetrics.width + 16, textHeight + 8);

    // Draw label text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(text, box.x + 8, box.y - 10);

    ctx.restore();
}

/**
 * Display validation result
 */
function displayResult(result) {
    if (result) {
        const { level, color } = getMatchLevel(result.distance);

        resultsContainer.innerHTML = `
            <div class="result-item match">
                <div class="result-name">${escapeHtml(result.face.name)}</div>
                <div class="result-details">
                    <span>Distance: ${result.distance.toFixed(4)}</span>
                    <span>Level: ${level}</span>
                </div>
                <div class="confidence-bar">
                    <div class="confidence-bar-fill" style="width: ${result.confidence}%; background: ${color}"></div>
                </div>
                <div style="text-align: right; font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    Confidence: ${result.confidence.toFixed(1)}%
                </div>
            </div>
        `;
    } else {
        resultsContainer.innerHTML = `
            <div class="result-item no-match">
                <div class="result-name">No Match Found</div>
                <div class="result-details">
                    <span>This face is not registered in the system</span>
                </div>
            </div>
        `;
    }
}

/**
 * Handle manual validation
 */
function validateFace() {
    if (!currentDescriptor) {
        alert('No face detected! Please position your face in the camera.');
        return;
    }

    if (registeredFaces.length === 0) {
        alert('No faces registered in the system! Please register a face first.');
        return;
    }

    const result = findMatch(currentDescriptor);
    displayResult(result);
}

/**
 * Toggle auto-validation mode
 */
function toggleAutoValidate() {
    autoValidate = !autoValidate;

    if (autoValidate) {
        autoValidateBtn.textContent = 'Disable Auto-Validate';
        autoValidateBtn.classList.remove('btn-secondary');
        autoValidateBtn.classList.add('btn-primary');
        validateBtn.disabled = true;

        updateStatus('ready', 'Auto-validate enabled! Point your face at the camera.');
    } else {
        autoValidateBtn.textContent = 'Enable Auto-Validate';
        autoValidateBtn.classList.remove('btn-primary');
        autoValidateBtn.classList.add('btn-secondary');
        validateBtn.disabled = false;

        updateStatus('ready', 'Auto-validate disabled. Click "Capture & Validate" to validate.');
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
validateBtn.addEventListener('click', validateFace);
autoValidateBtn.addEventListener('click', toggleAutoValidate);

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
