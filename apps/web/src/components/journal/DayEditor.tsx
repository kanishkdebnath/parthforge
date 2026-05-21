import { useEffect, useMemo, useState } from 'react';
import type {
  JournalDay,
  Link,
  JournalReference,
  Mood,
  UpsertJournalDayRequest,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useJournalDay, useUpsertJournalDay } from '@/hooks/useJournal';
import { dayLabel } from '@/lib/journalDate';
import { MoodPicker } from './MoodPicker';
import { EventList } from './EventList';
import type { DraftEvent } from './EventRow';
import { LinksEditor } from './LinksEditor';
import { ReferencesPicker } from './ReferencesPicker';

interface DayEditorProps {
  date: string;
}

interface Draft {
  mood: Mood;
  summary: string;
  events: DraftEvent[];
  links: Link[];
  references: JournalReference[];
}

const EMPTY_DRAFT: Draft = {
  mood: { scale: 3, tags: [] },
  summary: '',
  events: [],
  links: [],
  references: [],
};

function dayToDraft(day: JournalDay | null | undefined): Draft {
  if (!day) return EMPTY_DRAFT;
  return {
    mood: { scale: day.mood.scale, tags: [...day.mood.tags] },
    summary: day.summary ?? '',
    events: day.events.map((e) => ({
      _id: e._id,
      text: e.text,
      important: e.important,
      time: e.time,
    })),
    links: day.links.map((l) => ({ ...l })),
    references: day.references.map((r) => ({ ...r })) as JournalReference[],
  };
}

function draftToBody(draft: Draft): UpsertJournalDayRequest {
  return {
    mood: draft.mood,
    summary: draft.summary.trim() ? draft.summary : undefined,
    events: draft.events
      .filter((e) => e.text.trim().length > 0)
      .map((e) => ({
        // strip the client-side uuid; let the server assign an ObjectId
        _id: /^[a-f\d]{24}$/i.test(e._id) ? e._id : undefined,
        text: e.text,
        important: e.important,
        time: e.time?.trim() ? e.time : undefined,
      })),
    links: draft.links.filter((l) => l.url.trim().length > 0),
    references: draft.references,
  };
}

export function DayEditor({ date }: DayEditorProps) {
  const { data: day } = useJournalDay(date);
  const save = useUpsertJournalDay(date);
  const [draft, setDraft] = useState<Draft>(() => dayToDraft(day));

  // Reseed draft when selected day changes or server data lands.
  useEffect(() => {
    setDraft(dayToDraft(day));
  }, [date, day?._id, day?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    return JSON.stringify(dayToDraft(day)) !== JSON.stringify(draft);
  }, [day, draft]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{dayLabel(date)}</h2>
        </div>
        {day?.updatedAt && (
          <div className="text-xs text-slate-400">
            Last saved {new Date(day.updatedAt).toLocaleTimeString()}
          </div>
        )}
      </div>

      <MoodPicker
        value={draft.mood}
        onChange={(mood) => setDraft({ ...draft, mood })}
      />

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Summary
        </div>
        <Input
          value={draft.summary}
          onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          placeholder="A short line about the day"
          maxLength={500}
        />
      </div>

      <EventList
        events={draft.events}
        onChange={(events) => setDraft({ ...draft, events })}
      />

      <LinksEditor
        links={draft.links}
        onChange={(links) => setDraft({ ...draft, links })}
      />

      <ReferencesPicker
        references={draft.references}
        onChange={(references) => setDraft({ ...draft, references })}
      />

      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(draftToBody(draft))}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
