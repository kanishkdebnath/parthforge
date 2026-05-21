import { Types } from 'mongoose';
import { RoadmapModel } from './models/Roadmap.js';
import { JobApplicationModel } from './models/JobApplication.js';
import { JournalDayModel } from './models/JournalDay.js';
import type { MoodTag } from '@pathforge/shared';

export type RoadmapSeed = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  description?: string;
  deadline?: Date;
  archived: boolean;
  milestones: Array<{
    _id: Types.ObjectId;
    title: string;
    description?: string;
    deadline?: Date;
    steps: Array<{
      _id: Types.ObjectId;
      title: string;
      completed: boolean;
      completedAt?: Date;
      links: Array<{ url: string; label?: string }>;
    }>;
    completedAt?: Date;
  }>;
};

export type JournalDaySeed = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: string;
  mood: { scale: number; tags: MoodTag[] };
  summary?: string;
  events: Array<{
    _id: Types.ObjectId;
    text: string;
    important: boolean;
    time?: string;
  }>;
  links: Array<{ url: string; label?: string }>;
  references: Array<
    | { type: 'roadmap'; roadmapId: Types.ObjectId }
    | { type: 'milestone'; roadmapId: Types.ObjectId; milestoneId: Types.ObjectId }
    | { type: 'job'; jobId: Types.ObjectId }
  >;
};

export type JobSeed = {
  userId: Types.ObjectId;
  company: string;
  role: string;
  jobUrl?: string;
  resumeUrl?: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';
  appliedAt?: Date;
  location?: string;
  workMode?: 'remote' | 'hybrid' | 'onsite';
  salaryRange?: string;
  offerAmount?: string;
  tags: string[];
  notes?: string;
  contacts: Array<{ name: string; role?: string; email?: string }>;
  rounds: Array<{
    name: string;
    scheduledAt?: Date;
    durationMinutes?: number;
    interviewer?: string;
    outcome: 'pending' | 'passed' | 'failed';
    prepNotes?: string;
    questions: string[];
    experience?: string;
  }>;
  links: { roadmapId?: Types.ObjectId };
  archived: boolean;
};

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

/** UTC YYYY-MM-DD for n days before "now". */
function dateAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const oid = () => new Types.ObjectId();

