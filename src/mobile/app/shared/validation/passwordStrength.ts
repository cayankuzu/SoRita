const COMMON_WEAK_PASSWORD_PARTS = [
  '123456',
  '654321',
  '000000',
  '111111',
  'password',
  'passw0rd',
  'secret',
  'qwerty',
  'asdf',
  'zxc',
  'qwe',
  'admin',
  'welcome',
  'letmein',
  'iloveyou',
  'sifre',
  'şifre',
];

function normalizePasswordInput(value: string | undefined | null) {
  return (value || '').trim().toLowerCase();
}

function normalizeIdentityInput(value: string | undefined | null) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '');
}

function hasRepeatedCharacterRun(value: string) {
  return /(.)\1{2,}/.test(value);
}

function containsIdentityValue(password: string, value: string | undefined | null) {
  const normalizedValue = normalizeIdentityInput(value);

  return normalizedValue.length >= 3 && password.includes(normalizedValue);
}

function containsCommonWeakPattern(password: string) {
  return COMMON_WEAK_PASSWORD_PARTS.some((pattern) => password.includes(pattern));
}

export function doesPasswordMeetCompositionRequirements(
  password: string | undefined | null,
) {
  const value = password || '';

  return (
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^a-zA-Z0-9]/.test(value)
  );
}

export function isPasswordLikelyWeak(
  password: string | undefined | null,
  context?: {
    email?: string;
    name?: string;
    username?: string;
  },
) {
  const normalizedPassword = normalizePasswordInput(password);

  if (normalizedPassword.length < 8) {
    return true;
  }

  if (/^\d+$/.test(normalizedPassword) || /^[a-z]+$/.test(normalizedPassword)) {
    return true;
  }

  if (hasRepeatedCharacterRun(normalizedPassword)) {
    return true;
  }

  if (containsCommonWeakPattern(normalizedPassword)) {
    return true;
  }

  if (containsIdentityValue(normalizedPassword, context?.username)) {
    return true;
  }

  if (containsIdentityValue(normalizedPassword, context?.name)) {
    return true;
  }

  const emailLocalPart = context?.email?.split('@')[0];
  if (containsIdentityValue(normalizedPassword, emailLocalPart)) {
    return true;
  }

  return false;
}
