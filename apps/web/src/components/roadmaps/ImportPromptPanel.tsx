import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { buildPrompt, JSON_TEMPLATE } from '@/lib/llm-prompt';
import { copyText } from '@/lib/clipboard';
import { toast } from 'sonner';

export function ImportPromptPanel() {
  const [goal, setGoal] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const promptTimer = useRef<number | null>(null);
  const templateTimer = useRef<number | null>(null);

  const interpolatedPrompt = useMemo(() => buildPrompt(goal.trim()), [goal]);
  const canCopyPrompt = goal.trim().length > 0;

  useEffect(() => {
    return () => {
      if (promptTimer.current) window.clearTimeout(promptTimer.current);
      if (templateTimer.current) window.clearTimeout(templateTimer.current);
    };
  }, []);

  const handleCopyPrompt = async () => {
    if (!canCopyPrompt) return;
    const ok = await copyText(interpolatedPrompt);
    if (!ok) {
      toast.error('Could not copy — select and copy manually.');
      return;
    }
    setCopiedPrompt(true);
    if (promptTimer.current) window.clearTimeout(promptTimer.current);
    promptTimer.current = window.setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyTemplate = async () => {
    const ok = await copyText(JSON_TEMPLATE);
    if (!ok) {
      toast.error('Could not copy — select and copy manually.');
      return;
    }
    setCopiedTemplate(true);
    if (templateTimer.current) window.clearTimeout(templateTimer.current);
    templateTimer.current = window.setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">1. Generate the prompt</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Describe your goal, then copy the prompt and paste it into any LLM.
        </p>
      </div>

      <div>
        <label
          htmlFor="import-goal"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          What's the goal?
        </label>
        <Input
          id="import-goal"
          autoFocus
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder='e.g. Learn Rust in 3 months while building a CLI tool'
        />
      </div>

      <div>
        <label
          htmlFor="import-prompt"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          Prompt to send <span className="text-slate-400 dark:text-slate-500 font-normal">(updates as you type)</span>
        </label>
        <Textarea
          id="import-prompt"
          readOnly
          rows={10}
          value={interpolatedPrompt}
          aria-label="Generated LLM prompt"
          className="font-mono text-xs"
        />
      </div>

      <div className="flex items-center gap-2" role="status" aria-live="polite">
        <Button
          onClick={handleCopyPrompt}
          disabled={!canCopyPrompt}
          className="bg-brand text-white hover:bg-brand-hover"
        >
          {copiedPrompt ? 'Copied!' : 'Copy prompt'}
        </Button>
        <Button variant="ghost" onClick={handleCopyTemplate}>
          {copiedTemplate ? 'Copied!' : 'Copy template only'}
        </Button>
      </div>
    </section>
  );
}
