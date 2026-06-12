import { describe, expect, it } from 'vitest';

import {
  assertNoObjectionableContent,
  containsObjectionableContent,
} from '@/mobile/app/shared/utils/contentModeration';

describe('contentModeration', () => {
  it('detects blocked expressions in direct and separator-heavy forms', () => {
    expect(containsObjectionableContent('Bu yorum tam amk')).toBe(true);
    expect(containsObjectionableContent('a.m.k')).toBe(true);
    expect(containsObjectionableContent('s i k')).toBe(true);
    expect(containsObjectionableContent('Bu cok shit bir yorum')).toBe(true);
  });

  it('does not flag empty values or innocent words that only contain a substring', () => {
    expect(containsObjectionableContent(undefined)).toBe(false);
    expect(containsObjectionableContent('   ')).toBe(false);
    expect(containsObjectionableContent('Klasik muzik severim')).toBe(false);
    expect(containsObjectionableContent('Sussex gezisi harikaydi')).toBe(false);
  });

  it('throws a field-specific validation error for objectionable content', () => {
    expect(() =>
      assertNoObjectionableContent([
        { label: 'Biyografi', value: 'temiz alan' },
        { label: 'Yorum', value: 'bu tam amk olmus' },
      ]),
    ).toThrow('Yorum topluluk kurallarina aykiri ifade iceriyor.');
  });
});
