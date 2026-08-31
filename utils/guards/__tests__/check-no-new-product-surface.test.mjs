import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  collectFeatureSurface,
  compareFeatureSurface,
  isAllowedInternalEdgeContract,
  isAllowedInternalTable,
  loadFeatureSurfaceSnapshot,
  parseTypeScriptText,
  validateFeatureSurface,
} from '../check-no-new-product-surface.mjs';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SNAPSHOT_PATH = path.join(REPOSITORY_ROOT, 'quality', 'feature-surface.snapshot.json');

function baseline() {
  return loadFeatureSurfaceSnapshot(SNAPSHOT_PATH);
}

function changedSurface(mutate) {
  const current = structuredClone(baseline());
  mutate(current);
  return current;
}

function expectDifference(mutate, expectedMessage) {
  const expected = baseline();
  const current = changedSurface(mutate);
  const differences = compareFeatureSurface(expected, current);
  assert.ok(
    differences.some((difference) => difference.includes(expectedMessage)),
    `Expected a difference containing "${expectedMessage}", received:\n${differences.join('\n')}`,
  );
}

test('the checked-in snapshot matches the current repository surface', () => {
  const expected = baseline();
  const current = collectFeatureSurface(REPOSITORY_ROOT);
  assert.deepEqual(compareFeatureSurface(expected, current), []);
});

test('root route additions and removals are rejected', () => {
  expectDifference((current) => {
    current.navigation.rootRoutes.push('Calendar');
    current.navigation.rootRoutes.sort();
  }, 'root routes added: Calendar');

  expectDifference((current) => {
    current.navigation.rootRoutes = current.navigation.rootRoutes.filter((route) => route !== 'Settings');
  }, 'root routes removed: Settings');
});

test('tab additions and screen entrypoint changes are rejected', () => {
  expectDifference((current) => {
    current.navigation.tabRoutes.push('Events');
    current.navigation.tabRoutes.sort();
  }, 'tab routes added: Events');

  expectDifference((current) => {
    const settings = current.navigation.screenEntrypoints.find((entrypoint) => entrypoint.route === 'Settings');
    settings.module = '@/mobile/app/features/settings/public/securityCenterScreen';
  }, 'screen entrypoints');
});

test('permission and entitlement changes are rejected in either direction', () => {
  expectDifference((current) => {
    current.nativeCapabilities.expoAndroidPermissions.push('READ_CALENDAR');
    current.nativeCapabilities.expoAndroidPermissions.sort();
  }, 'native capability expoAndroidPermissions added: READ_CALENDAR');

  expectDifference((current) => {
    current.nativeCapabilities.iosUsageDescriptionKeys =
      current.nativeCapabilities.iosUsageDescriptionKeys.filter(
        (permission) => permission !== 'NSLocationWhenInUseUsageDescription',
      );
  }, 'native capability iosUsageDescriptionKeys removed: NSLocationWhenInUseUsageDescription');

  expectDifference((current) => {
    current.nativeCapabilities.expoPermissionPlugins.push('expo-calendar');
    current.nativeCapabilities.expoPermissionPlugins.sort();
  }, 'native capability expoPermissionPlugins added: expo-calendar');

  expectDifference((current) => {
    current.nativeCapabilities.expoIosEntitlements.push(
      'com.apple.developer.associated-domains=["applinks:example.invalid"]',
    );
  }, 'native capability expoIosEntitlements added:');
});

test('notification type and visible category changes are rejected', () => {
  expectDifference((current) => {
    current.notifications.types.push('event_reminder');
    current.notifications.types.sort();
  }, 'notification types added: event_reminder');

  expectDifference((current) => {
    current.notifications.categories = current.notifications.categories.filter(
      (category) => category !== 'quotes',
    );
  }, 'notification categories removed: quotes');
});

