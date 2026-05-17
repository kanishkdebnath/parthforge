import { useEffect, useState } from 'react';
import type { Milestone } from '@pathforge/shared';
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
import { useUpdateMilestone } from '@/hooks/useRoadmaps';
import { formatDeadline } from '@/lib/formatters';

interface Props {
  roadmapId: string;
  milestone: Milestone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMilestoneDialog({ roadmapId, milestone, open, onOpenChange }: Props) {
  const update = useUpdateMilestone(roadmapId, milestone._id);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? '');
  const [deadline, setDeadline] = useState<Date | undefined>(
    milestone.deadline ? new Date(milestone.deadline) : undefined
  );
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(milestone.title);
      setDescription(milestone.description ?? '');
      setDeadline(milestone.deadline ? new Date(milestone.deadline) : undefined);
    }
  }, [open, milestone]);

  const submit = async () => {
    if (!title.trim()) return;
    await update.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      deadline: deadline ?? null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">Edit milestone</DialogTitle>
          <DialogDescription>Update the title, description, or deadline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Title</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) void submit();
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Deadline <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm bg-white border border-slate-200 rounded-md hover:border-slate-300 transition-colors"
                >
                  {deadline ? formatDeadline(deadline) : <span className="text-slate-400">Pick a date</span>}
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
                      className="text-xs text-slate-600 hover:text-overdue px-2 py-1"
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!title.trim() || update.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
