import { Route, Routes } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { RequireAuth } from '@/components/RequireAuth';
import { TourProvider } from '@/components/tour/TourProvider';
import { TourPanel } from '@/components/tour/TourPanel';
import { TourCallout } from '@/components/tour/TourCallout';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import RoadmapsListPage from '@/pages/RoadmapsListPage';
import RoadmapDetailPage from '@/pages/RoadmapDetailPage';
import JobsListPage from '@/pages/JobsListPage';
import JobDetailPage from '@/pages/JobDetailPage';
import JournalPage from '@/pages/JournalPage';

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
    <TourProvider>
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
        <Route path="/journal" element={<Protected><JournalPage /></Protected>} />
        <Route path="*" element={<Protected><Dashboard /></Protected>} />
      </Routes>
      <TourPanel />
      <TourCallout />
    </TourProvider>
  );
}
