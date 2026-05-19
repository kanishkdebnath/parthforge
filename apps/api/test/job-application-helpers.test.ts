import { describe, it, expect } from 'vitest';
import { serializeJobApplication } from '../src/lib/job-application-helpers.js';

describe('serializeJobApplication', () => {
  it('stringifies ObjectIds at every level and omits undefined optionals', () => {
    const fakeDoc = {
      _id: { toString: () => 'a1' },
      userId: { toString: () => 'u1' },
      company: 'Linear',
      role: 'SWE',
      status: 'interviewing',
      tags: ['react', 'remote'],
      contacts: [
        {
          _id: { toString: () => 'c1' },
          name: 'Maya',
          role: 'Recruiter',
          email: 'maya@linear.app',
        },
      ],
      rounds: [
        {
          _id: { toString: () => 'r1' },
          name: 'Phone Screen',
          outcome: 'passed',
          questions: ['Why us?'],
        },
      ],
      links: { roadmapId: { toString: () => 'rm1' } },
      archived: false,
      createdAt: new Date('2026-05-19T00:00:00Z'),
      updatedAt: new Date('2026-05-19T00:00:00Z'),
    } as never;

    const out = serializeJobApplication(fakeDoc);

    expect(out._id).toBe('a1');
    expect(out.userId).toBe('u1');
    expect(out.contacts[0]?._id).toBe('c1');
    expect(out.rounds[0]?._id).toBe('r1');
    expect(out.links.roadmapId).toBe('rm1');
    expect(out.jobUrl).toBeUndefined();
    expect(out.appliedAt).toBeUndefined();
    expect(out.tags).toEqual(['react', 'remote']);
    expect(out.rounds[0]?.questions).toEqual(['Why us?']);
  });

  it('returns an empty contacts/rounds array when the doc fields are missing', () => {
    const fakeDoc = {
      _id: { toString: () => 'a2' },
      userId: { toString: () => 'u1' },
      company: 'Vercel',
      role: 'Platform',
      status: 'applied',
      tags: [],
      archived: false,
      links: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const out = serializeJobApplication(fakeDoc);

    expect(out.contacts).toEqual([]);
    expect(out.rounds).toEqual([]);
    expect(out.links.roadmapId).toBeUndefined();
  });
});
