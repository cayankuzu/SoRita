import { describe, expect, it } from 'vitest';

import {
  formatCollapsedRichLinkText,
  parseRichTextSegments,
} from '@/mobile/app/shared/utils/richText';

describe('richText', () => {
  it('splits comment text into mention, safe link, unsafe scheme, and unsafe host tokens', () => {
    const segments = parseRichTextSegments(
      'Merhaba @ada https://www.youtube.com/watch?v=1, javascript:alert(1) ve https://127.0.0.1/private',
      { variant: 'comment' },
    );

    expect(segments).toEqual([
      { type: 'text', text: 'Merhaba ' },
      { type: 'mention', text: '@ada' },
      { type: 'text', text: ' ' },
      {
        type: 'link',
        displayText: 'https://www.youtube.com/watch?v=1',
        url: 'https://www.youtube.com/watch?v=1',
        safe: true,
      },
      { type: 'text', text: ', ' },
      {
        type: 'link',
        displayText: 'javascript:alert(1)',
        url: 'javascript:alert(1)',
        safe: false,
      },
      { type: 'text', text: ' ve ' },
      {
        type: 'link',
        displayText: 'https://127.0.0.1/private',
        url: 'https://127.0.0.1/private',
        safe: false,
      },
    ]);
  });

  it('leaves addresses and times that only look like links as text', () => {
    for (const text of [
      'Katip Mustafa Çelebi, Küçük Parmakkapı Sk. No:2/B, 34430 Beyoğlu',
      'Bağdat Cd.No:12 Kadıköy',
      'Saat:10:00, kahvaltı vs.Ama erken gel',
    ]) {
      expect(parseRichTextSegments(text)).toEqual([{ type: 'text', text }]);
    }
  });

  it('still links shared domains and flags schemes that open other apps', () => {
    expect(parseRichTextSegments('Menü: kafe.com.tr/menu')).toEqual([
      { type: 'text', text: 'Menü: ' },
      {
        type: 'link',
        displayText: 'kafe.com.tr/menu',
        url: 'https://kafe.com.tr/menu',
        safe: true,
      },
    ]);
    expect(parseRichTextSegments('bak intent://scan')).toEqual([
      { type: 'text', text: 'bak ' },
      { type: 'link', displayText: 'intent://scan', url: 'intent://scan', safe: false },
    ]);
  });

  it('keeps mentions as plain text outside comment mode', () => {
    expect(parseRichTextSegments('Merhaba @ada', { variant: 'default' })).toEqual([
      { type: 'text', text: 'Merhaba @ada' },
    ]);
  });

  it('formats collapsed links with host-first previews', () => {
    expect(
      formatCollapsedRichLinkText(
        'https://uc.com.tr/HZpldITKRLIFgFG4jajk9A/menu?category_id=6a2a99948dff747f4399fb39',
      ),
    ).toBe('uc.com.tr/menu/...');
    expect(formatCollapsedRichLinkText('https://www.youtube.com/watch?v=1')).toBe(
      'youtube.com/watch/...',
    );
    expect(formatCollapsedRichLinkText('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});
