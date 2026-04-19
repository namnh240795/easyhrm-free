import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

function Layout() {
  const location = useLocation();
  console.log('Layout rendering, current path:', location.pathname);
  console.log('Outlet component:', Outlet);

  const navigation = [
    { name: 'Home', href: '/', icon: '🏠' },
    { name: 'Attendance', href: '/attendance', icon: '⏰' },
    { name: 'Register', href: '/register', icon: '📝' },
    { name: 'Validate', href: '/validate', icon: '✅' },
    { name: 'Workstation', href: '/workstation', icon: '🖥️' },
    { name: 'Summary', href: '/summary', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Face Recognition HRM</h1>
              <p className="text-sm text-gray-600 mt-1">Client-side attendance tracking with motion detection</p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>🔒 All data stored locally in your browser using IndexedDB</p>
            <p className="mt-2">Powered by face-api.js | Pure client-side face recognition</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
