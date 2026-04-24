import { useState, useEffect, useRef } from 'react';
import { useFaceDB } from '../hooks/useFaceDB';

// Use global faceapi loaded from CDN

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.5;
const SCAN_COOLDOWN = 1000;
const DB_SAVE_DEBOUNCE = 500;
const FACE_TRACKING_TIMEOUT = 5000;
const FPS_INTERVAL = 33; // ~30 FPS for production

const ZONES = {
  LEFT: { name: 'left', min: 0, max: 0.3 },
  MIDDLE: { name: 'middle', min: 0.3, max: 0.7 },
  RIGHT: { name: 'right', min: 0.7, max: 1.0 }
};

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function Attendance() {
  const { faceDB, isInitialized } = useFaceDB();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isAttendanceActive, setIsAttendanceActive] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [isMotionDetectionEnabled, setIsMotionDetectionEnabled] = useState(true);
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [workstationSchedule, setWorkstationSchedule] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [lastScans, setLastScans] = useState({}); // Track per-user cooldowns
  const [distanceWarning, setDistanceWarning] = useState({ show: false, message: '' });

  // Refs for state used in setInterval (avoid stale closures)
  const isAttendanceActiveRef = useRef(false);
  const testModeRef = useRef(false);
  const isMotionDetectionEnabledRef = useRef(true);
  const dbSaveDebounceRef = useRef({ timeouts: {}, pending: {} });
  const pendingActionRef = useRef({});
  const lastScansRef = useRef({});
  const faceTrackingRef = useRef({});
  const cleanupTimeoutRef = useRef(null);

  // Update refs when state changes
  useEffect(() => {
    isAttendanceActiveRef.current = isAttendanceActive;
  }, [isAttendanceActive]);

