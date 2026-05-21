import { describe, it, expect } from 'vitest';
import { UpdateMeRequestSchema, UserSchema } from '@pathforge/shared';

describe('UserSchema (timezone field)', () => {
  const base = {
    _id: '507f1f77bcf86cd799439011',
    email: 'a@b.test',
    name: 'A',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a user without timezone', () => {
    expect(UserSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a user with an IANA-shaped timezone', () => {
    expect(
      UserSchema.safeParse({ ...base, timezone: 'America/Los_Angeles' }).success
    ).toBe(true);
  });

  it('rejects an empty timezone string', () => {
    expect(UserSchema.safeParse({ ...base, timezone: '' }).success).toBe(false);
  });

  it('rejects a timezone longer than 80 chars', () => {
    expect(
      UserSchema.safeParse({ ...base, timezone: 'x'.repeat(81) }).success
    ).toBe(false);
  });
});

describe('UpdateMeRequestSchema', () => {
  it('accepts an empty body (no-op update)', () => {
    expect(UpdateMeRequestSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a string timezone', () => {
    expect(
      UpdateMeRequestSchema.safeParse({ timezone: 'America/Los_Angeles' }).success
    ).toBe(true);
  });

  it('accepts a null timezone (clear intent)', () => {
    expect(UpdateMeRequestSchema.safeParse({ timezone: null }).success).toBe(true);
  });

  it('rejects an empty timezone string', () => {
    expect(UpdateMeRequestSchema.safeParse({ timezone: '' }).success).toBe(false);
  });

  it('rejects a timezone longer than 80 chars', () => {
    expect(
      UpdateMeRequestSchema.safeParse({ timezone: 'x'.repeat(81) }).success
    ).toBe(false);
  });

  it('passes through unknown fields (Zod default passthrough)', () => {
    expect(
      UpdateMeRequestSchema.safeParse({ timezone: 'UTC', name: 'X' }).success
    ).toBe(true);
  });
});
