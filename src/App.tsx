import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

const DashboardRouter = () => {
  const { user } = useAuth();

  // Route to different dashboards based on role
  if (user?.role === 'ADMIN') {
    return <AdminDashboard />;
  }

  return <EmployeeDashboard />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardRouter />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;
