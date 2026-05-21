import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { getDemoFixtures } from '../src/seedDemo.js';

const userId = new Types.ObjectId();

describe('getDemoFixtures', () => {
  const { roadmaps, jobs } = getDemoFixtures(userId);

  it('returns 3 roadmaps and 5 jobs', () => {
    expect(roadmaps).toHaveLength(3);
    expect(jobs).toHaveLength(5);
  });

  it('stamps userId on every roadmap and job', () => {
    for (const r of roadmaps) expect(String(r.userId)).toBe(String(userId));
    for (const j of jobs) expect(String(j.userId)).toBe(String(userId));
  });

  it('includes the showcase roadmap titles', () => {
    const titles = roadmaps.map((r) => r.title).sort();
    expect(titles).toEqual(
      [
        'Land a senior backend role',
        'Learn Rust for systems work',
        'Ship Pathforge v0',
      ].sort()
    );
  });

  it('marks "Ship Pathforge v0" as archived and the other two as active', () => {
    const byTitle = Object.fromEntries(roadmaps.map((r) => [r.title, r]));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(byTitle['Ship Pathforge v0']!.archived).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(byTitle['Learn Rust for systems work']!.archived).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(byTitle['Land a senior backend role']!.archived).toBe(false);
  });

  it('includes the showcase company / status pairs', () => {
    const pairs = jobs.map((j) => `${j.company}:${j.status}`).sort();
    expect(pairs).toEqual(
      [
        'Anthropic:offer',
        'Figma:rejected',
        'Linear:interviewing',
        'Stripe:applied',
        'Vercel:saved',
      ].sort()
    );
  });

  it('links the Linear interview job to the backend-role roadmap', () => {
    const backendRoadmap = roadmaps.find(
      (r) => r.title === 'Land a senior backend role'
    )!;
    const linear = jobs.find((j) => j.company === 'Linear')!;
    expect(String(linear.links.roadmapId)).toBe(String(backendRoadmap._id));
  });

  it('uses only valid round outcomes', () => {
    const allowed = new Set(['pending', 'passed', 'failed']);
    for (const j of jobs) {
      for (const r of j.rounds ?? []) {
        expect(allowed.has(r.outcome)).toBe(true);
      }
    }
  });
});

describe('getDemoFixtures — journal', () => {
  const { roadmaps, jobs, journalDays } = getDemoFixtures(userId);

  it('returns 10 to 12 journal days (one intentionally skipped)', () => {
    expect(journalDays.length).toBeGreaterThanOrEqual(10);
    expect(journalDays.length).toBeLessThanOrEqual(12);
  });

  it('stamps userId on every journal day', () => {
    for (const d of journalDays) expect(String(d.userId)).toBe(String(userId));
  });

  it('uses YYYY-MM-DD date strings, all unique', () => {
    const dates = journalDays.map((d) => d.date);
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('every mood scale is in 1..5', () => {
    for (const d of journalDays) {
      expect(d.mood.scale).toBeGreaterThanOrEqual(1);
      expect(d.mood.scale).toBeLessThanOrEqual(5);
    }
  });

  it('exercises mood variance (at least one low and one high)', () => {
    const scales = journalDays.map((d) => d.mood.scale);
    expect(Math.min(...scales)).toBeLessThanOrEqual(2);
    expect(Math.max(...scales)).toBeGreaterThanOrEqual(5);
  });

  it('includes at least one important event', () => {
    const anyImportant = journalDays.some((d) =>
      d.events.some((e) => e.important)
    );
    expect(anyImportant).toBe(true);
  });

  it('references only roadmaps and jobs owned by this demo user', () => {
    const ownRoadmapIds = new Set(roadmaps.map((r) => String(r._id)));
    const ownJobIds = new Set(jobs.map((j) => String((j as { _id?: unknown })._id ?? '')).filter(Boolean));
    for (const d of journalDays) {
      for (const ref of d.references) {
        if (ref.type === 'roadmap') {
          expect(ownRoadmapIds.has(String(ref.roadmapId))).toBe(true);
        } else if (ref.type === 'milestone') {
          expect(ownRoadmapIds.has(String(ref.roadmapId))).toBe(true);
        } else if (ref.type === 'job') {
          // Jobs only have _id pre-stamped when the seed needs to reference them.
          if (ownJobIds.size > 0) {
            expect(ownJobIds.has(String(ref.jobId))).toBe(true);
          }
        }
      }
    }
  });
});
