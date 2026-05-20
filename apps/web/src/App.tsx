import { Route, Routes } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { RequireAuth } from '@/components/RequireAuth';
import { TourProvider } from '@/components/tour/TourProvider';
import { TourPanel } from '@/components/tour/TourPanel';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import RoadmapsListPage from '@/pages/RoadmapsListPage';
import RoadmapDetailPage from '@/pages/RoadmapDetailPage';
import JobsListPage from '@/pages/JobsListPage';
import JobDetailPage from '@/pages/JobDetailPage';

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <TourProvider>
        <Navbar />
        {children}
        <TourPanel />
      </TourProvider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/roadmaps" element={<Protected><RoadmapsListPage /></Protected>} />
      <Route path="/roadmaps/archived" element={<Protected><RoadmapsListPage archived /></Protected>} />
      <Route path="/roadmaps/:id" element={<Protected><RoadmapDetailPage /></Protected>} />
      <Route path="/jobs" element={<Protected><JobsListPage /></Protected>} />
      <Route path="/jobs/archived" element={<Protected><JobsListPage archived /></Protected>} />
      <Route path="/jobs/:id" element={<Protected><JobDetailPage /></Protected>} />
      <Route path="*" element={<Protected><Dashboard /></Protected>} />
    </Routes>
  );
}
