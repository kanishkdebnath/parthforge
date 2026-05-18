import { useState } from 'react';
import { Plus } from 'lucide-react';
import { NewMilestoneDialog } from './NewMilestoneDialog';

interface Props {
  roadmapId: string;
}

export function AddMilestoneInline({ roadmapId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl py-4 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add milestone
      </button>
      <NewMilestoneDialog roadmapId={roadmapId} open={open} onOpenChange={setOpen} />
    </>
  );
}
