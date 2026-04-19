import { useState, useEffect, useRef } from 'react';
import { useFaceDB } from '../hooks/useFaceDB';

// Use global faceapi loaded from CDN

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MATCH_THRESHOLD = 0.5;

function Register() {
  const { faceDB, isInitialized } = useFaceDB();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [name, setName] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [currentDescriptor, setCurrentDescriptor] = useState(null);
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

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
    };
  }, [modelsLoaded]);

  function startFaceDetection() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    const scanInterval = setInterval(async () => {
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

      if (detections.length > 0 && isCapturing) {
        setCurrentDescriptor(detections[0].descriptor);
        checkForDuplicates(detections[0].descriptor);
      }
    }, 100);

    return () => clearInterval(scanInterval);
  }

  function checkForDuplicates(descriptor) {
    if (registeredFaces.length === 0) {
      setDuplicateCheck(null);
      return;
    }

    let bestDistance = Infinity;
    let bestMatch = null;

    for (const face of registeredFaces) {
      const distance = euclideanDistance(descriptor, face.descriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = face;
      }
    }

    if (bestDistance <= MATCH_THRESHOLD) {
      setDuplicateCheck({
        exists: true,
        face: bestMatch,
        distance: bestDistance,
        confidence: Math.max(0, Math.min(100, (1 - (bestDistance / MATCH_THRESHOLD)) * 100))
      });
    } else {
      setDuplicateCheck({ exists: false });
    }
  }

  function euclideanDistance(descriptor1, descriptor2) {
    return Math.sqrt(
      descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0)
    );
  }

  async function handleRegister(e) {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }

    if (!currentDescriptor) {
      alert('No face detected. Please look at the camera.');
      return;
    }

    if (duplicateCheck?.exists) {
      if (!confirm(`This face looks similar to ${duplicateCheck.face.name}. Register anyway?`)) {
        return;
      }
    }

    try {
      const faceId = await faceDB.addFace(name.trim(), currentDescriptor);
      setRegistrationSuccess(true);

      // Reload faces
      const faces = await faceDB.getAllFaces();
      setRegisteredFaces(faces);

      // Reset form
      setName('');
      setCurrentDescriptor(null);
      setDuplicateCheck(null);
      setIsCapturing(false);

      setTimeout(() => setRegistrationSuccess(false), 3000);
    } catch (error) {
      alert(`Registration failed: ${error.message}`);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Register Face</h2>
        <p className="text-gray-600">Capture and store face descriptors for recognition</p>
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

          <div className="space-y-3">
            <button
              onClick={() => setIsCapturing(!isCapturing)}
              disabled={!modelsLoaded}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                isCapturing
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } ${!modelsLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isCapturing ? 'Stop Capture' : 'Start Face Capture'}
            </button>

            {currentDescriptor && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-800 font-semibold">✓ Face detected!</p>
                <p className="text-sm text-green-700">Ready to register</p>
              </div>
            )}

            {duplicateCheck?.exists && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-yellow-800 font-semibold">⚠️ Similar face found</p>
                <p className="text-sm text-yellow-700">
                  Matches {duplicateCheck.face.name} ({duplicateCheck.confidence.toFixed(0)}% confidence)
                </p>
              </div>
            )}

            {registrationSuccess && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-800 font-semibold">✓ Registration successful!</p>
              </div>
            )}
          </div>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Register New Face</h3>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!currentDescriptor || !name.trim()}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
                currentDescriptor && name.trim()
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Register Face
            </button>
          </form>

          {/* Registered Faces List */}
          <div className="mt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              Registered Faces ({registeredFaces.length})
            </h4>
            {registeredFaces.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No faces registered yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {registeredFaces.map((face) => (
                  <div
                    key={face.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{face.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(face.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete ${face.name}?`)) {
                          await faceDB.deleteFace(face.id);
                          const faces = await faceDB.getAllFaces();
                          setRegisteredFaces(faces);
                        }
                      }}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-2">📝 Registration Instructions</h3>
        <ul className="space-y-2 text-blue-800">
          <li>1. Enter your full name in the form</li>
          <li>2. Click "Start Face Capture" to enable face detection</li>
          <li>3. Position your face clearly in front of the camera</li>
          <li>4. Wait for "Face detected!" confirmation</li>
          <li>5. Click "Register Face" to save your face descriptor</li>
          <li className="text-sm text-blue-700 mt-2">
            Note: Your face data is stored locally in your browser using IndexedDB
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Register;
