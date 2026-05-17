import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useAddMilestone } from '@/hooks/useRoadmaps';

interface Props {
  roadmapId: string;
}

export function AddMilestoneInline({ roadmapId }: Props) {
  const addMilestone = useAddMilestone(roadmapId);
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      setActive(false);
      return;
    }
    setTitle('');
    setActive(false);
    await addMilestone.mutateAsync({ title: t });
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="mt-6 w-full rounded-md border border-dashed border-slate-300 px-4 py-4 text-left text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
      >
        <span className="font-display italic">+ add a milestone…</span>
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-md border border-active bg-white px-4 py-4">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setTitle('');
            setActive(false);
          }
        }}
        placeholder="Milestone title — Enter to save"
        className="border-0 px-0 focus-visible:ring-0 font-display text-lg"
      />
    </div>
  );
}
