import { MOOD_TAGS, type Mood, type MoodTag } from '@pathforge/shared';
import { cn } from '@/lib/utils';

const EMOJI = ['😢', '😟', '😐', '🙂', '😄'] as const;

interface MoodPickerProps {
  value: Mood;
  onChange: (next: Mood) => void;
}

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  const setScale = (scale: number) => onChange({ ...value, scale });
  const toggleTag = (tag: MoodTag) => {
    const has = value.tags.includes(tag);
    if (has) {
      onChange({ ...value, tags: value.tags.filter((t) => t !== tag) });
    } else if (value.tags.length < 3) {
      onChange({ ...value, tags: [...value.tags, tag] });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Mood
        </div>
        <div className="flex gap-2">
          {EMOJI.map((face, i) => {
            const scale = i + 1;
            const selected = value.scale === scale;
            return (
              <button
                key={scale}
                type="button"
                onClick={() => setScale(scale)}
                className={cn(
                  'h-10 w-10 rounded-full border text-xl flex items-center justify-center transition',
                  selected
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950 scale-110'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400'
                )}
                aria-pressed={selected}
                aria-label={`Mood ${scale} of 5`}
              >
                {face}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Tags{' '}
          <span className="font-normal normal-case tracking-normal text-slate-400">
            (up to 3)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map((tag) => {
            const selected = value.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'px-3 py-1 rounded-full border text-xs transition',
                  selected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                )}
                aria-pressed={selected}
                disabled={!selected && value.tags.length >= 3}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
