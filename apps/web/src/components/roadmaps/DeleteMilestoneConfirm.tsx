import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { pluralize } from '@/lib/formatters';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  stepCount: number;
  onConfirm: () => void;
  pending?: boolean;
}

export function DeleteMilestoneConfirm({
  open,
  onOpenChange,
  title,
  stepCount,
  onConfirm,
  pending = false,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Delete this milestone?
          </DialogTitle>
          <DialogDescription>
            "{title}" will be permanently removed
            {stepCount > 0 && (
              <>
                {' '}
                along with its {stepCount} {pluralize(stepCount, 'step')}
              </>
            )}
            .
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="bg-overdue text-white hover:bg-red-700"
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
