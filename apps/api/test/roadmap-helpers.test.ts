import { describe, it, expect } from 'vitest';
import {
  recomputeMilestoneCompletedAt,
  serializeRoadmap,
} from '../src/lib/roadmap-helpers.js';

describe('recomputeMilestoneCompletedAt', () => {
  it('returns undefined when the milestone has zero steps', () => {
    expect(recomputeMilestoneCompletedAt([])).toBeUndefined();
  });

  it('returns undefined when any step is incomplete', () => {
    expect(
      recomputeMilestoneCompletedAt([
        { completed: true },
        { completed: false },
        { completed: true },
      ])
    ).toBeUndefined();
  });

  it('returns a Date when every step is complete', () => {
    const result = recomputeMilestoneCompletedAt([
      { completed: true },
      { completed: true },
    ]);
    expect(result).toBeInstanceOf(Date);
  });
});

describe('serializeRoadmap', () => {
  it('stringifies ObjectIds at every level and omits undefined optionals', () => {
    const fakeDoc = {
      _id: { toString: () => 'r1' },
      userId: { toString: () => 'u1' },
      title: 'T',
      description: 'D',
      deadline: new Date('2026-06-01T00:00:00Z'),
      archived: false,
      milestones: [
        {
          _id: { toString: () => 'm1' },
          title: 'M',
          description: undefined,
          deadline: undefined,
          completedAt: undefined,
          steps: [
            {
              _id: { toString: () => 's1' },
              title: 'S',
              links: [{ url: 'https://example.com', label: undefined }],
              completed: true,
              completedAt: new Date('2026-05-17T00:00:00Z'),
            },
          ],
        },
      ],
      createdAt: new Date('2026-05-17T00:00:00Z'),
      updatedAt: new Date('2026-05-17T00:00:00Z'),
    };

    const out = serializeRoadmap(fakeDoc as never);

    expect(out._id).toBe('r1');
    expect(out.userId).toBe('u1');
    expect(out.milestones[0]?._id).toBe('m1');
    expect(out.milestones[0]?.steps[0]?._id).toBe('s1');
    expect(out.milestones[0]?.steps[0]?.links[0]?.url).toBe('https://example.com');
    expect(out.milestones[0]?.steps[0]?.links[0]?.label).toBeUndefined();
    expect(out.deadline).toEqual(new Date('2026-06-01T00:00:00Z'));
    expect(out.milestones[0]?.description).toBeUndefined();
  });
});