test('only narrowly named internal hardening Edge contracts are allowed', () => {
  const expected = baseline();
  const allowed = changedSurface((current) => {
    current.api.edgeFunctionContracts.push('security-audit-events');
    current.api.edgeFunctionContracts.sort();
  });
  assert.deepEqual(compareFeatureSurface(expected, allowed), []);

  expectDifference((current) => {
    current.api.edgeFunctionContracts.push('calendar-reminders');
    current.api.edgeFunctionContracts.sort();
  }, 'outside the internal hardening allowlist: calendar-reminders');
});

test('product tables and storage bucket changes are rejected', () => {
  expectDifference((current) => {
    current.data.productTables.push('public.events');
    current.data.productTables.sort();
  }, 'product tables added: public.events');

  expectDifference((current) => {
    current.data.storageBuckets = current.data.storageBuckets.filter(
      (bucket) => bucket !== 'profile-media',
    );
  }, 'storage buckets removed: profile-media');
});

test('narrow internal table additions pass while product-like names do not classify as internal', () => {
  assert.equal(isAllowedInternalTable('private.security_audit_events'), true);
  assert.equal(isAllowedInternalTable('private.media_upload_sessions'), true);
  assert.equal(isAllowedInternalTable('public.upload_outbox'), true);
  assert.equal(isAllowedInternalTable('private.calendar_reminders'), false);
  assert.equal(isAllowedInternalTable('public.events'), false);

  const expected = baseline();
  const allowed = changedSurface((current) => {
    current.data.internalTablesAtBaseline.push('private.security_audit_events');
    current.data.internalTablesAtBaseline.sort();
  });
  assert.deepEqual(compareFeatureSurface(expected, allowed), []);
});

test('Settings views, visible groups, and visible CTAs are frozen bidirectionally', () => {
  expectDifference((current) => {
    current.settings.visibleGroups.push('tr.settings.sections.premium');
    current.settings.visibleGroups.sort();
  }, 'visible Settings groups added: tr.settings.sections.premium');

  expectDifference((current) => {
    current.settings.visibleCtas = current.settings.visibleCtas.filter(
      (cta) => cta !== 'tr.settings.deleteAccount',
    );
  }, 'visible Settings CTAs removed: tr.settings.deleteAccount');

  expectDifference((current) => {
    current.settings.views.push('securityCenter');
    current.settings.views.sort();
  }, 'Settings views added: securityCenter');
});

test('snapshot validation rejects duplicate, unknown, and mislabeled internal entries', () => {
  const duplicate = changedSurface((current) => {
    current.navigation.rootRoutes.push('Auth');
    current.navigation.rootRoutes.sort();
  });
  assert.throws(() => validateFeatureSurface(duplicate), /sorted and contain no duplicates/);

  const unknownKey = changedSurface((current) => {
    current.navigation.newRoutes = [];
  });
  assert.throws(() => validateFeatureSurface(unknownKey), /keys must be exactly/);

  const mislabeled = changedSurface((current) => {
    current.data.internalTablesAtBaseline.push('private.calendar_reminders');
    current.data.internalTablesAtBaseline.sort();
  });
  assert.throws(() => validateFeatureSurface(mislabeled), /contains a non-internal table/);
});

test('source and snapshot parse failures fail closed', () => {
  assert.throws(
    () => parseTypeScriptText('export type Broken = {', 'broken.ts'),
    /cannot parse broken\.ts/,
  );

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sorita-feature-surface-'));
  const malformedSnapshot = path.join(temporaryDirectory, 'snapshot.json');
  try {
    fs.writeFileSync(malformedSnapshot, '{"schemaVersion":', 'utf8');
    assert.throws(
      () => loadFeatureSurfaceSnapshot(malformedSnapshot),
      /cannot parse snapshot/,
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('internal Edge contract naming rejects broad product routes', () => {
  assert.equal(isAllowedInternalEdgeContract('security-audit-events'), true);
  assert.equal(isAllowedInternalEdgeContract('ota-rollback'), true);
  assert.equal(isAllowedInternalEdgeContract('cloudflare-edge-gateway'), true);
  assert.equal(isAllowedInternalEdgeContract('events-discovery'), false);
  assert.equal(isAllowedInternalEdgeContract('premium-gateway'), false);
});
