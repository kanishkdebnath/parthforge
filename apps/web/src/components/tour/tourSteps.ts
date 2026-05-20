export type TourStepGroup = 'Roadmaps' | 'Jobs';

export type TourStep = {
  id: string;
  group: TourStepGroup;
  title: string;
  body: string;
  cta?: { label: string; to: string };
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'roadmaps-browse',
    group: 'Roadmaps',
    title: 'Browse your roadmaps',
    body: 'Three goals, different states. Click into one.',
    cta: { label: 'Open Roadmaps', to: '/roadmaps' },
  },
  {
    id: 'roadmaps-open-active',
    group: 'Roadmaps',
    title: 'Open the in-progress one',
    body: 'Watch how milestones stack into steps.',
    cta: { label: 'Open "Land a senior backend role"', to: '/roadmaps' },
  },
  {
    id: 'roadmaps-toggle-step',
    group: 'Roadmaps',
    title: 'Toggle a step complete',
    body: 'Click the checkbox on any step. Progress updates everywhere.',
  },
  {
    id: 'roadmaps-reorder',
    group: 'Roadmaps',
    title: 'Reorder milestones',
    body: 'Drag the handle on the left of any milestone. The order persists.',
  },
  {
    id: 'roadmaps-import',
    group: 'Roadmaps',
    title: 'Import from an LLM',
    body: 'The fastest way to build one — paste a prompt, paste JSON, done.',
    cta: { label: 'Try LLM import', to: '/roadmaps' },
  },
  {
    id: 'jobs-browse',
    group: 'Jobs',
    title: 'Track your applications',
    body: 'Five jobs across the funnel. Counts on the Active / Archive toggle.',
    cta: { label: 'Open Jobs', to: '/jobs' },
  },
  {
    id: 'jobs-open-interview',
    group: 'Jobs',
    title: 'Open the active interview',
    body: 'The Linear job — notice it is linked to a roadmap.',
    cta: { label: 'Open Linear application', to: '/jobs' },
  },
  {
    id: 'jobs-add-round',
    group: 'Jobs',
    title: 'Add an interview round',
    body: 'The round dialog handles dates, outcomes, feedback, prep notes.',
  },
  {
    id: 'jobs-export-report',
    group: 'Jobs',
    title: 'Export an interview report',
    body: 'Generates an LLM prompt for a candid post-interview write-up. From the job actions menu.',
  },
];
