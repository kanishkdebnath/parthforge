import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Contact, JobApplication } from '@pathforge/shared';
import { ContactCard } from './ContactCard';
import { ContactFormDialog } from './ContactFormDialog';

interface ContactsBlockProps {
  job: JobApplication;
}

export function ContactsBlock({ job }: ContactsBlockProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setDialogOpen(true);
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Contacts
        </h3>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>
      {job.contacts.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          No contacts yet
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {job.contacts.map((c) => (
            <ContactCard
              key={c._id}
              jobId={job._id}
              contact={c}
              onEdit={() => openEdit(c)}
            />
          ))}
        </div>
      )}

      <ContactFormDialog
        jobId={job._id}
        contact={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
