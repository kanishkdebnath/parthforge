import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAddStep } from '@/hooks/useRoadmaps';

interface Props {
  roadmapId: string;
  milestoneId: string;
}

export function AddStepInline({ roadmapId, milestoneId }: Props) {
  const addStep = useAddStep(roadmapId, milestoneId);
  const [title, setTitle] = useState('');
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
  }, [title]);

  const submit = async () => {
    if (settledRef.current) return;
    const t = title.trim();
    if (!t) return;
    settledRef.current = true;
    setTitle('');
    await addStep.mutateAsync({ title: t });
  };

  return (
    <div className="ml-9 flex items-center gap-2.5 py-1.5 pl-1 pr-2">
      <Plus className="h-3.5 w-3.5 text-slate-300 shrink-0" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Add a step"
        disabled={addStep.isPending}
        className="border-0 px-0 py-1 h-auto focus-visible:ring-0 bg-transparent text-sm placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}
