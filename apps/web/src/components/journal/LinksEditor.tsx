import type { Link } from '@pathforge/shared';

interface LinksEditorProps {
  links: Link[];
  onChange: (next: Link[]) => void;
}

export function LinksEditor({ links, onChange }: LinksEditorProps) {
  const update = (i: number, next: Link) => {
    onChange(links.map((l, idx) => (idx === i ? next : l)));
  };
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const add = () => {
    if (links.length >= 10) return;
    onChange([...links, { url: '' }]);
  };

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        Links
      </div>
      {links.map((l, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center py-1.5 border-b border-slate-100 dark:border-slate-800"
        >
          <input
            type="url"
            value={l.url}
            onChange={(e) => update(i, { ...l, url: e.target.value })}
            placeholder="https://…"
            className="bg-transparent text-xs text-sky-600 dark:text-sky-400 border-0 outline-none focus:ring-0"
          />
          <input
            type="text"
            value={l.label ?? ''}
            onChange={(e) => update(i, { ...l, label: e.target.value || undefined })}
            placeholder="label (optional)"
            className="bg-transparent text-xs text-slate-600 dark:text-slate-400 border-0 outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-slate-300 hover:text-red-500 text-sm"
            aria-label="Delete link"
          >
            ✕
          </button>
        </div>
      ))}
      {links.length < 10 && (
        <button
          type="button"
          onClick={add}
          className="mt-2 px-3 py-1.5 text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          + add link
        </button>
      )}
    </div>
  );
}
