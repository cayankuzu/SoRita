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
  const createdDate = toDate(createdAt);
  const updatedDate = toDate(updatedAt);

  if (!createdDate || !updatedDate) {
    return false;
  }

  return updatedDate.getTime() - createdDate.getTime() > thresholdMs;
}

export function getCreatedUpdatedLabels(
  createdAt?: string | null,
  updatedAt?: string | null,
) {
  const labels: string[] = [];
  const createdLabel = formatAbsoluteDateTime(createdAt);

  if (createdLabel) {
    labels.push(`Olusturma: ${createdLabel}`);
  }

  if (hasMeaningfulUpdate(createdAt, updatedAt)) {
    const updatedLabel = formatAbsoluteDateTime(updatedAt);

    if (updatedLabel) {
      labels.push(`Duzenleme: ${updatedLabel}`);
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
