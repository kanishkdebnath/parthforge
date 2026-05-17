import { useNavigate } from 'react-router-dom';
import type { Roadmap } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteRoadmap } from '@/hooks/useRoadmaps';
import { pluralize } from '@/lib/formatters';

interface Props {
  roadmap: Roadmap;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoadmapConfirm({ roadmap, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const del = useDeleteRoadmap(roadmap._id);
  const milestoneCount = roadmap.milestones.length;
  const stepCount = roadmap.milestones.reduce((acc, m) => acc + m.steps.length, 0);

  const confirm = async () => {
    try {
      await del.mutateAsync();
      navigate(roadmap.archived ? '/roadmaps/archived' : '/roadmaps');
    } catch {
      // Hook's onError already surfaced a toast. Keep dialog open for retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Delete this roadmap?
          </DialogTitle>
          <DialogDescription>
            "{roadmap.title}" will be permanently removed, along with its{' '}
            {milestoneCount} {pluralize(milestoneCount, 'milestone')} and {stepCount}{' '}
            {pluralize(stepCount, 'step')}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={del.isPending}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={del.isPending}
            className="bg-overdue text-white hover:bg-red-700"
          >
            {del.isPending ? 'Deleting…' : 'Delete forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
