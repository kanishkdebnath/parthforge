import { useState, type ReactNode } from 'react';
import type { Link as LinkType } from '@pathforge/shared';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  current: LinkType[];
  onChange: (next: LinkType[]) => void;
  trigger: ReactNode;
}

export function LinkEditPopover({ current, onChange, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  const isValidUrl = (() => {
    try {
      const u = new URL(url.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  const add = () => {
    if (!isValidUrl) return;
    onChange([...current, { url: url.trim(), label: label.trim() || undefined }]);
    setUrl('');
    setLabel('');
  };

  const remove = (idx: number) => {
    onChange(current.filter((_, i) => i !== idx));
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setUrl('');
      setLabel('');
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        {current.length > 0 && (
          <ul className="space-y-1 text-xs">
            {current.map((l, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="flex-1 truncate text-slate-600">{l.label || l.url}</span>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-slate-400 hover:text-overdue text-xs"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            type="url"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValidUrl) add();
            }}
          />
          <Button
            type="button"
            onClick={add}
            disabled={!isValidUrl}
            size="sm"
            className="w-full bg-active text-active-foreground hover:bg-active/90"
          >
            Add link
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
