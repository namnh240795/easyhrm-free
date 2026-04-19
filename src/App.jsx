import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Attendance from './pages/Attendance';
import Register from './pages/Register';
import Validate from './pages/Validate';
import Workstation from './pages/Workstation';
import Summary from './pages/Summary';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/register" element={<Register />} />
        <Route path="/validate" element={<Validate />} />
        <Route path="/workstation" element={<Workstation />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
