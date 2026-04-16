/**
 * Face Registration Module
 * Handles face detection, descriptor extraction, and storage
 */

// Configuration
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.6;

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const nameInput = document.getElementById('name-input');
const registerBtn = document.getElementById('register-btn');
const facesListEl = document.getElementById('faces-list');
const faceCountEl = document.getElementById('face-count');

// State
let modelsLoaded = false;
let stream = null;
let currentDescriptor = null;
let isDetecting = false;

/**
 * Initialize the application
 */
async function init() {
    try {
        // Load face-api.js models
        await loadModels();

        // Start video stream
        await startVideo();

        // Load registered faces
        await loadFacesList();

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
        updateStatus('ready', 'Models loaded! Position your face in the camera.');
        enableControls();
    } catch (error) {
        throw new Error('Failed to load models: ' + error.message);
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
    nameInput.disabled = false;
    registerBtn.disabled = false;
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
 * Check if a face is already registered
 */
async function isFaceAlreadyRegistered(descriptor) {
    const faces = await faceDB.getAllFaces();

    for (const face of faces) {
        const distance = euclideanDistance(descriptor, face.descriptor);
        if (distance < 0.4) { // Strict threshold for duplicate detection
            return { isDuplicate: true, existingName: face.name };
        }
    }

    return { isDuplicate: false };
}

/**
 * Handle registration
 */
async function registerFace() {
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter your name');
        nameInput.focus();
        return;
    }

    if (!currentDescriptor) {
        alert('No face detected! Please position your face in the camera.');
        return;
    }

    // Check for duplicate faces
    const duplicateCheck = await isFaceAlreadyRegistered(currentDescriptor);
    if (duplicateCheck.isDuplicate) {
        alert(`This face is already registered as "${duplicateCheck.existingName}"!`);
        return;
    }

    try {
        registerBtn.disabled = true;
        registerBtn.textContent = 'Registering...';

        // Add face to database
        await faceDB.addFace(name, currentDescriptor);

        // Show success message
        alert(`Face registered successfully for "${name}"!`);

        // Clear input
        nameInput.value = '';

        // Reload faces list
        await loadFacesList();
    } catch (error) {
        alert('Error registering face: ' + error.message);
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register Face';
    }
}

/**
 * Load and display the list of registered faces
 */
async function loadFacesList() {
    try {
        const faces = await faceDB.getAllFaces();
        faceCountEl.textContent = faces.length;

        if (faces.length === 0) {
            facesListEl.innerHTML = '<div class="empty-state">No faces registered yet.</div>';
            return;
        }

        facesListEl.innerHTML = faces.map(face => `
            <div class="face-item">
                <div class="face-info">
                    <div class="face-name">${escapeHtml(face.name)}</div>
                    <div class="face-date">Registered: ${new Date(face.createdAt).toLocaleString()}</div>
                </div>
                <button class="delete-btn" onclick="deleteFace(${face.id}, '${escapeHtml(face.name)}')">
                    Delete
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading faces:', error);
        facesListEl.innerHTML = '<div class="empty-state">Error loading faces.</div>';
    }
}

/**
 * Delete a face from the database
 */
async function deleteFace(id, name) {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        try {
            await faceDB.deleteFace(id);
            await loadFacesList();
        } catch (error) {
            alert('Error deleting face: ' + error.message);
        }
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
registerBtn.addEventListener('click', registerFace);

nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        registerFace();
    }
});

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
