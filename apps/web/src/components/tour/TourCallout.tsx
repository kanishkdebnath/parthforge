import { useLayoutEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTour } from './TourProvider';

type Position = { top: number; left: number };

export function TourCallout() {
  const { isDemoUser, currentStep } = useTour();
  const [pos, setPos] = useState<Position | null>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (!isDemoUser || !currentStep?.target) {
      setPos(null);
      setVisible(false);
      return;
    }

    const compute = () => {
      const el = document.querySelector(currentStep.target!);
      if (!el) {
        setVisible(false);
        return;
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      setPos({
        top: rect.bottom + 12,
        left: rect.left + rect.width / 2,
      });
      setVisible(true);
    };

    // Run once after layout, then re-run after a short delay
    // (in case the target animates in or the route just changed).
    compute();
    const retry = window.setTimeout(compute, 80);

    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);

    return () => {
      window.clearTimeout(retry);
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [isDemoUser, currentStep]);

  if (!isDemoUser || !currentStep?.target || !visible || !pos) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed z-[60] -translate-x-1/2"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Arrow pointing up at the target */}
      <div
        aria-hidden="true"
        className="mx-auto h-0 w-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-sky-500"
      />
      <div className="pointer-events-auto mt-0 max-w-xs rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white shadow-2xl shadow-sky-900/30 ring-1 ring-sky-400/40 backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-100" aria-hidden="true" />
          <div>
            <div className="font-semibold text-white">{currentStep.title}</div>
            <div className="mt-0.5 text-[11px] font-normal text-sky-50">{currentStep.body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
