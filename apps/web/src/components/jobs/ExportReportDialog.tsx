import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { JobApplication } from '@pathforge/shared';
import { useRoadmap } from '@/hooks/useRoadmaps';
import { composeReportPrompt } from '@/lib/job-report-prompt';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ExportReportDialogProps {
  job: JobApplication;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ExportReportDialog({
  job,
  open,
  onOpenChange,
}: ExportReportDialogProps) {
  const { data: roadmap } = useRoadmap(job.links.roadmapId);
  const prompt = composeReportPrompt(job, roadmap?.title);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success('Prompt copied', {
        description: 'Paste into ChatGPT or Claude to generate the write-up.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy', {
        description: 'Select the text and copy it manually.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Export report prompt
              </DialogTitle>
              <DialogDescription>
                Paste this into ChatGPT or Claude to generate a 600–800 word
                interview-experience write-up. Empty sections are skipped
                automatically.
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={copy}
              className="bg-brand text-white hover:bg-brand-hover shrink-0 mt-0.5"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1.5" />
              )}
              {copied ? 'Copied' : 'Copy prompt'}
            </Button>
          </div>
        </DialogHeader>

        <Textarea
          readOnly
          value={prompt}
          rows={18}
          className="font-mono text-[11px] leading-relaxed resize-none"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
