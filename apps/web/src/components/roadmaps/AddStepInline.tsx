import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useAddStep } from '@/hooks/useRoadmaps';

interface Props {
  roadmapId: string;
  milestoneId: string;
}

export function AddStepInline({ roadmapId, milestoneId }: Props) {
  const addStep = useAddStep(roadmapId, milestoneId);
  const [title, setTitle] = useState('');
  // Guard against double-fire if the input is briefly remounted.
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
  }, [title]);

  const submit = async () => {
    if (settledRef.current) return;
    const t = title.trim();
    if (!t) return;
    settledRef.current = true;
    setTitle(''); // clear immediately so the next Enter goes to a new step
    await addStep.mutateAsync({ title: t });
  };

  return (
    <div className="flex items-center gap-3 py-1.5 pl-7 pr-2 rounded-sm">
      <span className="text-slate-300">+</span>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="add a step — Enter to add"
        className="border-0 px-0 focus-visible:ring-0 bg-transparent text-sm placeholder:italic placeholder:text-slate-400"
      />
    </div>
  );
}
