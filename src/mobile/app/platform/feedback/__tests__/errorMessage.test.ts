import { describe, expect, it } from 'vitest';

import {
  getUserFacingErrorMessage,
  isLikelyNetworkError,
  isLikelyTimeoutError,
} from '@/mobile/app/platform/feedback/errorMessage';

describe('errorMessage helpers', () => {
  it('maps timeout errors to a user-friendly retry message', () => {
    expect(isLikelyTimeoutError(new Error('Request timed out after 8000ms'))).toBe(true);
    expect(
      getUserFacingErrorMessage(
        new Error('Request timed out after 8000ms'),
        'Varsayilan hata',
      ),
    ).toBe('Bağlantı geç yanıt veriyor. Lütfen tekrar dene.');
  });

  it('maps network failures to a connectivity message', () => {
    expect(isLikelyNetworkError(new Error('Network request failed'))).toBe(true);
    expect(
      getUserFacingErrorMessage(new Error('Failed to fetch'), 'Varsayilan hata'),
    ).toBe('İnternet bağlantısı şu an kullanılamıyor. Bağlantını kontrol edip tekrar dene.');
  });

  it('preserves short domain-specific messages', () => {
    expect(
      getUserFacingErrorMessage(
        new Error('Bu kullanici adi zaten kullaniliyor'),
        'Varsayilan hata',
      ),
    ).toBe('Bu kullanici adi zaten kullaniliyor');
  });
});
