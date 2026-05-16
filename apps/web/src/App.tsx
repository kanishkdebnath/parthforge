import { Route, Routes } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { RequireAuth } from '@/components/RequireAuth';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Navbar />
      {children}
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <Profile />
          </Protected>
        }
      />
      <Route path="*" element={<Protected><Dashboard /></Protected>} />
    </Routes>
  );
}
