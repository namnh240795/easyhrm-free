/**
 * Attendance Tracking Module
 * Handles automatic check-in and check-out using face recognition
 */

// Configuration
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.5; // More lenient threshold for better matching
const CONFIDENT_THRESHOLD = 0.3;

// Cooldown period (milliseconds) - prevent duplicate scans
const SCAN_COOLDOWN = 5000;

// Days of week for schedule checking
const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const detectionResultEl = document.getElementById('detection-result');
const detectionNameEl = document.getElementById('detection-name');
const detectionActionEl = document.getElementById('detection-action');
const detectionTimeEl = document.getElementById('detection-time');
const activeUsersEl = document.getElementById('active-users');
const recentActivityEl = document.getElementById('recent-activity');
const currentTimeEl = document.getElementById('current-time');
const currentDateEl = document.getElementById('current-date');
const workingHoursStatusEl = document.getElementById('working-hours-status');
const workstationInfoEl = document.getElementById('workstation-info');
const wsNameDisplayEl = document.getElementById('ws-name-display');
const wsHoursDisplayEl = document.getElementById('ws-hours-display');
const systemStatusEl = document.getElementById('system-status');
const toggleAttendanceBtn = document.getElementById('toggle-attendance-btn');
const testModeBtn = document.getElementById('test-mode-btn');
const clearAttendanceBtn = document.getElementById('clear-attendance-btn');
const resetDbBtn = document.getElementById('reset-db-btn');
const filterBtns = document.querySelectorAll('.filter-btn');

// Debug elements
const debugFacesEl = document.getElementById('debug-faces');
const debugRegisteredEl = document.getElementById('debug-registered');
const debugMatchEl = document.getElementById('debug-match');
const debugDistanceEl = document.getElementById('debug-distance');
const debugThresholdEl = document.getElementById('debug-threshold');
const debugActiveEl = document.getElementById('debug-active');
const debugTestEl = document.getElementById('debug-test');
const debugHoursEl = document.getElementById('debug-hours');

// State
let modelsLoaded = false;
let stream = null;
let currentDescriptor = null;
let isDetecting = false;
let isAttendanceActive = false;
let testMode = false;
let registeredFaces = [];
let workstationSchedule = null;
let workstationInfo = null;
let lastScannedUser = null;
let lastScanTime = 0;
let currentFilter = 'all';
let scanInterval = null;
let displaySize = null;

/**
 * Initialize the application
 */
async function init() {
    try {
        // Load face-api.js models
        await loadModels();

        // Load registered faces
        await loadRegisteredFaces();

        // Load workstation schedule
        await loadWorkstationSchedule();

        // Update current time display
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);

        // Load active sessions and recent activity
        await loadActiveSessions();
        await loadRecentActivity();

        // Start video stream
        await startVideo();

        // Start face detection loop (always running, but only processes when attendance is active)
        startFaceDetectionLoop();

        // Set up filter buttons
        setupFilters();
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

        const faceCount = await faceDB.getCount();
        if (faceCount === 0) {
            updateStatus('error', 'No faces registered! Please <a href="register.html" style="color:inherit;text-decoration:underline;">register a face</a> first.');
        } else {
            updateStatus('ready', `Ready! ${faceCount} face(s) registered. Click "Start Attendance" to begin tracking.`);
        }

        // Update debug panel
        updateDebugPanel();
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
        console.log('Loaded registered faces:', registeredFaces.length);
    } catch (error) {
        console.error('Error loading registered faces:', error);
    }
}

/**
 * Load workstation schedule
 */
async function loadWorkstationSchedule() {
    try {
        workstationInfo = await faceDB.getWorkstation();

        if (workstationInfo && workstationInfo.schedule) {
            workstationSchedule = workstationInfo.schedule;

            // Display workstation info
            workstationInfoEl.style.display = 'block';
            wsNameDisplayEl.textContent = workstationInfo.name;

            // Get today's schedule
            const today = DAYS_OF_WEEK[new Date().getDay()];
            const todaySchedule = workstationSchedule[today];

            if (todaySchedule && todaySchedule.enabled) {
                wsHoursDisplayEl.textContent = `Today: ${todaySchedule.startTime} - ${todaySchedule.endTime}`;
            } else {
                wsHoursDisplayEl.textContent = 'Today: Not working';
            }
        }
    } catch (error) {
        console.error('Error loading workstation schedule:', error);
    }
}

/**
 * Update current time display
 */
