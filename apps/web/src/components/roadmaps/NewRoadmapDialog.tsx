import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useCreateRoadmap } from '@/hooks/useRoadmaps';
import { formatDeadline } from '@/lib/formatters';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewRoadmapDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const create = useCreateRoadmap();
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
    const fresh = await create.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      deadline,
    });
    onOpenChange(false);
    navigate(`/roadmaps/${fresh._id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">New roadmap</DialogTitle>
          <DialogDescription>Name the pursuit. Milestones and steps come later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Title</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Learn Rust"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) submit();
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
              placeholder="A short summary of this roadmap."
              rows={3}
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || create.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
