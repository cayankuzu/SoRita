import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parsePushDeliveryDlqArguments,
  runPushDeliveryDlqCommand,
} from './push-delivery-dlq.mjs';

const deadLetterId = '00000000-0000-4000-8000-000000000011';
const requeueKey = '00000000-0000-4000-8000-000000000012';

test('DLQ requeue requires explicit operator confirmation and a stable key', () => {
  assert.throws(
    () => parsePushDeliveryDlqArguments(['requeue', '--dead-letter-id', deadLetterId]),
    /--requeue-key bir UUID olmalidir/u,
  );
  assert.throws(
    () => parsePushDeliveryDlqArguments([
      'requeue', '--dead-letter-id', deadLetterId, '--requeue-key', requeueKey,
    ]),
    /requeue requires --confirm/u,
  );
  assert.deepEqual(
    parsePushDeliveryDlqArguments([
      'requeue', '--dead-letter-id', deadLetterId, '--requeue-key', requeueKey,
      '--confirm', 'REQUEUE_PUSH_DELIVERY_DLQ',
    ]),
    { command: 'requeue', deadLetterId, requeueKey },
  );
});

test('DLQ health and requeue use only the controlled RPC surface', async () => {
  const rpc = async (name, args) => {
    if (name === 'get_push_delivery_scheduler_health') {
      assert.equal(args, undefined);
      return {
        data: [{
          dead_letter_count: 2,
          healthy: true,
          last_completed_at: '2026-08-31T00:00:00.000Z',
          pending_job_count: 3,
          scheduler_mode: 'external_required',
        }],
        error: null,
      };
    }
    assert.equal(name, 'requeue_push_delivery_dead_letter');
    assert.deepEqual(args, { p_dead_letter_id: deadLetterId, p_requeue_key: requeueKey });
    return { data: true, error: null };
  };

  await assert.doesNotReject(async () => {
    assert.deepEqual(await runPushDeliveryDlqCommand({ command: 'health' }, { rpc }), {
      command: 'health',
      deadLetterCount: 2,
      healthy: true,
      lastCompletedAt: '2026-08-31T00:00:00.000Z',
      pendingJobCount: 3,
      schedulerMode: 'external_required',
    });
    assert.deepEqual(await runPushDeliveryDlqCommand({
      command: 'requeue', deadLetterId, requeueKey,
    }, { rpc }), { command: 'requeue', requeued: true });
  });
});
