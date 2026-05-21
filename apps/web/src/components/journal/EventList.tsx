import { EventRow, type DraftEvent } from './EventRow';

interface EventListProps {
  events: DraftEvent[];
  onChange: (next: DraftEvent[]) => void;
}

export function EventList({ events, onChange }: EventListProps) {
  const update = (index: number, next: DraftEvent) => {
    onChange(events.map((e, i) => (i === index ? next : e)));
  };
  const remove = (index: number) => onChange(events.filter((_, i) => i !== index));
  const add = () => {
    if (events.length >= 20) return;
    onChange([
      ...events,
      {
        _id: crypto.randomUUID(),
        text: '',
        important: false,
      },
    ]);
  };

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        Events
      </div>
      <div>
        {events.map((e, i) => (
          <EventRow
            key={e._id}
            event={e}
            onChange={(next) => update(i, next)}
            onDelete={() => remove(i)}
          />
        ))}
      </div>
      {events.length < 20 && (
        <button
          type="button"
          onClick={add}
          className="mt-2 px-3 py-1.5 text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          + add event
        </button>
      )}
    </div>
  );
}