function updateCurrentTime() {
    const now = new Date();
    currentTimeEl.textContent = now.toLocaleTimeString();
    currentDateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Update working hours status
    updateWorkingHoursStatus();
}

/**
 * Update working hours status
 */
function updateWorkingHoursStatus() {
    if (!workstationSchedule) {
        workingHoursStatusEl.textContent = 'No schedule configured';
        workingHoursStatusEl.style.background = 'rgba(255, 255, 255, 0.2)';
        systemStatusEl.className = 'status-indicator offline';
        return;
    }

    const now = new Date();
    const today = DAYS_OF_WEEK[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5);
    const todaySchedule = workstationSchedule[today];

    if (!todaySchedule || !todaySchedule.enabled) {
        workingHoursStatusEl.textContent = 'Outside working days';
        workingHoursStatusEl.style.background = 'rgba(251, 191, 36, 0.3)';
        systemStatusEl.className = 'status-indicator outside-hours';
        return;
    }

    if (currentTime >= todaySchedule.startTime && currentTime <= todaySchedule.endTime) {
        workingHoursStatusEl.textContent = 'Within working hours';
        workingHoursStatusEl.style.background = 'rgba(16, 185, 129, 0.3)';
        systemStatusEl.className = 'status-indicator online';
    } else {
        workingHoursStatusEl.textContent = 'Outside working hours';
        workingHoursStatusEl.style.background = 'rgba(251, 191, 36, 0.3)';
        systemStatusEl.className = 'status-indicator outside-hours';
    }
}

/**
 * Check if current time is within working hours
 */
function isWithinWorkingHours() {
    if (!workstationSchedule || testMode) {
        return true; // Allow in test mode or if no schedule
    }

    const now = new Date();
    const today = DAYS_OF_WEEK[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5);
    const todaySchedule = workstationSchedule[today];

    return todaySchedule && todaySchedule.enabled &&
           currentTime >= todaySchedule.startTime &&
           currentTime <= todaySchedule.endTime;
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

        // Wait for video to be ready
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                displaySize = { width: video.videoWidth, height: video.videoHeight };
                faceapi.matchDimensions(canvas, displaySize);
                video.play();
                resolve();
            };
        });
    } catch (error) {
        throw new Error('Unable to access camera. Please grant permission.');
    }
}

/**
 * Start continuous face detection loop (always runs)
 */
function startFaceDetectionLoop() {
    isDetecting = true;

    scanInterval = setInterval(async () => {
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

        // Update debug panel with detection info
        updateDebugInfo(detections);

        // Process detected faces for attendance (only when active)
        if (isAttendanceActive && detections.length > 0) {
            await processFaceDetection(detections[0]);
        }
    }, 500); // Scan every 500ms

    console.log('Face detection loop started');
}

/**
 * Update debug panel with real-time detection info
 */
function updateDebugInfo(detections) {
    debugFacesEl.textContent = detections.length;
    debugRegisteredEl.textContent = registeredFaces.length;

    if (detections.length > 0 && registeredFaces.length > 0) {
        const match = findMatch(detections[0].descriptor);
        if (match) {
            debugMatchEl.textContent = match.face.name;
            debugMatchEl.style.color = match.distance < 0.4 ? '#10b981' : match.distance < 0.5 ? '#f59e0b' : '#ef4444';
            debugDistanceEl.textContent = match.distance.toFixed(4);
        } else {
            debugMatchEl.textContent = 'No match';
            debugMatchEl.style.color = '#ef4444';
            debugDistanceEl.textContent = '-';
        }
    } else {
        debugMatchEl.textContent = 'None';
        debugMatchEl.style.color = 'inherit';
        debugDistanceEl.textContent = '-';
    }
}

/**
 * Update debug panel with static info
 */
function updateDebugPanel() {
    debugThresholdEl.textContent = MATCH_THRESHOLD.toString();
    debugActiveEl.textContent = isAttendanceActive ? 'Yes' : 'No';
    debugTestEl.textContent = testMode ? 'Yes' : 'No';
    debugHoursEl.textContent = isWithinWorkingHours() ? 'Yes' : 'No';
}

/**
 * Process a detected face for attendance
 */
