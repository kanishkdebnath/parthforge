import { useState } from 'react';
import { Archive, FileText, Pencil, Trash2 } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useArchiveJob } from '@/hooks/useJobs';
import { EditJobDialog } from './EditJobDialog';
import { DeleteJobConfirm } from './DeleteJobConfirm';
import { ExportReportDialog } from './ExportReportDialog';

interface JobActionsProps {
  job: JobApplication;
}

export function JobActions({ job }: JobActionsProps) {
  const archive = useArchiveJob(job._id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="space-y-1 pt-4 border-t border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit details
      </button>
      <button
        type="button"
        onClick={() => setExportOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        Export report
      </button>
      <button
        type="button"
        onClick={() => archive.mutate(!job.archived)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Archive className="h-3.5 w-3.5" />
        {job.archived ? 'Unarchive' : 'Archive'}
      </button>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 rounded-md transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete forever
      </button>

      <EditJobDialog job={job} open={editOpen} onOpenChange={setEditOpen} />
      <ExportReportDialog
        job={job}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
      <DeleteJobConfirm
        job={job}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
