import {
  normalizeExternalUrlCandidate,
  normalizeSafeExternalUrl,
} from '@/mobile/app/shared/utils/safeLinks';

export type RichTextVariant = 'default' | 'comment';

export type RichTextSegment =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'mention';
      text: string;
    }
  | {
      type: 'link';
      displayText: string;
      url: string;
      safe: boolean;
    };

type ParseOptions = {
  variant?: RichTextVariant;
};

const COLLAPSED_LINK_MAX_LENGTH = 36;

const RICH_TEXT_TOKEN_REGEX =
  /(@[A-Za-z0-9_]{2,})|((?:https?:\/\/|www\.)[^\s<>()]+|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:\/[^\s<>()]*)?)|([A-Za-z][A-Za-z0-9+.-]*:[^\s<>]+)/gi;

function isTokenBoundaryBefore(source: string, index: number) {
  if (index <= 0) {
    return true;
  }

  return /[\s([<{'"`:=]/.test(source[index - 1] ?? '');
}

function trimTrailingLinkText(value: string, mode: 'web' | 'scheme') {
  const punctuation = mode === 'web' ? /[.,!?;)\]}'"`]+$/ : /[.,!?;'"`]+$/;
  const suffixMatch = value.match(punctuation);

  if (!suffixMatch) {
    return { value, suffix: '' };
  }

  const suffix = suffixMatch[0];
  return {
    value: value.slice(0, value.length - suffix.length),
    suffix,
  };
}

function pushTextSegment(segments: RichTextSegment[], text: string) {
  if (!text) {
    return;
  }

  const previous = segments[segments.length - 1];

  if (previous?.type === 'text') {
    previous.text += text;
    return;
  }

  segments.push({ type: 'text', text });
}

function truncateSegment(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxLength - 3))}...`;
}

function truncatePreview(value: string, maxLength = COLLAPSED_LINK_MAX_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.max(16, maxLength - 9);
  const tailLength = Math.max(6, maxLength - headLength - 3);

  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
}

export function formatCollapsedRichLinkText(rawUrl: string) {
  const normalizedCandidate = normalizeExternalUrlCandidate(rawUrl) ?? rawUrl.trim();

  if (!normalizedCandidate) {
    return '';
  }

  try {
    const parsed = new URL(normalizedCandidate);
    const hostname = parsed.hostname.replace(/^www\./i, '');
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    if (!hostname) {
      return truncatePreview(normalizedCandidate);
    }

    let preview = hostname;

    if (pathSegments.length > 0) {
      const previewSegment = pathSegments[pathSegments.length - 1] ?? pathSegments[0];
      preview += `/${truncateSegment(previewSegment, 18)}`;

      if (pathSegments.length > 1 || parsed.search || parsed.hash) {
        preview += '/...';
      }
    } else if (parsed.search || parsed.hash) {
      preview += '/...';
    }

    return truncatePreview(preview);
  } catch {
    return truncatePreview(normalizedCandidate);
  }
}

export function parseRichTextSegments(text: string, options: ParseOptions = {}): RichTextSegment[] {
  const source = text ?? '';
  if (!source) {
    return [];
  }

  const allowMentions = options.variant === 'comment';
  const regex = new RegExp(RICH_TEXT_TOKEN_REGEX.source, 'gi');
  const segments: RichTextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const raw = match[0];
    const start = match.index;

    if (start < cursor) {
      continue;
    }

    if (start > cursor) {
      pushTextSegment(segments, source.slice(cursor, start));
    }

    const mentionCandidate = match[1];
    const webCandidate = match[2];
    const schemeCandidate = match[3];

    if (mentionCandidate) {
      if (allowMentions && isTokenBoundaryBefore(source, start)) {
        segments.push({ type: 'mention', text: mentionCandidate });
      } else {
        pushTextSegment(segments, raw);
      }

      cursor = start + raw.length;
      continue;
    }

    if (webCandidate) {
      if (!isTokenBoundaryBefore(source, start)) {
        pushTextSegment(segments, raw);
        cursor = start + raw.length;
        continue;
      }

      const { value: displayText, suffix } = trimTrailingLinkText(webCandidate, 'web');
      const safeUrl = displayText ? normalizeSafeExternalUrl(displayText) : null;
      const normalizedCandidate = displayText ? normalizeExternalUrlCandidate(displayText) : null;

      if (displayText && safeUrl) {
        segments.push({ type: 'link', displayText, url: safeUrl, safe: true });
        if (suffix) {
          pushTextSegment(segments, suffix);
        }
      } else if (displayText && normalizedCandidate) {
        segments.push({
          type: 'link',
          displayText,
          url: normalizedCandidate,
          safe: false,
        });
        if (suffix) {
          pushTextSegment(segments, suffix);
        }
      } else {
        pushTextSegment(segments, raw);
      }

      cursor = start + raw.length;
      continue;
    }

    if (schemeCandidate) {
      if (!isTokenBoundaryBefore(source, start)) {
        pushTextSegment(segments, raw);
        cursor = start + raw.length;
        continue;
      }

      const { value: displayText, suffix } = trimTrailingLinkText(schemeCandidate, 'scheme');
      const safeUrl = displayText ? normalizeSafeExternalUrl(displayText) : null;

      if (displayText) {
        segments.push({
          type: 'link',
          displayText,
          url: safeUrl ?? displayText,
          safe: Boolean(safeUrl),
        });

        if (suffix) {
          pushTextSegment(segments, suffix);
        }
      } else {
        pushTextSegment(segments, raw);
      }

      cursor = start + raw.length;
      continue;
    }

    pushTextSegment(segments, raw);
    cursor = start + raw.length;
  }

  if (cursor < source.length) {
    pushTextSegment(segments, source.slice(cursor));
  }

  return segments;
}
