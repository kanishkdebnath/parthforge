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
