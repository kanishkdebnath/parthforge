import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMe } from '@/hooks/useAuth';
import { TOUR_STEPS } from './tourSteps';

type TourContextValue = {
  isDemoUser: boolean;
  open: boolean;
  completedStepIds: Set<string>;
  currentStepId: string | null;
  openPanel: () => void;
  closePanel: () => void;
  restart: () => void;
  markComplete: (id: string) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const isDemoUser = me?.isDemoUser === true;

  const [open, setOpen] = useState(false);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const autoOpenedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isDemoUser || !me) return;
    if (autoOpenedFor.current === me._id) return;
    autoOpenedFor.current = me._id;
    setOpen(true);
  }, [isDemoUser, me]);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const restart = useCallback(() => {
    setCompletedStepIds(new Set());
    setCurrentStepId(TOUR_STEPS[0]?.id ?? null);
    setOpen(true);
  }, []);
  const markComplete = useCallback((id: string) => {
    setCompletedStepIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setCurrentStepId(id);
  }, []);

  const value: TourContextValue = {
    isDemoUser,
    open,
    completedStepIds,
    currentStepId,
    openPanel,
    closePanel,
    restart,
    markComplete,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within <TourProvider>');
  return ctx;
}
