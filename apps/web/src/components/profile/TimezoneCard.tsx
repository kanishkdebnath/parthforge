import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMe, useUpdateMe } from '@/hooks/useAuth';

// Curated fallback for browsers without Intl.supportedValuesOf (Safari < 17).
// Not exhaustive — covers the broad regions a user is likely to pick.
const FALLBACK_TIMEZONES = [
  'UTC',
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Moscow',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore',
  'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Honolulu',
];

function allTimezones(): readonly string[] {
  // Modern browsers + Node 18+. Cast because TypeScript lib types lag.
  const supportedValuesOf = (Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
  }).supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    return supportedValuesOf('timeZone');
  }
  return FALLBACK_TIMEZONES;
}

function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function TimezoneCard() {
  const { data: me } = useMe();
  const update = useUpdateMe();
  const options = useMemo(() => allTimezones(), []);
  const detected = useMemo(() => detectedTimezone(), []);

  const [selected, setSelected] = useState<string | null>(me?.timezone ?? null);
  const [filter, setFilter] = useState('');

  // Keep the draft in sync if me.timezone is updated externally
  // (e.g., another tab saving + cache refetch).
  useEffect(() => {
    setSelected(me?.timezone ?? null);
  }, [me?.timezone]);

  const filtered = useMemo(() => {
    if (!filter) return options;
    const lc = filter.toLowerCase();
    return options.filter((tz) => tz.toLowerCase().includes(lc));
  }, [options, filter]);

  if (!me) return null;

  const current = me.timezone ?? null;
  const dirty = selected !== current;
  const showClear = current !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timezone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your timezone determines what &quot;today&quot; means across the app — journal
          entries, demo data, and future scheduled reminders.
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Current:{' '}
            <span className="font-medium text-foreground">
              {current ?? 'Not set'}
            </span>
          </div>
          <div>
            Detected: <span className="text-foreground">{detected}</span>
            {selected !== detected && (
              <button
                type="button"
                onClick={() => setSelected(detected)}
                className="ml-2 text-sky-600 dark:text-sky-400 hover:underline"
              >
                use detected
              </button>
            )}
          </div>
        </div>

        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter timezones…"
          aria-label="Filter timezones"
        />

        <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No matching zones
            </div>
          )}
          {filtered.map((tz) => {
            const isSelected = selected === tz;
            return (
              <button
                key={tz}
                type="button"
                onClick={() => setSelected(tz)}
                className={cn(
                  'block w-full text-left px-3 py-1.5 text-sm transition',
                  isSelected
                    ? 'bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                )}
              >
                {tz}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {showClear && (
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => {
                setSelected(null);
                update.mutate({ timezone: null });
              }}
            >
              Clear
            </Button>
          )}
          <Button
            type="button"
            disabled={!dirty || selected === null || update.isPending}
            onClick={() => update.mutate({ timezone: selected })}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
