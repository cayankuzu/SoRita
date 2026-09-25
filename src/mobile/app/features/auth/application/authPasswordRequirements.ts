import { PASSWORD_MIN_LENGTH } from '@/mobile/app/shared/validation/contentLimits';

export const AUTH_PASSWORD_REQUIREMENT_IDS = [
  'minimumLength',
  'lowercase',
  'uppercase',
  'number',
  'symbol',
] as const;

export type AuthPasswordRequirementId = typeof AUTH_PASSWORD_REQUIREMENT_IDS[number];

export type AuthPasswordRequirement = {
  id: AuthPasswordRequirementId;
  met: boolean;
};

function getAuthPasswordRequirements(password: string): AuthPasswordRequirement[] {
  return [
    { id: 'minimumLength', met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'lowercase', met: /[a-z]/.test(password) },
    { id: 'uppercase', met: /[A-Z]/.test(password) },
    { id: 'number', met: /\d/.test(password) },
    { id: 'symbol', met: /[^a-zA-Z0-9]/.test(password) },
  ];
}

export function getAuthPasswordRequirementProgress(password: string) {
  const requirements = getAuthPasswordRequirements(password);

  return {
    met: requirements.filter((requirement) => requirement.met).length,
    requirements,
    total: requirements.length,
  };
}
