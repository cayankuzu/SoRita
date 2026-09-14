import { describe, expect, it } from 'vitest';

import {
  AUTH_PASSWORD_REQUIREMENT_IDS,
  getAuthPasswordRequirementProgress,
} from '@/mobile/app/features/auth/application/authPasswordRequirements';

describe('authPasswordRequirements', () => {
  it('reports each real password condition instead of inferring strength from length', () => {
    const progress = getAuthPasswordRequirementProgress('longpassword');

    expect(progress.total).toBe(AUTH_PASSWORD_REQUIREMENT_IDS.length);
    expect(progress.met).toBe(2);
    expect(progress.requirements).toEqual([
      { id: 'minimumLength', met: true },
      { id: 'lowercase', met: true },
      { id: 'uppercase', met: false },
      { id: 'number', met: false },
      { id: 'symbol', met: false },
    ]);
  });

  it('marks all conditions only when the actual composition policy is met', () => {
    const progress = getAuthPasswordRequirementProgress('SoRita#2026');

    expect(progress.met).toBe(progress.total);
    expect(progress.requirements.every((requirement) => requirement.met)).toBe(true);
  });
});
