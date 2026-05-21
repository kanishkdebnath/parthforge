import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe } from '@/hooks/useAuth';
import { TOUR_STEPS, type TourStep } from './tourSteps';

type TourContextValue = {
  isDemoUser: boolean;
  open: boolean;
  completedStepIds: Set<string>;
  currentStepId: string | null;
  currentStep: TourStep | null;
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
  const [currentStepId, setCurrentStepId] = useState<string | null>(TOUR_STEPS[0]?.id ?? null);
  const autoOpenedFor = useRef<string | null>(null);
  const prevPathRef = useRef<string | null>(null);
  const prevStepRef = useRef<string | null>(TOUR_STEPS[0]?.id ?? null);
  const location = useLocation();
  const navigate = useNavigate();

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
    navigate('/');
  }, [navigate]);
  const markComplete = useCallback((id: string) => {
    setCompletedStepIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      // Advance currentStepId to the first uncompleted step.
      const nextStep = TOUR_STEPS.find((s) => !next.has(s.id));
      setCurrentStepId(nextStep?.id ?? null);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isDemoUser) return;
    const pathChanged = prevPathRef.current !== location.pathname;
    const stepChanged = prevStepRef.current !== currentStepId;
    prevPathRef.current = location.pathname;
    prevStepRef.current = currentStepId;
    if (!pathChanged) return;
    // If the current step just advanced in the same tick (e.g. a CTA called
    // markComplete and navigated), the navigation has already done its job —
    // do not auto-complete the freshly-current step as well.
    if (stepChanged) return;
    if (!currentStepId) return;
    const step = TOUR_STEPS.find((s) => s.id === currentStepId);
    if (step?.nextOnPath === location.pathname) {
      markComplete(currentStepId);
    }
  }, [isDemoUser, location.pathname, currentStepId, markComplete]);

  const currentStep = currentStepId ? TOUR_STEPS.find((s) => s.id === currentStepId) ?? null : null;

  const value: TourContextValue = {
    isDemoUser,
    open,
    completedStepIds,
    currentStepId,
    currentStep,
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
