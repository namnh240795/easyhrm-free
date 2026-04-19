import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Home from './pages/Home';
import Attendance from './pages/Attendance';
import Register from './pages/Register';
import Validate from './pages/Validate';
import Workstation from './pages/Workstation';
import Summary from './pages/Summary';
import Layout from './components/Layout';

// Test component
function TestPage() {
  console.log('TestPage rendering!');
  return (
    <div style={{ padding: '2rem', background: 'red', color: 'white' }}>
      <h1>TEST PAGE - If you see this, React Router is working!</h1>
    </div>
  );
}

function App() {
  console.log('App component rendering!');

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="register" element={<Register />} />
        <Route path="validate" element={<Validate />} />
        <Route path="workstation" element={<Workstation />} />
        <Route path="summary" element={<Summary />} />
        <Route path="test" element={<TestPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
