import { cn } from '@/lib/utils';

interface Props {
  /** Percentage 0–100. Clamped internally. */
  pct: number;
  /** Whether this represents a "done" state (renders emerald, hides numeric label, shows checkmark). */
  done?: boolean;
  /** Display size. Default 'sm' (28px); 'lg' is 96px. */
  size?: 'sm' | 'lg';
  className?: string;
}

const SIZE_TO_PX = { sm: 28, lg: 96 } as const;
const SIZE_TO_INNER = { sm: 4, lg: 8 } as const;
const SIZE_TO_TEXT = { sm: 'text-[10px]', lg: 'text-xl' } as const;

export function RingProgress({ pct, done = false, size = 'sm', className }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const degrees = (clamped / 100) * 360;
  const ringColor = done ? '#10b981' : '#0ea5e9';
  const trackColor = '#e5e7eb';
  const pxSize = SIZE_TO_PX[size];
  const inset = SIZE_TO_INNER[size];

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{
        width: pxSize,
        height: pxSize,
        borderRadius: '9999px',
        background: `conic-gradient(${ringColor} 0deg ${degrees}deg, ${trackColor} ${degrees}deg 360deg)`,
        transition: 'background 0.3s ease-out',
      }}
      aria-label={done ? 'Complete' : `${clamped}% complete`}
    >
      <div
        className="absolute bg-white dark:bg-slate-900 rounded-full"
        style={{ inset }}
      />
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center font-semibold tabular-nums',
          SIZE_TO_TEXT[size],
          done ? 'text-done' : 'text-slate-900 dark:text-slate-100'
        )}
      >
        {done ? '✓' : `${clamped}%`}
      </div>
    </div>
  );
}
