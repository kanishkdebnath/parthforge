import { Pencil, Trash2 } from 'lucide-react';
import type { Contact } from '@pathforge/shared';

interface ContactCardProps {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  return (
    <div className="group flex items-center gap-2.5 py-2">
      <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-semibold">
        {initials(contact.name) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {contact.name}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {[contact.role, contact.email].filter(Boolean).join(' · ') || (
            <span className="italic">no role/email</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit contact"
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity p-1"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete contact"
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity p-1"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
