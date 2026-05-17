import type { Link as LinkType } from '@pathforge/shared';

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
    <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {links.map((l, idx) => (
        <li key={idx} className="text-xs text-slate-500">
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-chip hover:text-active transition-colors"
          >
            {l.label || hostnameOf(l.url)}
          </a>
        </li>
      ))}
    </ul>
  );
}