function buildRoadmaps(userId: Types.ObjectId): {
  rust: RoadmapSeed;
  backend: RoadmapSeed;
  pathforge: RoadmapSeed;
} {
  const rust: RoadmapSeed = {
    _id: oid(),
    userId,
    title: 'Learn Rust for systems work',
    description:
      "Become comfortable enough with Rust to write production-quality CLI tools and async services. The goal isn't mastery — it's confidence to ship.",
    archived: false,
    milestones: [
      {
        _id: oid(),
        title: 'Read The Book Ch 1–10',
        steps: [
          { _id: oid(), title: 'Ownership & borrowing', completed: true, completedAt: daysAgo(40), links: [] },
          { _id: oid(), title: 'Structs & enums', completed: true, completedAt: daysAgo(38), links: [] },
          { _id: oid(), title: 'Error handling with Result', completed: true, completedAt: daysAgo(35), links: [] },
          { _id: oid(), title: 'Traits & generics', completed: true, completedAt: daysAgo(30), links: [] },
        ],
        completedAt: daysAgo(30),
      },
      {
        _id: oid(),
        title: 'Build a CLI tool',
        steps: [
          { _id: oid(), title: 'Set up the project with clap', completed: true, completedAt: daysAgo(20), links: [] },
          { _id: oid(), title: 'Add subcommands', completed: true, completedAt: daysAgo(15), links: [] },
          { _id: oid(), title: 'Read config from disk', completed: false, links: [] },
          { _id: oid(), title: 'Publish to crates.io', completed: false, links: [] },
        ],
      },
      {
        _id: oid(),
        title: 'Async with tokio',
        steps: [
          { _id: oid(), title: 'Read tokio tutorial', completed: false, links: [{ url: 'https://tokio.rs/tokio/tutorial', label: 'Tokio tutorial' }] },
          { _id: oid(), title: 'Build a small chat server', completed: false, links: [] },
          { _id: oid(), title: 'Add structured logging with tracing', completed: false, links: [] },
        ],
      },
      {
        _id: oid(),
        title: 'Contribute to a Rust OSS project',
        steps: [
          { _id: oid(), title: 'Pick a project from "good first issue"', completed: false, links: [] },
          { _id: oid(), title: 'Submit first PR', completed: false, links: [] },
          { _id: oid(), title: 'Get PR merged', completed: false, links: [] },
        ],
      },
    ],
  };

  const backend: RoadmapSeed = {
    _id: oid(),
    userId,
    title: 'Land a senior backend role',
    description:
      'Targeted prep cycle: refresh fundamentals, drill system design, run live interviews. Aiming for offer in ~6 weeks.',
    archived: false,
    milestones: [
      {
        _id: oid(),
        title: 'Refresh fundamentals',
        steps: [
          { _id: oid(), title: 'Data structures review', completed: true, completedAt: daysAgo(45), links: [] },
          { _id: oid(), title: 'Algorithms cheat sheet', completed: true, completedAt: daysAgo(42), links: [] },
          { _id: oid(), title: '50 LeetCode mediums', completed: true, completedAt: daysAgo(28), links: [] },
        ],
        completedAt: daysAgo(28),
      },
      {
        _id: oid(),
        title: 'System design prep',
        steps: [
          { _id: oid(), title: 'Designing Data-Intensive Apps notes', completed: true, completedAt: daysAgo(22), links: [{ url: 'https://dataintensive.net', label: 'DDIA' }] },
          { _id: oid(), title: 'Mock with two peers', completed: true, completedAt: daysAgo(18), links: [] },
          { _id: oid(), title: 'Write 5 case studies', completed: true, completedAt: daysAgo(12), links: [] },
        ],
        completedAt: daysAgo(12),
      },
      {
        _id: oid(),
        title: 'Live interviews',
        steps: [
          { _id: oid(), title: 'Phone screens (target 4)', completed: true, completedAt: daysAgo(8), links: [] },
          { _id: oid(), title: 'Technical screens (target 3)', completed: true, completedAt: daysAgo(5), links: [] },
          { _id: oid(), title: 'Onsite loops (target 2)', completed: true, completedAt: daysAgo(2), links: [] },
          { _id: oid(), title: 'Negotiation prep', completed: false, links: [] },
          { _id: oid(), title: 'Accept and counter-sign', completed: false, links: [] },
        ],
      },
    ],
  };

  const pathforge: RoadmapSeed = {
    _id: oid(),
    userId,
    title: 'Ship Pathforge v0',
    description: 'Walking-skeleton release — auth, dashboard, profile, logout. Shipped 2026-05-17.',
    archived: true,
    milestones: [
      {
        _id: oid(),
        title: 'Repo scaffold',
        steps: [
          { _id: oid(), title: 'npm workspaces', completed: true, completedAt: daysAgo(60), links: [] },
          { _id: oid(), title: 'TS base config', completed: true, completedAt: daysAgo(60), links: [] },
        ],
        completedAt: daysAgo(60),
      },
      {
        _id: oid(),
        title: 'API skeleton',
        steps: [
          { _id: oid(), title: 'Fastify boot', completed: true, completedAt: daysAgo(55), links: [] },
          { _id: oid(), title: '/api/health', completed: true, completedAt: daysAgo(55), links: [] },
        ],
        completedAt: daysAgo(55),
      },
      {
        _id: oid(),
        title: 'Stub auth',
        steps: [
          { _id: oid(), title: 'Cookie session', completed: true, completedAt: daysAgo(50), links: [] },
          { _id: oid(), title: 'Dev users seed', completed: true, completedAt: daysAgo(50), links: [] },
          { _id: oid(), title: 'Login / logout / me', completed: true, completedAt: daysAgo(48), links: [] },
        ],
        completedAt: daysAgo(48),
      },
      {
        _id: oid(),
        title: 'Web skeleton',
        steps: [
          { _id: oid(), title: 'Vite + Tailwind + shadcn', completed: true, completedAt: daysAgo(46), links: [] },
          { _id: oid(), title: 'Login page', completed: true, completedAt: daysAgo(45), links: [] },
          { _id: oid(), title: 'Dashboard + Profile', completed: true, completedAt: daysAgo(44), links: [] },
        ],
        completedAt: daysAgo(44),
      },
      {
        _id: oid(),
        title: 'Docker compose',
        steps: [
          { _id: oid(), title: 'mongo + api + web', completed: true, completedAt: daysAgo(42), links: [] },
          { _id: oid(), title: 'One-command bring-up', completed: true, completedAt: daysAgo(42), links: [] },
        ],
        completedAt: daysAgo(42),
      },
    ],
  };

  return { rust, backend, pathforge };
}

