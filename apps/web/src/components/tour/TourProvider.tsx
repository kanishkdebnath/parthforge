import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe } from '@/hooks/useAuth';
import { TOUR_STEPS, type TourStep, type TourStepGroup } from './tourSteps';

export type SectionStatus = {
  total: number;
  completed: number;
  state: 'not-started' | 'in-progress' | 'done';
};

type TourContextValue = {
  isDemoUser: boolean;
  open: boolean;
  completedStepIds: Set<string>;

  /** null = on the menu, group name = inside that section's step list */
  activeSection: TourStepGroup | null;
  /** Currently-focused step within the active section (null on menu). */
  currentStepId: string | null;
  currentStep: TourStep | null;

  /** Per-section status used by the menu cards. */
  sectionStatus: (group: TourStepGroup) => SectionStatus;

  openPanel: () => void;
  closePanel: () => void;
  /** Open a section. If status is 'done' and resetIfDone is true, clears
   *  that section's completion before opening (the "Re-run" path). */
  openSection: (group: TourStepGroup, opts?: { resetIfDone?: boolean }) => void;
  /** Return to the menu without losing per-section progress. */
  backToMenu: () => void;

  restart: () => void;
  markComplete: (id: string) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function firstUncompletedInGroup(
  group: TourStepGroup,
  completed: Set<string>
): string | null {
  const step = TOUR_STEPS.find((s) => s.group === group && !completed.has(s.id));
  return step?.id ?? null;
}

function isGroupComplete(group: TourStepGroup, completed: Set<string>): boolean {
  const groupSteps = TOUR_STEPS.filter((s) => s.group === group);
  return groupSteps.length > 0 && groupSteps.every((s) => completed.has(s.id));
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const isDemoUser = me?.isDemoUser === true;

  const [open, setOpen] = useState(false);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const [activeSection, setActiveSection] = useState<TourStepGroup | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const autoOpenedFor = useRef<string | null>(null);
  const prevPathRef = useRef<string | null>(null);
  const prevStepRef = useRef<string | null>(null);
  const autoReturnTimer = useRef<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-open on first sight of the demo user.
  useEffect(() => {
    if (!isDemoUser || !me) return;
    if (autoOpenedFor.current === me._id) return;
    autoOpenedFor.current = me._id;
    setOpen(true);
  }, [isDemoUser, me]);

  // Clear pending auto-return timer on unmount.
  useEffect(() => {
    return () => {
      if (autoReturnTimer.current !== null) {
        window.clearTimeout(autoReturnTimer.current);
      }
    };
  }, []);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);

  const openSection = useCallback(
    (group: TourStepGroup, opts?: { resetIfDone?: boolean }) => {
      setCompletedStepIds((prev) => {
        let nextCompleted = prev;
        if (opts?.resetIfDone && isGroupComplete(group, prev)) {
          nextCompleted = new Set(prev);
          for (const s of TOUR_STEPS) {
            if (s.group === group) nextCompleted.delete(s.id);
          }
        }
        const focus = firstUncompletedInGroup(group, nextCompleted) ??
          // If the group is fully complete (resetIfDone was false), focus its
          // first step so the in-section view has something to highlight.
          TOUR_STEPS.find((s) => s.group === group)?.id ??
          null;
        setActiveSection(group);
        setCurrentStepId(focus);
        return nextCompleted;
      });
    },
    []
  );

  const backToMenu = useCallback(() => {
    setActiveSection(null);
  }, []);

  const restart = useCallback(() => {
    if (autoReturnTimer.current !== null) {
      window.clearTimeout(autoReturnTimer.current);
      autoReturnTimer.current = null;
    }
    setCompletedStepIds(new Set());
    setActiveSection(null);
    setCurrentStepId(null);
    setOpen(true);
    navigate('/');
  }, [navigate]);

  const markComplete = useCallback((id: string) => {
    setCompletedStepIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);

      const step = TOUR_STEPS.find((s) => s.id === id);
      const group = step?.group ?? null;

      // Advance currentStepId to the next uncompleted step WITHIN the active
      // section. Don't bleed into another group.
      if (activeSection && group === activeSection) {
        const focus = firstUncompletedInGroup(activeSection, next);
        setCurrentStepId(focus);

        // If the active section is now fully complete, return to menu after
        // a short beat so the user sees the final checkmark land.
        if (isGroupComplete(activeSection, next)) {
          if (autoReturnTimer.current !== null) {
            window.clearTimeout(autoReturnTimer.current);
          }
          autoReturnTimer.current = window.setTimeout(() => {
            setActiveSection(null);
            autoReturnTimer.current = null;
          }, 200);
        }
      }

      return next;
    });
  }, [activeSection]);

  // Path-based auto-advance — scoped to the active section. No-op on menu.
  useEffect(() => {
    if (!isDemoUser) return;
    if (activeSection === null) {
      prevPathRef.current = location.pathname;
      prevStepRef.current = currentStepId;
      return;
    }
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
    if (step?.group !== activeSection) return;
    if (step?.nextOnPath === location.pathname) {
      markComplete(currentStepId);
    }
  }, [isDemoUser, location.pathname, currentStepId, activeSection, markComplete]);

  const currentStep =
    currentStepId ? TOUR_STEPS.find((s) => s.id === currentStepId) ?? null : null;

  const sectionStatus = useCallback(
    (group: TourStepGroup): SectionStatus => {
      const groupSteps = TOUR_STEPS.filter((s) => s.group === group);
      const total = groupSteps.length;
      const completed = groupSteps.filter((s) => completedStepIds.has(s.id)).length;
      let state: SectionStatus['state'] = 'not-started';
      if (total > 0 && completed === total) state = 'done';
      else if (completed > 0) state = 'in-progress';
      return { total, completed, state };
    },
    [completedStepIds]
  );

  const value: TourContextValue = {
    isDemoUser,
    open,
    completedStepIds,
    activeSection,
    currentStepId,
    currentStep,
    sectionStatus,
    openPanel,
    closePanel,
    openSection,
    backToMenu,
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