useEffect(() => {
    isMotionDetectionEnabledRef.current = isMotionDetectionEnabled;
  }, [isMotionDetectionEnabled]);

  useEffect(() => {
    lastScansRef.current = lastScans;
  }, [lastScans]);

  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      Object.values(dbSaveDebounceRef.current.timeouts || {}).forEach(t => clearTimeout(t));
      Object.keys(faceTrackingRef.current).forEach(id => delete faceTrackingRef.current[id]);
    };
  }, []);

  // Debug state
  const [debugInfo, setDebugInfo] = useState({
    faces: 0,
    registered: 0,
    match: '-',
    distance: '-',
    zone: '-',
    movement: '-',
    faceSize: '-',
    velocity: '-'
  });

  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  // Load models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    }
    loadModels();
  }, []);

  // Load registered faces
  useEffect(() => {
    async function loadFaces() {
      if (!isInitialized) return;
      try {
        const faces = await faceDB.getAllFaces();
        setRegisteredFaces(faces);
        setDebugInfo(prev => ({ ...prev, registered: faces.length }));
      } catch (error) {
        console.error('Failed to load faces:', error);
      }
    }
    loadFaces();
  }, [isInitialized, faceDB]);

  // Load recent activity
  useEffect(() => {
    async function loadActivity() {
      if (!isInitialized) return;
      try {
        const records = await faceDB.getAllAttendance();
        setRecentActivity(records.slice(0, 10));
      } catch (error) {
        console.error('Failed to load activity:', error);
      }
    }
    loadActivity();
  }, [isInitialized, faceDB]);

  // Load workstation schedule
  useEffect(() => {
    async function loadSchedule() {
      if (!isInitialized) return;
      try {
        const ws = await faceDB.getWorkstation();
        if (ws) {
          setWorkstationSchedule(ws.schedule);
        }
      } catch (error) {
        console.error('Failed to load workstation:', error);
      }
    }
    loadSchedule();
  }, [isInitialized, faceDB]);

  // Start video stream
  useEffect(() => {
    if (!modelsLoaded || !videoRef.current) return;

    async function startVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            facingMode: 'user'
          }
        });
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          startFaceDetection();
        };
      } catch (error) {
        console.error('Failed to start video:', error);
      }
    }

    startVideo();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [modelsLoaded]);

  // Face detection loop

  function startFaceDetection() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    const scanInterval = setInterval(async () => {
      if (video.paused || video.ended) return;

      // Detect faces with lower confidence threshold for better distant face detection
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2, maxResults: 15 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      // Clear and draw
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawZones(ctx, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

      // Update debug info
      updateDebugInfo(detections, displaySize.width);

      // Process for attendance
      if (isAttendanceActiveRef.current && detections.length > 0) {
        await processFaceDetection(detections, displaySize.width);
      }
    }, FPS_INTERVAL);

    return () => clearInterval(scanInterval);
  }

  function drawZones(ctx, width, height) {
    // Draw left zone
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(0, 0, width * ZONES.LEFT.max, height);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width * ZONES.LEFT.max, height);

    // Draw right zone
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.fillRect(width * ZONES.RIGHT.min, 0, width * (1 - ZONES.RIGHT.min), height);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.strokeRect(width * ZONES.RIGHT.min, 0, width * (1 - ZONES.RIGHT.min), height);

    // Draw labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '14px sans-serif';
    ctx.fillText('← CHECK-IN', 10, 20);
    ctx.fillText('CHECK-OUT →', width - 100, 20);

    ctx.setLineDash([]);
  }

  function updateDebugInfo(detections, videoWidth) {
    setDebugInfo(prev => ({
      ...prev,
      faces: detections.length,
      movement: Object.keys(faceTrackingRef.current).length > 0 ? 'Tracking' : '-'
    }));

    if (detections.length > 0 && registeredFaces.length > 0) {
      const match = findMatch(detections[0].descriptor);
      if (match) {
        setDebugInfo(prev => ({
          ...prev,
          match: match.face.name,
          distance: match.distance.toFixed(4)
        }));

        const faceCenterX = getFaceCenterX(detections[0]);
        const zone = getZoneForPosition(faceCenterX);
        setDebugInfo(prev => ({
          ...prev,
          zone: `${zone} (${(faceCenterX * 100).toFixed(0)}%)`
        }));

        // Calculate face size percentage
        const box = detections[0].detection.box;
        const faceSize = Math.max(box.width, box.height);
        const videoDimension = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
        const faceSizePercent = (faceSize / videoDimension * 100).toFixed(1);
        const minFaceSize = videoDimension * 0.05; // 5% of video dimension
        const minFaceSizePercent = (minFaceSize / videoDimension * 100).toFixed(1);

        setDebugInfo(prev => ({
          ...prev,
          faceSize: `${faceSizePercent}% (min: ${minFaceSizePercent}%)`
        }));

        // Calculate velocity if we have tracking data
        const tracking = faceTrackingRef.current[match.face.id];
        if (tracking && tracking.positions && tracking.positions.length >= 2) {
          const recentPositions = tracking.positions.slice(-5); // Use last 5 positions
          if (recentPositions.length >= 2) {
            const oldestPos = recentPositions[0];
            const newestPos = recentPositions[recentPositions.length - 1];
            const timeDelta = newestPos.time - oldestPos.time;

            if (timeDelta > 0) {
              const distance = newestPos.x - oldestPos.x;
              const velocity = (distance / (timeDelta / 1000)) * 100; // % per second
              const direction = velocity > 0 ? '→' : '←';
              setDebugInfo(prev => ({
                ...prev,
                velocity: `${Math.abs(velocity).toFixed(1)}%/s ${direction}`
              }));
            }
          }
        }

        if (faceSize < minFaceSize) {
          setDistanceWarning({
            show: true,
            message: `⚠️ Too far! Move closer (face: ${faceSizePercent}%, min: ${minFaceSizePercent}%)`
          });
        } else {
          setDistanceWarning({ show: false, message: '' });
        }
      }
    } else {
      // Don't clear debug info when no face detected - keep last known values
      // Only clear warning
      setDistanceWarning({ show: false, message: '' });
    }
  }

  function getFaceCenterX(detection) {
    const box = detection.detection.box;
    const rawX = (box.x + box.width / 2) / videoRef.current.videoWidth;
    // Flip X coordinate because video is mirrored
    return 1 - rawX;
  }

  function getZoneForPosition(x) {
    if (x < ZONES.MIDDLE.min) return ZONES.LEFT.name;
    if (x < ZONES.RIGHT.min) return ZONES.MIDDLE.name;
    return ZONES.RIGHT.name;
  }

  function findMatch(descriptor) {
    if (registeredFaces.length === 0) return null;

    let bestMatch = null;
    let bestDistance = Infinity;

    for (const face of registeredFaces) {
      const distance = euclideanDistance(descriptor, face.descriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = face;
      }
    }

    if (bestDistance <= MATCH_THRESHOLD) {
      const confidence = Math.max(0, Math.min(100, (1 - (bestDistance / MATCH_THRESHOLD)) * 100));
      return { face: bestMatch, distance: bestDistance, confidence };
    }

    return null;
  }

  function euclideanDistance(descriptor1, descriptor2) {
    return Math.sqrt(
      descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0)
    );
  }

  async function debouncedDbSave(action, faceId, name, confidence) {
    const key = `${action}-${faceId}`;
    const current = dbSaveDebounceRef.current;

    if (current.timeouts && current.timeouts[key]) {
      clearTimeout(current.timeouts[key]);
    }

    if (!current.pending) {
      current.pending = {};
    }
    current.pending[key] = { action, faceId, name, confidence };

    current.timeouts = current.timeouts || {};
    current.timeouts[key] = setTimeout(async () => {
      try {
        if (current.pending && current.pending[key]) {
          const { action, faceId, name, confidence } = current.pending[key];
          if (action === 'checkin') {
            await faceDB.recordCheckIn(faceId, name, confidence);
          } else {
            await faceDB.recordCheckOut(faceId, name, confidence);
          }
          delete current.pending[key];
        }
      } catch (error) {
        console.error('Failed to save attendance record:', error);
        delete current.pending[key];
      }
    }, DB_SAVE_DEBOUNCE);
  }

  async function processFaceDetection(detections, videoWidth) {
    const now = Date.now();

    for (const detection of detections) {
      const match = findMatch(detection.descriptor);
      if (!match) continue;

      const lastScan = lastScansRef.current[match.face.id];
      if (lastScan && now - lastScan.time < SCAN_COOLDOWN) {
        console.log(`⏸️ ${match.face.name} is on cooldown (${Math.round((SCAN_COOLDOWN - (now - lastScan.time)) / 1000)}s remaining)`);
        continue;
      }

      // Check if face is too far (small bounding box)
      const box = detection.detection.box;
      const faceSize = Math.max(box.width, box.height);
      const minFaceSize = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight) * 0.05; // 5% of video dimension

      if (faceSize < minFaceSize) {
        console.log(`⚠️ ${match.face.name} is too far - face size: ${Math.round(faceSize)}px (min: ${Math.round(minFaceSize)}px). Attendance blocked.`);
        continue;
      }

      const faceCenterX = getFaceCenterX(detection);

      if (!faceTrackingRef.current[match.face.id]) {
        faceTrackingRef.current[match.face.id] = {
          zone: null,
          movementHistory: [],
          positions: [] // Track recent positions for velocity detection
        };
      }

      const tracking = faceTrackingRef.current[match.face.id];
      const currentZone = getZoneForPosition(faceCenterX);

      // Add current position to tracking history
      tracking.positions.push({ x: faceCenterX, time: now });

      // Keep only last 2000ms of positions (increased for better tracking during intermittent detection)
      tracking.positions = tracking.positions.filter(p => now - p.time < 2000);

      // Clear tracking if no movement for 5 seconds
      if (tracking.positions.length > 0) {
        const latestPos = tracking.positions[tracking.positions.length - 1];
        if (now - latestPos.time > FACE_TRACKING_TIMEOUT) {
          delete faceTrackingRef.current[match.face.id];
          console.log('🔄 Cleared stale tracking data (5s timeout)');
        }
      }

      // Also cleanup tracking entries for faces no longer in detections
      const detectedFaceIds = new Set(detections.map(d => findMatch(d.descriptor)?.face.id).filter(Boolean));
      Object.keys(faceTrackingRef.current).forEach(id => {
        if (!detectedFaceIds.has(id)) {
          delete faceTrackingRef.current[id];
        }
      });

      // Detect direction from zone transitions OR velocity
      let direction = detectZoneTransition(tracking, currentZone);

      // If no zone transition, try velocity-based detection for fast movements
      if (!direction && tracking.positions.length >= 3) {
        direction = detectMovementDirection(tracking.positions);
      }

      if (direction && isMotionDetectionEnabledRef.current && isWithinWorkingHours()) {
        console.log(`🎯 Motion detected: ${direction} for ${match.face.name}`);

        if (direction === 'left-to-right') {
          const isCheckedIn = await faceDB.isCheckedIn(match.face.id);
          console.log('  Checked in status:', isCheckedIn);
          const pendingKey = `${match.face.id}-checkin`;

          if (!isCheckedIn && !pendingActionRef.current[pendingKey]) {
            pendingActionRef.current[pendingKey] = true;
            debouncedDbSave('checkin', match.face.id, match.face.name, match.confidence);
            showNotification(`✅ ${match.face.name} Checked IN (Left → Right)`, 'success');
            loadActiveSessions();
            const records = await faceDB.getAllAttendance();
            setRecentActivity(records.slice(0, 10));
            setLastScans(prev => ({ ...prev, [match.face.id]: { time: now, userId: match.face.id } }));
            tracking.positions = [];
            setTimeout(() => { delete pendingActionRef.current[pendingKey]; }, DB_SAVE_DEBOUNCE * 2);
          } else {
            console.log('  Already checked in or pending, ignoring');
          }
        } else if (direction === 'right-to-left') {
          const isCheckedIn = await faceDB.isCheckedIn(match.face.id);
          console.log('  Checked out status:', isCheckedIn);
          const pendingKey = `${match.face.id}-checkout`;

          if (isCheckedIn && !pendingActionRef.current[pendingKey]) {
            pendingActionRef.current[pendingKey] = true;
            debouncedDbSave('checkout', match.face.id, match.face.name, match.confidence);
            showNotification(`✅ ${match.face.name} Checked OUT (Right → Left)`, 'success');
            loadActiveSessions();
            const records = await faceDB.getAllAttendance();
            setRecentActivity(records.slice(0, 10));
            setLastScans(prev => ({ ...prev, [match.face.id]: { time: now, userId: match.face.id } }));
            tracking.positions = [];
            setTimeout(() => { delete pendingActionRef.current[pendingKey]; }, DB_SAVE_DEBOUNCE * 2);
          } else {
            console.log('  Not checked in or pending, ignoring');
          }
        }
      } else {
        console.log('⏸️ Motion detected but conditions not met:', {
          direction,
          motionEnabled: isMotionDetectionEnabledRef.current,
          withinHours: isWithinWorkingHours()
        });
      }
    }
  }

  function detectMovementDirection(positions) {
    if (positions.length < 3) return null;

    // Calculate overall movement direction
    const oldestPos = positions[0];
    const newestPos = positions[positions.length - 1];
    const timeDelta = newestPos.time - oldestPos.time;

    if (timeDelta < 50) return null; // Need at least 50ms of data

    const distance = newestPos.x - oldestPos.x;
    const velocity = distance / (timeDelta / 1000); // pixels per second (normalized 0-1)

    // Much lower threshold for better sensitivity
    const minDistance = 0.1; // Only need to move 10% across the screen

    if (distance > minDistance) {
      console.log(`🚀 Fast movement detected: left→right (${(velocity * 100).toFixed(1)}%/sec, distance: ${(distance * 100).toFixed(1)}%)`);
      return 'left-to-right';
    } else if (distance < -minDistance) {
      console.log(`🚀 Fast movement detected: right→left (${(Math.abs(velocity) * 100).toFixed(1)}%/sec, distance: ${(Math.abs(distance) * 100).toFixed(1)}%)`);
      return 'right-to-left';
    }

    return null;
  }

  function detectZoneTransition(tracking, currentZone) {
    if (!tracking.zone) {
      tracking.zone = currentZone;
      return null;
    }

    const previousZone = tracking.zone;
    if (previousZone === currentZone) return null;

    let direction = null;

    // Direct LEFT → RIGHT transition = Check-in
    if (previousZone === ZONES.LEFT.name && currentZone === ZONES.RIGHT.name) {
      direction = 'left-to-right';
      console.log('✓ Direct LEFT→RIGHT zone transition detected');
    }
    // Direct RIGHT → LEFT transition = Check-out
    else if (previousZone === ZONES.RIGHT.name && currentZone === ZONES.LEFT.name) {
      direction = 'right-to-left';
      console.log('✓ Direct RIGHT→LEFT zone transition detected');
    }
    // Going through middle - track potential direction (more lenient)
    else if (previousZone === ZONES.LEFT.name && currentZone === ZONES.MIDDLE.name) {
      tracking.movementHistory = [{ from: previousZone, to: currentZone, time: Date.now() }];
    } else if (previousZone === ZONES.MIDDLE.name && currentZone === ZONES.RIGHT.name) {
      const lastMovement = tracking.movementHistory?.[0];
      if (lastMovement && lastMovement.from === ZONES.LEFT.name) {
        direction = 'left-to-right';
        console.log('✓ LEFT→MIDDLE→RIGHT zone transition detected');
        tracking.movementHistory = [];
      }
    } else if (previousZone === ZONES.RIGHT.name && currentZone === ZONES.MIDDLE.name) {
      tracking.movementHistory = [{ from: previousZone, to: currentZone, time: Date.now() }];
    } else if (previousZone === ZONES.MIDDLE.name && currentZone === ZONES.LEFT.name) {
      const lastMovement = tracking.movementHistory?.[0];
      if (lastMovement && lastMovement.from === ZONES.RIGHT.name) {
        direction = 'right-to-left';
        console.log('✓ RIGHT→MIDDLE→LEFT zone transition detected');
        tracking.movementHistory = [];
      }
    }

    tracking.zone = currentZone;
    return direction;
  }

  function isWithinWorkingHours() {
    if (!workstationSchedule || testModeRef.current) return true;

    const now = new Date();
    const today = DAYS_OF_WEEK[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5);
    const todaySchedule = workstationSchedule[today];

    return todaySchedule && todaySchedule.enabled &&
           currentTime >= todaySchedule.startTime &&
           currentTime <= todaySchedule.endTime;
  }

  async function loadActiveSessions() {
    if (!isInitialized) return;
    try {
      const sessions = await faceDB.getActiveSessions();
      setActiveUsers(sessions);
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    }
  }

  function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 3000);
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  async function handleClearAttendance() {
    if (!confirm('Are you sure you want to clear all attendance records?')) return;
    try {
      await faceDB.clearAttendance();
      setActiveUsers([]);
      setRecentActivity([]);
      showNotification('Attendance records cleared', 'success');
    } catch (error) {
      showNotification('Failed to clear attendance', 'error');
    }
  }

  async function handleResetDatabase() {
    if (!confirm('⚠️ WARNING: This will delete ALL data including registered faces. Continue?')) return;
    try {
      await faceDB.resetDatabase();
      window.location.reload();
    } catch (error) {
      showNotification('Failed to reset database', 'error');
    }
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification.show && (
        <div className={`p-4 rounded-lg border-2 ${
          notification.type === 'success'
            ? 'bg-green-50 border-green-500 text-green-900'
            : notification.type === 'error'
            ? 'bg-red-50 border-red-500 text-red-900'
            : 'bg-blue-50 border-blue-500 text-blue-900'
        }`}>
          <p className="font-semibold text-lg">{notification.message}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Attendance Tracking</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAttendanceActive(!isAttendanceActive)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              isAttendanceActive
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isAttendanceActive ? 'Stop Attendance' : 'Start Attendance'}
          </button>
          <button
            onClick={() => setTestMode(!testMode)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              testMode
                ? 'bg-green-500 text-white'
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            Test Mode: {testMode ? 'On' : 'Off'}
          </button>
          <button
            onClick={() => setIsMotionDetectionEnabled(!isMotionDetectionEnabled)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              isMotionDetectionEnabled
                ? 'bg-purple-500 text-white'
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            Motion: {isMotionDetectionEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="video-container relative">
            <video
              ref={videoRef}
              id="video"
              className="w-full rounded-lg"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              id="canvas"
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>

          {/* Debug Panel */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">🔍 Face Detection Debug</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>Faces:</strong> {debugInfo.faces}</div>
              <div><strong>Registered:</strong> {debugInfo.registered}</div>
              <div><strong>Match:</strong> {debugInfo.match}</div>
              <div><strong>Distance:</strong> {debugInfo.distance}</div>
              <div><strong>Zone:</strong> {debugInfo.zone}</div>
              <div><strong>Movement:</strong> {debugInfo.movement}</div>
              <div><strong>Face Size:</strong> {debugInfo.faceSize}</div>
              <div><strong>Velocity:</strong> {debugInfo.velocity}</div>
            </div>

            {/* Distance Warning */}
            {distanceWarning.show && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-400">
                <p className="text-yellow-900 font-semibold text-sm">{distanceWarning.message}</p>
                <p className="text-yellow-800 text-xs mt-1">For best results, stand closer to the camera</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleClearAttendance}
              className="px-3 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              Clear Attendance
            </button>
            <button
              onClick={handleResetDatabase}
              className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Reset Database
            </button>
          </div>
        </div>

        {/* Status Section */}
        <div className="space-y-6">
          {/* Currently Checked In */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Currently Checked In</h3>
            {activeUsers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No users checked in</p>
            ) : (
              <div className="space-y-2">
                {activeUsers.map((user) => {
                  const checkInTime = new Date(user.checkInTime);
                  const duration = Math.round((Date.now() - checkInTime.getTime()) / 1000 / 60);

                  return (
                    <div key={user.faceId} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                      <div>
                        <div className="font-semibold text-green-900">{user.name}</div>
                        <div className="text-sm text-green-700">
                          In: {checkInTime.toLocaleTimeString()} • Duration: {duration < 60 ? `${duration}m` : `${Math.floor(duration/60)}h ${duration % 60}m`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-green-600 font-semibold">🟢 Active</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
              <button
                onClick={async () => {
                  const records = await faceDB.getAllAttendance();
                  setRecentActivity(records.slice(0, 10));
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                🔄 Refresh
              </button>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentActivity.map((record) => {
                  const time = new Date(record.timestamp);
                  const isIn = record.type === 'check-in';
                  const duration = record.duration ? formatDuration(record.duration) : null;

                  return (
                    <div key={record.id} className={`flex justify-between items-center p-3 rounded-lg border ${
                      isIn
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${isIn ? '📥' : '📤'}`}></div>
                        <div>
                          <div className="font-semibold text-gray-900">{record.name}</div>
                          <div className="text-sm text-gray-600">
                            {time.toLocaleDateString()} • {time.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-semibold px-2 py-1 rounded ${
                          isIn
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          {isIn ? 'IN' : 'OUT'}
                        </div>
                        {duration && (
                          <div className="text-xs text-gray-600 mt-1">
                            {duration}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Working Hours Status */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Working Hours</h3>
            <p className={`text-lg font-semibold ${isWithinWorkingHours() ? 'text-green-600' : 'text-yellow-600'}`}>
              {isWithinWorkingHours() ? '✅ Within working hours' : '⚠️ Outside working hours'}
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
            <h3 className="text-xl font-bold text-blue-900 mb-3">🎯 Motion Detection</h3>
            <div className="space-y-2 text-blue-800">
              <p><strong>Check-in:</strong> Walk from <span className="text-blue-600">left → right</span></p>
              <p><strong>Check-out:</strong> Walk from <span className="text-green-600">right → left</span></p>
              <p className="text-sm mt-3 text-blue-700">
                Quick or gradual movements will trigger attendance detection
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Attendance;