async function processFaceDetection(detection) {
    const now = Date.now();

    // Check cooldown
    if (lastScannedUser && now - lastScanTime < SCAN_COOLDOWN) {
        console.log('Cooldown active, skipping scan');
        return;
    }

    console.log('Processing face detection...');

    const descriptor = detection.descriptor;
    const match = findMatch(descriptor);

    if (match) {
        console.log('Face matched:', match.face.name, 'Confidence:', match.confidence);

        // Check if within working hours (unless in test mode)
        if (!isWithinWorkingHours() && !testMode) {
            console.log('Outside working hours, skipping');
            showDetectionResult(match.face.name, 'Outside working hours', false);
            return;
        }

        // Check if user is currently checked in
        const isCheckedIn = await faceDB.isCheckedIn(match.face.id);
        console.log('User checked in:', isCheckedIn);

        if (isCheckedIn) {
            // Check out
            const result = await faceDB.recordCheckOut(match.face.id, match.face.name, match.confidence);

            console.log('Checked out:', match.face.name, 'Duration:', result.duration);
            showDetectionResult(match.face.name, 'Checked Out', true, 'check-out', result.duration);

            // Reload displays
            await loadActiveSessions();
            await loadRecentActivity();
        } else {
            // Check in
            console.log('Checking in:', match.face.name);
            updateStatus('loading', `Checking in ${match.face.name}...`);

            try {
                await faceDB.recordCheckIn(match.face.id, match.face.name, match.confidence);

                console.log('Checked in:', match.face.name);
                showDetectionResult(match.face.name, 'Checked In', true, 'check-in');

                // Reload displays
                await loadActiveSessions();
                await loadRecentActivity();

                updateStatus('ready', `✅ ${match.face.name} checked in successfully!`);
            } catch (error) {
                console.error('Check-in error:', error);
                updateStatus('error', `Check-in failed: ${error.message}`);
            }
        }

        // Update last scan info
        lastScannedUser = match.face.id;
        lastScanTime = now;
    } else {
        console.log('No face match found');
    }
}

/**
 * Find the best match for a face descriptor
 */
function findMatch(descriptor) {
    if (registeredFaces.length === 0) {
        console.log('No registered faces to match against');
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

    console.log('Best match distance:', bestDistance, 'Threshold:', MATCH_THRESHOLD);

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
 * Calculate Euclidean distance between two descriptors
 */
function euclideanDistance(descriptor1, descriptor2) {
    return Math.sqrt(
        descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0)
    );
}

/**
 * Show detection result
 */
function showDetectionResult(name, action, matched, type = '', duration = null) {
    detectionResultEl.style.display = 'block';
    detectionResultEl.className = 'detection-result ' + (matched ? 'matched' : 'processing');

    detectionNameEl.textContent = name;
    detectionActionEl.textContent = action;

    if (type) {
        detectionActionEl.className = 'detection-action ' + type;
    }

    const timeStr = new Date().toLocaleTimeString();
    if (duration !== null) {
        detectionTimeEl.textContent = `${timeStr} • Duration: ${formatDuration(duration)}`;
    } else {
        detectionTimeEl.textContent = timeStr;
    }

    console.log('Showing detection result:', name, action);

    // Auto-hide after 3 seconds
    setTimeout(() => {
        detectionResultEl.style.display = 'none';
    }, 3000);
}

/**
 * Format duration in minutes to readable format
 */
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Load and display active sessions
 */
async function loadActiveSessions() {
    try {
        const sessions = await faceDB.getActiveSessions();

        if (sessions.length === 0) {
            activeUsersEl.innerHTML = '<div class="empty-state">No users checked in</div>';
            return;
        }

        activeUsersEl.innerHTML = sessions.map(session => {
            const checkInTime = new Date(session.checkInTime);
            const duration = Math.round((Date.now() - checkInTime.getTime()) / 1000 / 60);

            return `
                <div class="active-user-item">
                    <div class="active-user-info">
                        <div class="active-user-name">${escapeHtml(session.name)}</div>
                        <div class="active-user-time">Since ${checkInTime.toLocaleTimeString()}</div>
                    </div>
                    <div class="active-user-duration">${formatDuration(duration)}</div>
                </div>
            `;
        }).join('');

        console.log('Loaded active sessions:', sessions.length);
    } catch (error) {
        console.error('Error loading active sessions:', error);
    }
}

/**
 * Load and display recent activity
 */
async function loadRecentActivity() {
    try {
        let records = await faceDB.getAllAttendance();

        // Apply filter
        if (currentFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            records = records.filter(r => r.date === today);
        }

        // Limit to recent 20
        records = records.slice(0, 20);

        if (records.length === 0) {
            recentActivityEl.innerHTML = '<div class="empty-state">No activity yet</div>';
            return;
        }

        recentActivityEl.innerHTML = records.map(record => {
            const time = new Date(record.timestamp);
            const icon = record.type === 'check-in' ? '📥' : '📤';

            return `
                <div class="activity-item">
                    <div class="activity-icon ${record.type}">${icon}</div>
                    <div class="activity-details">
                        <div class="activity-name">${escapeHtml(record.name)}</div>
                        <div class="activity-time">${time.toLocaleString()}</div>
                    </div>
                    <span class="activity-type ${record.type}">${record.type === 'check-in' ? 'IN' : 'OUT'}</span>
                </div>
            `;
        }).join('');

        console.log('Loaded recent activity:', records.length);
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

/**
 * Setup filter buttons
 */
function setupFilters() {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            loadRecentActivity();
        });
    });
}