function buildJobs(
  userId: Types.ObjectId,
  backendRoadmapId: Types.ObjectId
): JobSeed[] {
  return [
    {
      userId,
      company: 'Vercel',
      role: 'Senior Platform Engineer',
      jobUrl: 'https://vercel.com/careers',
      status: 'saved',
      tags: ['remote', 'dx'],
      notes: 'Interesting DX role; revisit after Rust milestones land.',
      contacts: [],
      rounds: [],
      links: {},
      archived: false,
    },
    {
      userId,
      company: 'Stripe',
      role: 'Staff Backend Engineer',
      jobUrl: 'https://stripe.com/jobs',
      status: 'applied',
      appliedAt: daysAgo(10),
      workMode: 'hybrid',
      location: 'New York, NY',
      tags: ['payments', 'go'],
      notes: 'Applied via referral. Waiting on recruiter screen.',
      contacts: [
        { name: 'Priya Shah', role: 'Recruiter', email: 'priya@stripe.com' },
      ],
      rounds: [],
      links: {},
      archived: false,
    },
    {
      userId,
      company: 'Linear',
      role: 'Senior Software Engineer',
      jobUrl: 'https://linear.app/careers',
      status: 'interviewing',
      appliedAt: daysAgo(21),
      workMode: 'remote',
      salaryRange: '$200k–$240k + equity',
      tags: ['remote', 'typescript'],
      notes:
        'Strongest fit so far. Linked to the backend-role roadmap — system design pillar applies directly.',
      contacts: [
        { name: 'Sara Ahmed', role: 'Recruiter', email: 'sara@linear.app' },
        { name: 'Marcus Lin', role: 'Hiring Manager', email: 'marcus@linear.app' },
      ],
      rounds: [
        {
          name: 'Recruiter screen',
          scheduledAt: daysAgo(18),
          durationMinutes: 30,
          interviewer: 'Sara Ahmed',
          outcome: 'passed',
          questions: ['Why Linear?', 'Comp expectations'],
          experience: 'Friendly call. Confirmed remote and salary band aligns.',
        },
        {
          name: 'System design',
          scheduledAt: daysAgo(7),
          durationMinutes: 60,
          interviewer: 'Marcus Lin',
          outcome: 'passed',
          questions: ['Design a real-time issue tracker sync layer'],
          experience:
            "Talked through CRDT vs operational transform. Marcus pushed on consistency edge cases — felt I held my own. Got the 'looking forward to the next round' line.",
          prepNotes: 'Reviewed DDIA Ch 5 and 9 the night before.',
        },
        {
          name: 'Final loop',
          scheduledAt: daysFromNow(4),
          durationMinutes: 180,
          outcome: 'pending',
          questions: [],
          prepNotes: 'Two coding rounds + values interview. Refresh tree traversals.',
        },
      ],
      links: { roadmapId: backendRoadmapId },
      archived: false,
    },
    {
      userId,
      company: 'Anthropic',
      role: 'Backend Engineer',
      jobUrl: 'https://anthropic.com/careers',
      status: 'offer',
      appliedAt: daysAgo(30),
      workMode: 'onsite',
      location: 'San Francisco, CA',
      salaryRange: '$220k–$260k + equity',
      offerAmount: '$245k base + 0.04% equity',
      tags: ['ai', 'python'],
      notes:
        'Offer in hand. Decision window closes Friday. Mission alignment is the strongest pull.',
      contacts: [
        { name: 'Jasper Wu', role: 'Recruiter', email: 'jasper@anthropic.com' },
        { name: 'Elena Garcia', role: 'Hiring Manager' },
      ],
      rounds: [
        { name: 'Recruiter screen', scheduledAt: daysAgo(28), outcome: 'passed', questions: [] },
        { name: 'Technical screen', scheduledAt: daysAgo(22), outcome: 'passed', questions: ['Distributed batch processing question'], experience: 'Tight on time but got to a working solution.' },
        { name: 'Onsite — coding', scheduledAt: daysAgo(12), outcome: 'passed', questions: [] },
        { name: 'Onsite — system design', scheduledAt: daysAgo(12), outcome: 'passed', questions: ['Design a model-serving gateway'], experience: 'Best interview I have ever done.' },
      ],
      links: {},
      archived: false,
    },
    {
      userId,
      company: 'Figma',
      role: 'Staff Engineer',
      jobUrl: 'https://figma.com/careers',
      status: 'rejected',
      appliedAt: daysAgo(45),
      workMode: 'hybrid',
      tags: ['canvas', 'webgl'],
      notes:
        "Rejected after onsite. Feedback (paraphrased from recruiter call): 'great fundamentals, lighter on graphics-specific experience than the bar for this role.' Useful signal — Staff at Figma means deep canvas/rendering background, not generalist senior.",
      contacts: [
        { name: 'Olivia Reed', role: 'Recruiter', email: 'olivia@figma.com' },
      ],
      rounds: [
        { name: 'Technical screen', scheduledAt: daysAgo(38), outcome: 'passed', questions: [] },
        { name: 'Onsite', scheduledAt: daysAgo(25), outcome: 'failed', questions: ['Implement a canvas hit-test'], experience: 'Stalled on the hit-test optimization. Knew enough to brute-force, not enough to spatially partition under pressure.' },
      ],
      links: {},
      archived: false,
    },
  ];
}

