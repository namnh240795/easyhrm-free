import { Link } from 'react-router-dom';

function Home() {
  const features = [
    {
      title: 'Workstation',
      description: 'Configure your workstation settings and working hours schedule',
      icon: '🖥️',
      link: '/workstation',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Attendance',
      description: 'Automatic check-in/check-out with motion-based face detection',
      icon: '⏰',
      link: '/attendance',
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'Register Face',
      description: 'Capture and store face descriptors for recognition',
      icon: '📝',
      link: '/register',
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Validate Face',
      description: 'Verify faces against registered users',
      icon: '✅',
      link: '/validate',
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Summary Report',
      description: 'View daily attendance summaries and working hours',
      icon: '📊',
      link: '/summary',
      color: 'from-pink-500 to-pink-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Face Recognition HRM
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          A complete client-side attendance tracking system with motion-based check-in/check-out
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <Link
            key={feature.title}
            to={feature.link}
            className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
            <div className="relative p-8">
              <div className="text-6xl mb-4">{feature.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 mb-4">{feature.description}</p>
              <div className="flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                <span>Get Started</span>
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">1</span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Register Your Face</h4>
            <p className="text-gray-600 text-sm">Capture your face descriptor stored locally in IndexedDB</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-green-600">2</span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Configure Workstation</h4>
            <p className="text-gray-600 text-sm">Set up working hours for each day of the week</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-purple-600">3</span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Track Attendance</h4>
            <p className="text-gray-600 text-sm">Motion detection automatically checks you in/out</p>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">🔒</div>
          <div>
            <h4 className="text-lg font-semibold text-amber-900 mb-2">Privacy First</h4>
            <p className="text-amber-800 text-sm">
              All face data is stored locally in your browser using IndexedDB. No data is sent to any server.
              Your face information never leaves your device. The entire system runs client-side.
            </p>
          </div>
        </div>
      </div>

      {/* Motion Detection Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">🎯</div>
          <div>
            <h4 className="text-lg font-semibold text-blue-900 mb-2">Motion-Based Detection</h4>
            <p className="text-blue-800 text-sm mb-3">
              Walk from <strong>left to right</strong> to check in, <strong>right to left</strong> to check out.
              The system tracks your face position across 3 zones to automatically record attendance.
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-200 rounded border-2 border-blue-400 flex items-center justify-center text-xs font-bold">L</div>
                <span className="text-blue-700">← Check-in</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-200 rounded border-2 border-gray-400 flex items-center justify-center text-xs font-bold">M</div>
                <span className="text-blue-700">Transit</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-200 rounded border-2 border-green-400 flex items-center justify-center text-xs font-bold">R</div>
                <span className="text-blue-700">Check-out →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