/**
 * Toggle attendance tracking
 */
function toggleAttendance() {
    isAttendanceActive = !isAttendanceActive;

    if (isAttendanceActive) {
        toggleAttendanceBtn.textContent = 'Stop Attendance';
        toggleAttendanceBtn.classList.remove('btn-primary');
        toggleAttendanceBtn.classList.add('btn-danger');
        updateStatus('ready', '🎥 Attendance tracking ACTIVE! Look at the camera to check in/out.');
        debugActiveEl.textContent = 'Yes';
        console.log('Attendance tracking started');
    } else {
        toggleAttendanceBtn.textContent = 'Start Attendance';
        toggleAttendanceBtn.classList.remove('btn-danger');
        toggleAttendanceBtn.classList.add('btn-primary');
        updateStatus('ready', `⏸️ Attendance tracking paused. ${registeredFaces.length} face(s) registered.`);
        debugActiveEl.textContent = 'No';
        console.log('Attendance tracking stopped');
    }
}

/**
 * Toggle test mode
 */
function toggleTestMode() {
    testMode = !testMode;
    testModeBtn.textContent = `Test Mode: ${testMode ? 'On' : 'Off'}`;

    if (testMode) {
        testModeBtn.classList.remove('btn-secondary');
        testModeBtn.classList.add('btn-primary');
        updateStatus('ready', '🧪 Test mode enabled! Attendance will work outside working hours.');
        debugTestEl.textContent = 'Yes';
        console.log('Test mode enabled');
    } else {
        testModeBtn.classList.remove('btn-primary');
        testModeBtn.classList.add('btn-secondary');
        updateWorkingHoursStatus();
        debugTestEl.textContent = 'No';
        console.log('Test mode disabled');
    }

    updateDebugPanel();
}

/**
 * Clear all attendance records
 */
async function clearAttendance() {
    if (!confirm('Are you sure you want to clear all attendance records? This cannot be undone.')) {
        return;
    }

    try {
        await faceDB.clearAttendance();
        await loadActiveSessions();
        await loadRecentActivity();
        alert('All attendance records cleared!');
        console.log('Attendance records cleared');
    } catch (error) {
        alert('Error clearing attendance: ' + error.message);
    }
}

/**
 * Reset database (delete and recreate)
 * WARNING: This will delete ALL data including registered faces
 */
async function resetDatabase() {
    if (!confirm('⚠️ WARNING: This will delete ALL data including:\n\n• Registered faces\n• Workstation settings\n• Attendance records\n\nYou will need to re-register all faces.\n\nContinue?')) {
        return;
    }

    try {
        // Close current database connection
        if (faceDB.db) {
            faceDB.db.close();
        }

        // Delete the entire database
        const deleteRequest = indexedDB.deleteDatabase('FaceRecognitionDB');

        deleteRequest.onsuccess = async () => {
            console.log('Database deleted successfully');
            alert('Database reset! Page will reload now.');

            // Reload the page to recreate database with new schema
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };

        deleteRequest.onerror = () => {
            alert('Error deleting database: ' + deleteRequest.error);
        };
    } catch (error) {
        alert('Error resetting database: ' + error.message);
    }
}

/**
 * Update status indicator
 */
function updateStatus(type, message) {
    statusEl.className = `status ${type}`;
    statusEl.innerHTML = `<span class="status-dot"></span><span>${message}</span>`;
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
toggleAttendanceBtn.addEventListener('click', toggleAttendance);
testModeBtn.addEventListener('click', toggleTestMode);
clearAttendanceBtn.addEventListener('click', clearAttendance);
resetDbBtn.addEventListener('click', resetDatabase);

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
