import { describe, it, expect } from 'vitest';
import { BulkRoadmapRequestSchema } from '@pathforge/shared';

describe('BulkRoadmapRequestSchema', () => {
  it('accepts a minimal valid payload (titles only)', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'Test' },
      milestones: [{ title: 'M1' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.milestones[0]?.steps).toEqual([]);
    }
  });

  it('accepts a full payload with deadlines and links', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'Learn Rust', description: 'Three-month plan', deadline: '2026-08-01' },
      milestones: [
        {
          title: 'Foundation',
          description: 'Basics',
          deadline: '2026-06-01',
          steps: [
            { title: 'Read book', links: [{ url: 'https://doc.rust-lang.org/book/', label: 'The Book' }] },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roadmap.deadline).toBeInstanceOf(Date);
      expect(result.data.milestones[0]?.deadline).toBeInstanceOf(Date);
    }
  });

  it('rejects payload missing roadmap title', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: {},
      milestones: [{ title: 'M1' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('roadmap.title');
    }
  });

  it('rejects payload with empty milestones array', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T' },
      milestones: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects javascript: URLs in step links', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T' },
      milestones: [
        {
          title: 'M',
          steps: [{ title: 'S', links: [{ url: 'javascript:alert(1)' }] }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('milestones.0.steps.0.links.0.url'))).toBe(true);
    }
  });

  it('rejects data: URLs in step links', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T' },
      milestones: [
        {
          title: 'M',
          steps: [{ title: 'S', links: [{ url: 'data:text/html,<script>alert(1)</script>' }] }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('milestones.0.steps.0.links.0.url'))).toBe(true);
    }
  });

  it('rejects step title longer than 200 chars', () => {
    const longTitle = 'x'.repeat(201);
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T' },
      milestones: [{ title: 'M', steps: [{ title: longTitle }] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('milestones.0.steps.0.title');
    }
  });

  it('accepts payload with deadline supplied as ISO YYYY-MM-DD string and coerces to Date', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T', deadline: '2026-12-31' },
      milestones: [{ title: 'M' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roadmap.deadline).toBeInstanceOf(Date);
    }
  });
});
