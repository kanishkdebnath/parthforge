import type { JobApplication, RoundOutcome, WorkMode } from '@pathforge/shared';
import {
  resumeLabel,
  roundProgress,
  statusLabel,
} from './jobs-formatting';

const WORK_MODE_LABEL: Record<WorkMode, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
};

const OUTCOME_LABEL: Record<RoundOutcome, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
};

const INSTRUCTIONS = `You are a candid first-person writer of an interview-experience post.

Goal: turn the application brief below into a 600–800 word write-up that helps other applicants. The reader should walk away with concrete prep ideas and a clear sense of what the company is actually like to interview with.

Tone:
- Honest and specific, not corporate
- First person ("I prepared by…")
- Show, don't tell — quote a question they actually asked rather than saying "they asked hard questions"

Structure (aim for these sections; skip any that have no data):
1. Title: company + role + outcome (e.g. "Linear, Senior Software Engineer — onsite, ended with an offer")
2. Context — one paragraph: how I came across the role, what made me apply, the comp/mode/location at a glance
3. Prep approach — 1–2 paragraphs: group similar prep across rounds rather than repeating
4. Round-by-round — one paragraph per round: what happened, what they asked (quote 1–2 of the actual questions verbatim), how it felt
5. What surprised me / what I learned — one paragraph
6. Advice for the next person — one short paragraph

Hard rules:
- Use ONLY the facts in the brief below. Do not invent dates, names, comp, or content. If something is missing, omit that detail rather than guessing.
- If a section in the brief is empty or absent, gracefully skip the corresponding part of the write-up.
- Do NOT include contact emails or full personal names in the post; refer to people by their role ("the recruiter", "the hiring manager", "the engineer who walked me through the system-design problem"). If a contact appears in the brief without a stated role, refer to them generically.
- Plain Markdown only (\`##\` for section headings). No frontmatter, no HTML, no images. Output should be ready to paste into a LinkedIn long-form post or a personal blog.
`;

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Compose the export-report LLM prompt for a job application.
 * Pure function — pass the application and (optionally) the linked roadmap
 * title for inclusion in the brief.
 */
export function composeReportPrompt(
  job: JobApplication,
  linkedRoadmapTitle?: string
): string {
  const sections: string[] = [INSTRUCTIONS, '---', '# Application brief', ''];

  // Company & role
  const meta: string[] = [];
  meta.push(`- Company: ${job.company}`);
  meta.push(`- Role: ${job.role}`);

  const rp = roundProgress(job);
  if (rp && job.status === 'interviewing') {
    meta.push(
      `- Status: ${statusLabel(job.status)} (Round ${rp.n} of ${rp.m})`
    );
  } else {
    meta.push(`- Status: ${statusLabel(job.status)}`);
  }

  if (job.appliedAt) meta.push(`- Applied on: ${formatDate(job.appliedAt)}`);
  if (job.workMode) meta.push(`- Work mode: ${WORK_MODE_LABEL[job.workMode]}`);
  if (job.location) meta.push(`- Location: ${job.location}`);
  if (job.salaryRange) meta.push(`- Salary range: ${job.salaryRange}`);
  if (job.offerAmount && job.status === 'offer') {
    meta.push(`- Offer: ${job.offerAmount}`);
  }
  if (job.tags.length > 0) meta.push(`- Tags: ${job.tags.join(', ')}`);
  if (job.resumeUrl) {
    const label = resumeLabel(job.resumeUrl);
    if (label) meta.push(`- Resume sent: ${label}`);
  }
  if (linkedRoadmapTitle) {
    meta.push(`- Linked roadmap: ${linkedRoadmapTitle}`);
  }

  sections.push('## Company & role');
  sections.push(meta.join('\n'));

  // Notes
  if (job.notes && job.notes.trim()) {
    sections.push('');
    sections.push('## Application notes');
    sections.push(job.notes.trim());
  }

  // Contacts
  if (job.contacts.length > 0) {
    sections.push('');
    sections.push('## Contacts');
    sections.push(
      job.contacts
        .map((c) => {
          const parts = [c.name];
          if (c.role) parts.push(c.role);
          // Emails included in brief; the LLM is instructed not to leak them
          // into the post. Future hardening: strip emails entirely here.
          if (c.email) parts.push(c.email);
          return `- ${parts.join(' — ')}`;
        })
        .join('\n')
    );
  }

  // Rounds
  if (job.rounds.length > 0) {
    sections.push('');
    sections.push('## Interview rounds');
    job.rounds.forEach((r, i) => {
      sections.push('');
      sections.push(
        `### Round ${i + 1}: ${r.name} — ${OUTCOME_LABEL[r.outcome]}`
      );
      const roundMeta: string[] = [];
      if (r.scheduledAt) roundMeta.push(`- Date: ${formatDate(r.scheduledAt)}`);
      if (r.durationMinutes) roundMeta.push(`- Duration: ${r.durationMinutes} min`);
      if (r.interviewer) roundMeta.push(`- Interviewer: ${r.interviewer}`);
      if (roundMeta.length > 0) {
        sections.push(roundMeta.join('\n'));
      }

      if (r.prepNotes && r.prepNotes.trim()) {
        sections.push('');
        sections.push('Pre-prep:');
        sections.push(r.prepNotes.trim());
      }

      if (r.questions.length > 0) {
        sections.push('');
        sections.push('Questions asked:');
        sections.push(r.questions.map((q) => `- ${q}`).join('\n'));
      }

      if (r.experience && r.experience.trim()) {
        sections.push('');
        sections.push('Experience / reflection:');
        sections.push(r.experience.trim());
      }
    });
  }

  return sections.join('\n');
}
