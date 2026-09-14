import { describe, expect, it } from 'vitest';

import { validateResetPasswordInput } from '@/mobile/app/features/auth/application/resetPasswordValidation';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('validateResetPasswordInput', () => {
  it('uses the same minimum and composition policy as registration', () => {
    expect(validateResetPasswordInput('short', 'short').passwordError).toBe(
      tr.auth.resetPassword.tooShort,
    );
    expect(validateResetPasswordInput('alllowercase1!', 'alllowercase1!').passwordError).toBe(
      tr.auth.passwordHint.complexity,
    );
  });

  it('rejects predictable passwords and reports confirmation independently', () => {
    expect(validateResetPasswordInput('Password#123', '').passwordError).toBe(
      tr.auth.resetPassword.weak,
    );
    expect(validateResetPasswordInput('SoRita#2026Safe', '').confirmError).toBe(
      tr.auth.resetPassword.confirmRequired,
    );
  });

  it('accepts a compliant password only when confirmation matches', () => {
    expect(validateResetPasswordInput('SoRita#2026Safe', 'different').confirmError).toBe(
      tr.auth.resetPassword.mismatch,
    );
    expect(validateResetPasswordInput('SoRita#2026Safe', 'SoRita#2026Safe')).toEqual({
      confirmError: '',
      passwordError: '',
    });
  });
});
