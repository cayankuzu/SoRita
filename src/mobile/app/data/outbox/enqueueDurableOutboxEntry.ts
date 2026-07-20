import {
  enqueueOutboxEntry,
  type EnqueueOutboxEntryInput,
  type JsonValue,
} from '@/mobile/app/data/outbox/outboxStorage';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';

export async function enqueueDurableOutboxEntry<TPayload extends JsonValue>(
  input: EnqueueOutboxEntryInput<TPayload>,
) {
  const entry = await enqueueOutboxEntry(input);
  trackEvent({ name: 'outbox_enqueued', params: { operation: entry.kind } });
  return entry;
}
