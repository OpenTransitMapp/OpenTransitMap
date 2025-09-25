import { describe, it, expect } from 'vitest';
import { HealthzResponseSchema } from '../schemas/backend.js';

describe('backend schemas', () => {
  it('validates healthz response', () => {
    const ok = { ok: true, service: 'backend', time: '2024-01-01T00:00:00Z' };
    expect(HealthzResponseSchema.safeParse(ok).success).toBe(true);
    expect(HealthzResponseSchema.safeParse({ ...ok, extra: true } as any).success).toBe(false);
    expect(HealthzResponseSchema.safeParse({ ok: true, service: 'backend' }).success).toBe(false);
  });
});

