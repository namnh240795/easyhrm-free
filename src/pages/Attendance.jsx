import { useState, useEffect, useRef } from 'react';
import { useFaceDB } from '../hooks/useFaceDB';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.5;
const SCAN_COOLDOWN = 5000;

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
  const [lastScan, setLastScan] = useState(null);

  // Debug state
  const [debugInfo, setDebugInfo] = useState({
    faces: 0,
    registered: 0,
    match: '-',
    distance: '-',
    zone: '-',
    movement: '-'
  });

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
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
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
  const faceTrackingRef = useRef({});

  function startFaceDetection() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    const scanInterval = setInterval(async () => {
      if (video.paused || video.ended) return;

      // Detect faces
      const detections = await faceapi
        .detectAllFaces(video)
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
      if (isAttendanceActive && detections.length > 0) {
        await processFaceDetection(detections, displaySize.width);
      }
    }, 500);

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
      }
    }
  }

  function getFaceCenterX(detection) {
    const box = detection.detection.box;
    return (box.x + box.width / 2) / videoRef.current.videoWidth;
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

  async function processFaceDetection(detections, videoWidth) {
    const now = Date.now();

    if (lastScan && now - lastScan.time < SCAN_COOLDOWN) return;

    for (const detection of detections) {
      const match = findMatch(detection.descriptor);
      if (!match) continue;

      const faceCenterX = getFaceCenterX(detection);
      const currentZone = getZoneForPosition(faceCenterX);

      if (!faceTrackingRef.current[match.face.id]) {
        faceTrackingRef.current[match.face.id] = {
          zone: null,
          movementHistory: []
        };
      }

      const tracking = faceTrackingRef.current[match.face.id];
      const direction = detectZoneTransition(tracking, currentZone);

      if (direction && isMotionDetectionEnabled && isWithinWorkingHours()) {
        if (direction === 'left-to-right') {
          const isCheckedIn = await faceDB.isCheckedIn(match.face.id);
          if (!isCheckedIn) {
            await faceDB.recordCheckIn(match.face.id, match.face.name, match.confidence);
            showNotification(`Checked in: ${match.face.name}`, 'success');
            loadActiveSessions();
          }
        } else if (direction === 'right-to-left') {
          const isCheckedIn = await faceDB.isCheckedIn(match.face.id);
          if (isCheckedIn) {
            await faceDB.recordCheckOut(match.face.id, match.face.name, match.confidence);
            showNotification(`Checked out: ${match.face.name}`, 'success');
            loadActiveSessions();
          }
        }

        setLastScan({ time: now, userId: match.face.id });
        break;
      }
    }
  }

  function detectZoneTransition(tracking, currentZone) {
    if (!tracking.zone) {
      tracking.zone = currentZone;
      return null;
    }

    const previousZone = tracking.zone;
    if (previousZone === currentZone) return null;

    let direction = null;

    if (previousZone === ZONES.LEFT.name && currentZone === ZONES.MIDDLE.name) {
      tracking.movementHistory.push({ from: previousZone, to: currentZone, time: Date.now() });
      direction = 'left-to-right';
    } else if (previousZone === ZONES.MIDDLE.name && currentZone === ZONES.RIGHT.name) {
      const lastMovement = tracking.movementHistory[tracking.movementHistory.length - 1];
      if (lastMovement && lastMovement.from === ZONES.LEFT.name) {
        direction = 'left-to-right';
        tracking.movementHistory = [];
      }
    } else if (previousZone === ZONES.RIGHT.name && currentZone === ZONES.MIDDLE.name) {
      tracking.movementHistory.push({ from: previousZone, to: currentZone, time: Date.now() });
      direction = 'right-to-left';
    } else if (previousZone === ZONES.MIDDLE.name && currentZone === ZONES.LEFT.name) {
      const lastMovement = tracking.movementHistory[tracking.movementHistory.length - 1];
      if (lastMovement && lastMovement.from === ZONES.RIGHT.name) {
        direction = 'right-to-left';
        tracking.movementHistory = [];
      }
    }

    tracking.zone = currentZone;
    return direction;
  }

  function isWithinWorkingHours() {
    if (!workstationSchedule || testMode) return true;

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
    // Simple notification - could be enhanced with a toast library
    console.log(`[${type.toUpperCase()}] ${message}`);
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
            </div>
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
                {activeUsers.map((user) => (
                  <div key={user.faceId} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <div className="font-semibold text-green-900">{user.name}</div>
                      <div className="text-sm text-green-700">
                        Since {new Date(user.checkInTime).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
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
                Face must cross through all 3 zones to trigger attendance
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Attendance;
