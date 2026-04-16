# GitHub Pages Face Recognition System

A complete client-side face recognition system built with **face-api.js** and **IndexedDB**. Register and validate faces directly in your browser - no server required!

## Features

- **Face Registration**: Capture and store face descriptors for future recognition
- **Face Validation**: Real-time face matching with confidence scoring
- **Local Storage**: All data stored locally using IndexedDB - nothing leaves your device
- **Privacy First**: Complete privacy - no data transmitted to any server
- **GitHub Pages Ready**: Deploy as a static site
- **Mobile Friendly**: Responsive design works on all devices

## Demo

Try the live demo: [Your GitHub Pages URL]

## How It Works

1. **Register**: Capture your face descriptor (128-dimensional vector) and store it with a name
2. **Validate**: Point your camera at the system to verify if the face matches any registered users
3. **Matching**: Uses Euclidean distance to compare face descriptors with configurable threshold

## Installation

### Option 1: Clone Repository

```bash
git clone https://github.com/your-username/easyhrm-free.git
cd easyhrm-free
```

### Option 2: Manual Setup

1. Create a new GitHub repository
2. Add all project files
3. Enable GitHub Pages

## Local Testing

Simply open `index.html` in your browser:

```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

Or use a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js (with http-server)
npx http-server
```

Then visit: `http://localhost:8000`

## GitHub Pages Deployment

### Method 1: Using main branch

1. Push code to GitHub repository
2. Go to repository **Settings**
3. Navigate to **Pages** section
4. Under **Source**, select **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**
7. Your site will be live at: `https://your-username.github.io/easyhrm-free/`

### Method 2: Using gh-pages branch

```bash
# Create and switch to gh-pages branch
git checkout --orphan gh-pages

# Add all files
git add .
git commit -m "Initial GitHub Pages deployment"

# Push to GitHub
git push origin gh-pages
```

Then configure GitHub Pages to use the `gh-pages` branch.

## Usage

### Registering a Face

1. Navigate to the **Register Face** page
2. Wait for models to load (may take a few seconds on first load)
3. Allow camera access when prompted
4. Position your face in the camera frame
5. Enter your name in the input field
6. Click **Register Face**
7. Your face descriptor is now stored locally

### Validating a Face

1. Navigate to the **Validate Face** page
2. Wait for models to load
3. Allow camera access when prompted
4. Choose a validation method:
   - **Manual**: Click "Capture & Validate" to check if your face matches
   - **Auto**: Enable "Auto-Validate" for continuous real-time matching

### Understanding Results

- **Distance Score**: Lower is better (0 = perfect match)
  - < 0.4: Very confident match
  - 0.4 - 0.6: Likely match
  - \> 0.6: No match
- **Confidence %**: How confident the system is about the match

## Project Structure

```
easyhrm-free/
├── index.html              # Main landing page
├── register.html           # Face registration page
├── validate.html           # Face validation page
├── js/
│   ├── db.js              # IndexedDB wrapper
│   ├── register.js        # Registration logic
│   └── validate.js        # Validation logic
├── css/
│   └── style.css          # Styling
└── README.md              # This file
```

## Technical Details

### Face Recognition Models

The system uses **face-api.js** (by @vladmandic) with the following models:
- **SSD MobileNet v1**: Face detection
- **Face Landmark 68**: Facial feature points
- **Face Recognition**: 128-dimensional descriptor extraction

Models are loaded from CDN:
```
https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/
```

### Data Storage

**IndexedDB** is used for persistent local storage:
- Database: `FaceRecognitionDB`
- Object Store: `registeredFaces`
- Fields:
  - `id`: Auto-increment primary key
  - `name`: User's name
  - `descriptor`: Face descriptor array
  - `createdAt`: Registration timestamp

### Matching Algorithm

**Euclidean Distance** calculation:
```javascript
distance = sqrt(sum((descriptor1[i] - descriptor2[i])^2))
```

### Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Opera: ✅ Full support

**Required Features:**
- WebRTC (getUserMedia)
- IndexedDB
- ES6 JavaScript
- Canvas API

## Privacy & Security

- ✅ All data stored locally in browser
- ✅ No server communication
- ✅ No external tracking
- ✅ Face descriptors stored as number arrays (not images)
- ✅ Clear data anytime via browser DevTools

To clear all stored data:
1. Open browser DevTools (F12)
2. Go to **Application** tab
3. Expand **IndexedDB**
4. Right-click `FaceRecognitionDB` → **Delete database**

## Troubleshooting

### Camera Not Working

- Ensure browser has camera permissions
- Check if another application is using the camera
- Try refreshing the page
- Use HTTPS (required for camera access on most browsers)

### Models Not Loading

- Check internet connection (models load from CDN)
- Try clearing browser cache
- Check browser console for errors

### Face Not Detected

- Ensure good lighting
- Position face directly at camera
- Remove glasses if detection fails
- Try moving closer/further from camera

## Future Enhancements

Potential improvements:
- [ ] Multiple face registration per person
- [ ] Liveness detection (anti-spoofing)
- [ ] Export/import face data
- [ ] Face clustering/grouping
- [ ] Attendance tracking system
- [ ] Admin dashboard

## License

MIT License - feel free to use for personal or commercial projects.

## Credits

- **face-api.js** by Vincent Mühler & Vladimir Mandic
- Built with vanilla JavaScript (no frameworks)
- Icons: Unicode emojis

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Open an issue on GitHub
3. Check browser console for errors

---

**Note**: This is a client-side only implementation. For production use with many users, consider implementing proper authentication, HTTPS, and server-side validation.
