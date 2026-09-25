import { tr } from '@/mobile/app/shared/i18n/tr';
import { COMMENT_EDIT_WINDOW_MS } from '@/mobile/app/shared/validation/contentLimits';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
}

function getElapsedMs(startedAt?: string | null, endedAt?: string | null) {
  const startedDate = toDate(startedAt);
  const endedDate = endedAt ? toDate(endedAt) : new Date();

  if (!startedDate || !endedDate) {
    return null;
  }

  return endedDate.getTime() - startedDate.getTime();
}

export function formatAbsoluteDateTime(value?: string | null) {
  const date = toDate(value);

  if (!date) {
    return '';
  }

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAbsoluteDate(value?: string | null) {
  const date = toDate(value);

  if (!date) {
    return '';
  }

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_WINDOW_MS = 7 * DAY_MS;

/** Recent activity reads as "3 saat önce"; anything older keeps its calendar date. */
export function formatRelativeDateTime(value?: string | null, now: Date = new Date()) {
  const date = toDate(value);

  if (!date) {
    return '';
  }

  const elapsedMs = now.getTime() - date.getTime();

  if (elapsedMs >= RELATIVE_WINDOW_MS) {
    return formatAbsoluteDate(value);
  }

  if (elapsedMs < MINUTE_MS) {
    return tr.common.relativeTime.justNow;
  }

  if (elapsedMs < HOUR_MS) {
    return tr.common.relativeTime.minutes(Math.floor(elapsedMs / MINUTE_MS));
  }

  if (elapsedMs < DAY_MS) {
    return tr.common.relativeTime.hours(Math.floor(elapsedMs / HOUR_MS));
  }

  return tr.common.relativeTime.days(Math.floor(elapsedMs / DAY_MS));
}

export function hasMeaningfulUpdate(
  createdAt?: string | null,
  updatedAt?: string | null,
  thresholdMs = 1000,
) {
  const elapsedMs = getElapsedMs(createdAt, updatedAt);

  if (elapsedMs == null) {
    return false;
  }

  return elapsedMs > thresholdMs;
}

export function isCommentEditWindowExpired(
  createdAt?: string | null,
  now?: string | null,
  windowMs = COMMENT_EDIT_WINDOW_MS,
) {
  const elapsedMs = getElapsedMs(createdAt, now);

  if (elapsedMs == null) {
    return true;
  }

  return elapsedMs > windowMs;
}

export function getCreatedUpdatedLabels(
  createdAt?: string | null,
  updatedAt?: string | null,
) {
  const labels: string[] = [];
  const createdLabel = formatRelativeDateTime(createdAt);

  if (createdLabel) {
    labels.push(createdLabel);
  }

  if (hasMeaningfulUpdate(createdAt, updatedAt)) {
    const updatedLabel = formatRelativeDateTime(updatedAt);

    if (updatedLabel) {
      labels.push(tr.common.editedAt(updatedLabel));
    }
  }

  return labels;
}

export function formatCreatedUpdatedInline(
  createdAt?: string | null,
  updatedAt?: string | null,
) {
  // The same separator the surrounding metadata uses. A pipe here put two
  // different separators on one line and implied a grouping that is not there.
  return getCreatedUpdatedLabels(createdAt, updatedAt).join(' · ');
}
