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
  const createdLabel = formatAbsoluteDateTime(createdAt);

  if (createdLabel) {
    labels.push(tr.common.createdAt(createdLabel));
  }

  if (hasMeaningfulUpdate(createdAt, updatedAt)) {
    const updatedLabel = formatAbsoluteDateTime(updatedAt);

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
  return getCreatedUpdatedLabels(createdAt, updatedAt).join(' | ');
}
