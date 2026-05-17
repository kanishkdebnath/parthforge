import { useState } from 'react';
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
import { useCreateRoadmap } from '@/hooks/useRoadmaps';
import { InlineEditableDate } from '@/components/InlineEditable';

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

  const submit = async () => {
    if (!title.trim()) return;
    const fresh = await create.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      deadline,
    });
    onOpenChange(false);
    setTitle('');
    setDescription('');
    setDeadline(undefined);
    navigate(`/roadmaps/${fresh._id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
            New roadmap
          </DialogTitle>
          <DialogDescription>Name a pursuit. Milestones come later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs smcp text-slate-500">Title</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Learn Rust"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) submit();
              }}
            />
          </div>
          <div>
            <label className="text-xs smcp text-slate-500">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short summary of what this pursuit looks like."
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs smcp text-slate-500 block">Deadline (optional)</label>
            <InlineEditableDate
              value={deadline}
              onSave={(d) => setDeadline(d ?? undefined)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || create.isPending} className="bg-active text-active-foreground hover:bg-active/90">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