function buildJournalDays(
  userId: Types.ObjectId,
  rust: RoadmapSeed,
  backend: RoadmapSeed,
  linearJob: { _id: Types.ObjectId }
): JournalDaySeed[] {
  const day = (
    n: number,
    init: Omit<JournalDaySeed, '_id' | 'userId' | 'date'>
  ): JournalDaySeed => ({
    _id: oid(),
    userId,
    date: dateAgo(n),
    ...init,
  });

  // Day -2 is intentionally absent (shows the empty calendar state).
  return [
    day(0, {
      mood: { scale: 4, tags: ['focused', 'grateful'] },
      summary: 'Pushed the tour fix.',
      events: [
        { _id: oid(), text: 'Shipped cascade-completion fix', important: true, time: '10am' },
        { _id: oid(), text: 'Wired markComplete handlers across pages', important: false },
        { _id: oid(), text: 'Closed out the demo-user-tour branch', important: false, time: '3pm' },
      ],
      links: [{ url: 'https://github.com/example/pathforge/pull/42', label: 'PR #42' }],
      references: [{ type: 'roadmap', roadmapId: rust._id }],
    }),
    day(1, {
      mood: { scale: 3, tags: ['restless'] },
      summary: 'Stuck on routing for too long.',
      events: [
        { _id: oid(), text: 'Half hour debugging route guards', important: false },
        { _id: oid(), text: 'Walked away to reset', important: false, time: '4pm' },
      ],
      links: [],
      references: [],
    }),
    // Day -2 intentionally skipped
    day(3, {
      mood: { scale: 4, tags: ['focused'] },
      summary: 'Two clean milestones.',
      events: [
        { _id: oid(), text: 'Finished system design notes', important: false },
        { _id: oid(), text: 'Mock interview with peer', important: false, time: '6pm' },
      ],
      links: [{ url: 'https://dataintensive.net', label: 'DDIA' }],
      references: [
        {
          type: 'milestone',
          roadmapId: backend._id,
          milestoneId: backend.milestones[0]!._id,
        },
      ],
    }),
    day(4, {
      mood: { scale: 2, tags: ['tired', 'low'] },
      summary: 'Rough day; called it early.',
      events: [{ _id: oid(), text: 'Headache through lunch', important: false }],
      links: [],
      references: [{ type: 'job', jobId: linearJob._id }],
    }),
    day(5, {
      mood: { scale: 5, tags: ['excited', 'grateful'] },
      summary: 'Best interview I have done.',
      events: [
        { _id: oid(), text: 'Onsite system design — landed it', important: true, time: '11am' },
        { _id: oid(), text: 'Coding round — clean solution', important: true },
        { _id: oid(), text: 'Recruiter said "looking forward to the next"', important: false },
        { _id: oid(), text: 'Celebrated with tea', important: false, time: '5pm' },
      ],
      links: [
        { url: 'https://example.com/system-design-notes', label: 'Prep notes' },
        { url: 'https://github.com/example/scratch', label: 'Scratch repo' },
      ],
      references: [{ type: 'roadmap', roadmapId: backend._id }],
    }),
    day(6, {
      mood: { scale: 3, tags: ['calm'] },
      summary: 'Quiet recovery day.',
      events: [{ _id: oid(), text: 'Read for an hour', important: false }],
      links: [],
      references: [],
    }),
    day(7, {
      mood: { scale: 4, tags: ['focused'] },
      summary: 'Steady progress on Rust CLI.',
      events: [
        { _id: oid(), text: 'Added subcommand parser', important: false, time: '11am' },
        { _id: oid(), text: 'Wrote tests for arg parsing', important: false },
      ],
      links: [{ url: 'https://docs.rs/clap', label: 'clap docs' }],
      references: [
        {
          type: 'milestone',
          roadmapId: rust._id,
          milestoneId: rust.milestones[1]!._id,
        },
      ],
    }),
    day(8, {
      mood: { scale: 3, tags: [] },
      summary: 'Recharged.',
      events: [],
      links: [],
      references: [],
    }),
    day(9, {
      mood: { scale: 4, tags: ['grateful'] },
      summary: 'Coffee with an old colleague.',
      events: [],
      links: [],
      references: [],
    }),
    day(10, {
      mood: { scale: 3, tags: [] },
      summary: 'Quiet day.',
      events: [],
      links: [],
      references: [],
    }),
    day(11, {
      mood: { scale: 4, tags: ['calm'] },
      summary: 'Reviewed last quarter notes.',
      events: [],
      links: [],
      references: [],
    }),
  ];
}

