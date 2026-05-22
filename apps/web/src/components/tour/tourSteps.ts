export type TourStepGroup = 'Roadmaps' | 'Jobs' | 'Journal';

export type TourStep = {
  id: string;
  group: TourStepGroup;
  title: string;
  body: string;
  cta?: { label: string; to: string };
  target?: string;        // CSS selector — callout anchors near this element
  nextOnPath?: string;    // auto-complete when location.pathname matches
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'roadmaps-browse',
    group: 'Roadmaps',
    title: 'Browse your roadmaps',
    body: 'Three goals, different states. Click into one.',
    cta: { label: 'Open Roadmaps', to: '/roadmaps' },
    target: '[data-tour="nav-roadmaps"]',
    nextOnPath: '/roadmaps',
  },
  // CTA label names the canonical demo roadmap from seedDemo.ts — keep in sync.
  {
    id: 'roadmaps-open-active',
    group: 'Roadmaps',
    title: 'Open the in-progress one',
    body: 'Watch how milestones stack into steps.',
    cta: { label: 'Open "Land a senior backend role"', to: '/roadmaps' },
    target: '[data-tour="roadmap-card"]',
  },
  {
    id: 'roadmaps-toggle-step',
    group: 'Roadmaps',
    title: 'Toggle a step complete',
    body: 'Click the checkbox on any step. Progress updates everywhere.',
    target: '[data-tour="step-checkbox"]',
  },
  {
    id: 'roadmaps-reorder',
    group: 'Roadmaps',
    title: 'Reorder milestones',
    body: 'Drag the handle on the left of any milestone. The order persists.',
    target: '[data-tour="milestone-drag-handle"]',
  },
  {
    id: 'roadmaps-import',
    group: 'Roadmaps',
    title: 'Import from an LLM',
    body: 'The fastest way to build one — paste a prompt, paste JSON, done.',
    cta: { label: 'Try LLM import', to: '/roadmaps' },
    target: '[data-tour="roadmaps-import-button"]',
  },
  {
    id: 'jobs-browse',
    group: 'Jobs',
    title: 'Track your applications',
    body: 'Five jobs across the funnel. Counts on the Active / Archive toggle.',
    cta: { label: 'Open Jobs', to: '/jobs' },
    target: '[data-tour="nav-jobs"]',
    nextOnPath: '/jobs',
  },
  {
    id: 'jobs-open-interview',
    group: 'Jobs',
    title: 'Open the active interview',
    body: 'The Linear job — notice it is linked to a roadmap.',
    cta: { label: 'Open Linear application', to: '/jobs' },
    target: '[data-tour="job-list-row"]',
  },
  {
    id: 'jobs-add-round',
    group: 'Jobs',
    title: 'Add an interview round',
    body: 'The round dialog handles dates, outcomes, feedback, prep notes.',
    target: '[data-tour="job-add-round"]',
  },
  {
    id: 'jobs-export-report',
    group: 'Jobs',
    title: 'Export an interview report',
    body: 'Generates an LLM prompt for a candid post-interview write-up. From the job actions menu.',
    target: '[data-tour="job-export-report"]',
  },
  {
    id: 'journal-today-card',
    group: 'Journal',
    title: 'Today at a glance',
    body:
      'The dashboard card prompts you when there\'s no entry, or shows mood + summary once you\'ve written today\'s.',
    target: '[data-tour="journal-today-card"]',
  },
  {
    id: 'journal-open',
    group: 'Journal',
    title: 'Open your journal',
    body: 'The full calendar lives at /journal — mood heatmap on the left, day editor on the right.',
    cta: { label: 'Open Journal', to: '/journal' },
    target: '[data-tour="nav-journal"]',
    nextOnPath: '/journal',
  },
  {
    id: 'journal-day-mood',
    group: 'Journal',
    title: 'Set the mood',
    body: 'Pick a 1–5 emoji and optional tags (focused, grateful, tired…).',
    target: '[data-tour="mood-picker"]',
  },
  {
    id: 'journal-add-event',
    group: 'Journal',
    title: 'Capture an important event',
    body: 'Star the ones that mattered. The optional time field timestamps the moment.',
    target: '[data-tour="add-event"]',
  },
  {
    id: 'journal-add-reference',
    group: 'Journal',
    title: 'Link the day to a goal',
    body: 'Attach a reference to a roadmap, milestone, or job. Stays scoped to your own docs.',
    target: '[data-tour="add-reference"]',
  },
];
