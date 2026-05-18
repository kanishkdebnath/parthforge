import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAddMilestone } from '@/hooks/useRoadmaps';
import { formatDeadline } from '@/lib/formatters';

interface Props {
  roadmapId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewMilestoneDialog({ roadmapId, open, onOpenChange }: Props) {
  const add = useAddMilestone(roadmapId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setDeadline(undefined);
    }
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return;
    await add.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      deadline,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">New milestone</DialogTitle>
          <DialogDescription>A chunk of work toward the roadmap goal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Title</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Foundation"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) void submit();
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to happen at this milestone."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Deadline <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
            </label>
            <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  {deadline ? formatDeadline(deadline) : <span className="text-slate-400 dark:text-slate-500">Pick a date</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={(d: Date | undefined) => {
                    setDeadline(d);
                    setDeadlineOpen(false);
                  }}
                  autoFocus
                />
                {deadline && (
                  <div className="border-t p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeadline(undefined);
                        setDeadlineOpen(false);
                      }}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-overdue px-2 py-1"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!title.trim() || add.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            {add.isPending ? 'Adding…' : 'Add milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
