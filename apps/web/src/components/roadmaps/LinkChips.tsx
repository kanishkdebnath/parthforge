import type { Link as LinkType } from '@pathforge/shared';
import { ExternalLink } from 'lucide-react';

interface Props {
  links: LinkType[];
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LinkChips({ links }: Props) {
  if (links.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
      {links.map((l, idx) => (
        <li key={idx}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-hover hover:underline underline-offset-4 transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {l.label || hostnameOf(l.url)}
          </a>
        </li>
      ))}
    </ul>
  );
}