export function getDemoFixtures(userId: Types.ObjectId): {
  roadmaps: RoadmapSeed[];
  jobs: (JobSeed & { _id?: Types.ObjectId })[];
  journalDays: JournalDaySeed[];
} {
  const { rust, backend, pathforge } = buildRoadmaps(userId);
  const jobs = buildJobs(userId, backend._id);

  // Stamp _id on the Linear job so the journal "Day -4" ref can point at it.
  const linearJob = jobs.find((j) => j.company === 'Linear');
  if (!linearJob) {
    throw new Error('Demo fixture invariant: Linear job missing');
  }
  const linearId = oid();
  (linearJob as JobSeed & { _id: Types.ObjectId })._id = linearId;

  const journalDays = buildJournalDays(userId, rust, backend, { _id: linearId });

  return { roadmaps: [rust, backend, pathforge], jobs, journalDays };
}

export async function resetDemoData(userId: Types.ObjectId): Promise<void> {
  await RoadmapModel.deleteMany({ userId });
  await JobApplicationModel.deleteMany({ userId });
  await JournalDayModel.deleteMany({ userId });
  const { roadmaps, jobs, journalDays } = getDemoFixtures(userId);
  await RoadmapModel.insertMany(roadmaps);
  await JobApplicationModel.insertMany(jobs);
  await JournalDayModel.insertMany(journalDays);
}
