import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import type { BulkRoadmapRequest } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImportPromptPanel } from './ImportPromptPanel';
import { ImportPastePanel } from './ImportPastePanel';
import { useBulkCreateRoadmap } from '@/hooks/useRoadmaps';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ServerError = { path: string; message: string };

export function ImportRoadmapDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const bulkCreate = useBulkCreateRoadmap();
  const [serverErrors, setServerErrors] = useState<ServerError[] | null>(null);

  useEffect(() => {
    if (!open) setServerErrors(null);
  }, [open]);

  const handleSubmit = async (data: BulkRoadmapRequest) => {
    setServerErrors(null);
    try {
      const fresh = await bulkCreate.mutateAsync(data);
      onOpenChange(false);
      navigate(`/roadmaps/${fresh._id}`);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400 && err.response.data?.errors) {
        setServerErrors(err.response.data.errors as ServerError[]);
        return;
      }
      toast.error("Couldn't create roadmap. Try again.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Import from LLM
          </DialogTitle>
          <DialogDescription>
            Generate a prompt, paste the response, and we'll build the roadmap.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 mt-4" key={open ? 'open' : 'closed'}>
          <ImportPromptPanel />
          <div className="border-t border-slate-200" />
          <ImportPastePanel
            pending={bulkCreate.isPending}
            serverErrors={serverErrors}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
