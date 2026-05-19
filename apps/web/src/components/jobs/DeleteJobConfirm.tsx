import { useNavigate } from 'react-router-dom';
import type { JobApplication } from '@pathforge/shared';
import { useDeleteJob } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteJobConfirmProps {
  job: JobApplication;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DeleteJobConfirm({
  job,
  open,
  onOpenChange,
}: DeleteJobConfirmProps) {
  const navigate = useNavigate();
  const del = useDeleteJob(job._id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this application?</DialogTitle>
          <DialogDescription>
            {job.company} · {job.role} will be permanently deleted, along with
            its interview rounds, contacts, and notes. This cannot be undone.
            If you just want it out of the way, archive it instead.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              del.mutate(undefined, {
                onSuccess: () => {
                  onOpenChange(false);
                  navigate('/jobs');
                },
              })
            }
            disabled={del.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {del.isPending ? 'Deleting…' : 'Delete forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
