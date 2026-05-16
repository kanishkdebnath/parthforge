import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMe } from '@/hooks/useAuth';

interface Props {
  children: ReactNode;
}

export function RequireAuth({ children }: Props) {
  const location = useLocation();
  const { data, isPending } = useMe();

  if (isPending) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }
  if (!data) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
