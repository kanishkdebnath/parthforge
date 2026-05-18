import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Link as LinkType, Step } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUpdateStep } from '@/hooks/useRoadmaps';

interface Props {
  roadmapId: string;
  milestoneId: string;
  step: Step;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStepLinksDialog({
  roadmapId,
  milestoneId,
  step,
  open,
  onOpenChange,
}: Props) {
  const update = useUpdateStep(roadmapId, milestoneId);
  const [links, setLinks] = useState<LinkType[]>(step.links);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (open) {
      setLinks(step.links);
      setUrl('');
      setLabel('');
    }
  }, [open, step.links]);

  const isValidUrl = (() => {
    try {
      const u = new URL(url.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  const addLink = () => {
    if (!isValidUrl) return;
    setLinks([...links, { url: url.trim(), label: label.trim() || undefined }]);
    setUrl('');
    setLabel('');
  };

  const removeLink = (idx: number) => {
    setLinks(links.filter((_, i) => i !== idx));
  };

  const save = async () => {
    await update.mutateAsync({ stepId: step._id, patch: { links } });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">Step links</DialogTitle>
          <DialogDescription>
            Add reference links to this step. Each opens in a new tab.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {links.length > 0 && (
            <ul className="space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-md p-2 bg-slate-50 dark:bg-slate-950">
              {links.map((l, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-900 rounded-md border border-slate-100 dark:border-slate-800"
                >
                  <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 truncate">
                    {l.label ? <strong className="font-medium">{l.label}</strong> : null}
                    {l.label ? <span className="text-slate-400 dark:text-slate-500"> · </span> : null}
                    <span className="text-slate-500 dark:text-slate-400 text-xs">{l.url}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLink(idx)}
                    aria-label="Remove link"
                    className="text-slate-400 dark:text-slate-500 hover:text-overdue transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValidUrl) addLink();
              }}
            />
            <Button
              type="button"
              onClick={addLink}
              disabled={!isValidUrl}
              size="sm"
              className="w-full bg-brand text-white hover:bg-brand-hover"
            >
              Add link
            </Button>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={update.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
