import { useState, useEffect, useRef } from 'react';
import { useFaceDB } from '../hooks/useFaceDB';

// Use global faceapi loaded from CDN

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.5;

function Validate() {
  const { faceDB, isInitialized } = useFaceDB();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [mode, setMode] = useState('manual'); // 'manual' or 'auto'
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanIntervalRef = useRef(null);

  // Load models
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
      } catch (error) {
        console.error('Failed to load faces:', error);
      }
    }
    loadFaces();
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
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [modelsLoaded, mode]);

  function startFaceDetection() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    const detectAndDraw = async () => {
      if (video.paused || video.ended) return;

      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

      if (mode === 'auto' && detections.length > 0) {
        validateFace(detections[0]);
      }
    };

    // Start detection loop
    if (mode === 'auto') {
      scanIntervalRef.current = setInterval(detectAndDraw, 500);
    } else {
      detectAndDraw(); // Run once for manual mode
    }
  }

  function validateFace(detection) {
    if (registeredFaces.length === 0) {
      setCurrentMatch({ found: false, reason: 'No registered faces' });
      return;
    }

    const match = findMatch(detection.descriptor);

    if (match) {
      setCurrentMatch({
        found: true,
        name: match.face.name,
        confidence: match.confidence,
        distance: match.distance,
        registeredAt: match.face.createdAt
      });
    } else {
      setCurrentMatch({ found: false, reason: 'No matching face found' });
    }
  }

  function findMatch(descriptor) {
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

  function handleManualScan() {
    if (!videoRef.current) return;

    faceapi.detectAllFaces(videoRef.current)
      .withFaceLandmarks()
      .withFaceDescriptors()
      .then(detections => {
        if (detections.length > 0) {
          validateFace(detections[0]);
        } else {
          setCurrentMatch({ found: false, reason: 'No face detected' });
        }
      });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Validate Face</h2>
          <p className="text-gray-600">Verify faces against registered users</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              mode === 'manual'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setMode('auto')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              mode === 'auto'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Auto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="video-container relative mb-4">
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

          {mode === 'manual' && (
            <button
              onClick={handleManualScan}
              disabled={!modelsLoaded}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Scan Face
            </button>
          )}

          {mode === 'auto' && (
            <div className="text-center py-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-800 font-semibold">🔄 Auto-scanning active</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {/* Validation Result */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Validation Result</h3>

            {!currentMatch ? (
              <div className="text-center py-8 text-gray-500">
                <p>No scan performed yet</p>
                <p className="text-sm mt-2">
                  {mode === 'manual' ? 'Click "Scan Face" to validate' : 'Look at the camera for automatic validation'}
                </p>
              </div>
            ) : currentMatch.found ? (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-green-800 font-bold text-lg">✓ Face Matched!</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-semibold text-gray-900">{currentMatch.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confidence:</span>
                    <span className="font-semibold text-green-600">{currentMatch.confidence.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Distance:</span>
                    <span className="font-semibold text-gray-900">{currentMatch.distance.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registered:</span>
                    <span className="text-sm text-gray-600">
                      {new Date(currentMatch.registeredAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-800 font-bold">✗ {currentMatch.reason}</p>
              </div>
            )}
          </div>

          {/* Registered Faces Count */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Database</h3>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Registered faces:</span>
              <span className="text-2xl font-bold text-blue-600">{registeredFaces.length}</span>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Validation Info</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• <strong>Manual mode:</strong> Click to scan once</li>
              <li>• <strong>Auto mode:</strong> Continuously scans for faces</li>
              <li>• Match threshold: {(MATCH_THRESHOLD * 100).toFixed(0)}% confidence</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Validate;
