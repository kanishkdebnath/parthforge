import { useEffect, useState } from 'react';
import type { Contact } from '@pathforge/shared';
import {
  useAddContact,
  useUpdateContact,
  useDeleteContact,
} from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ContactFormDialogProps {
  jobId: string;
  contact?: Contact;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ContactFormDialog({
  jobId,
  contact,
  open,
  onOpenChange,
}: ContactFormDialogProps) {
  const add = useAddContact(jobId);
  const update = useUpdateContact(jobId, contact?._id ?? '');
  const del = useDeleteContact(jobId, contact?._id ?? '');

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setRole(contact?.role ?? '');
      setEmail(contact?.email ?? '');
    }
  }, [open, contact]);

  const submit = () => {
    if (!name.trim()) return;
    const body = {
      name: name.trim(),
      role: role.trim() || undefined,
      email: email.trim() || undefined,
    };
    if (contact) {
      update.mutate(body, { onSuccess: () => onOpenChange(false) });
    } else {
      add.mutate(body, { onSuccess: () => onOpenChange(false) });
    }
  };

  const pending = contact ? update.isPending : add.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {contact ? 'Edit contact' : 'Add contact'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya Rao"
            />
          </Field>
          <Field label="Role" optional>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Recruiter, Hiring Manager"
            />
          </Field>
          <Field label="Email" optional>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between">
          {contact ? (
            <Button
              variant="ghost"
              onClick={() =>
                del.mutate(undefined, { onSuccess: () => onOpenChange(false) })
              }
              className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!name.trim() || pending}
              className="bg-brand text-white hover:bg-brand-hover"
            >
              {pending ? 'Saving…' : contact ? 'Save' : 'Add'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {optional && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            (optional)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
