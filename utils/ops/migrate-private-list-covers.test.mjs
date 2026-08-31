import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPrivateDestination,
  buildPublicCoverReferenceVariants,
  parseArguments,
  parsePublicCoverReference,
} from './migrate-private-list-covers.mjs';

const supabaseUrl = 'https://project-ref.supabase.co';

test('recognizes only the project public place-media object namespace', () => {
  assert.deepEqual(
    parsePublicCoverReference(
      `${supabaseUrl}/storage/v1/object/public/place-media/user-1/list-1/cover.jpg`,
      supabaseUrl,
    ),
    { bucket: 'place-media', path: 'user-1/list-1/cover.jpg' },
  );
  assert.deepEqual(
    parsePublicCoverReference('sorita-storage://place-media/user-1/list%201/cover.jpg', supabaseUrl),
    { bucket: 'place-media', path: 'user-1/list 1/cover.jpg' },
  );
  assert.equal(
    parsePublicCoverReference(
      'https://other.example/storage/v1/object/public/place-media/user/cover.jpg',
      supabaseUrl,
    ),
    null,
  );
  assert.equal(
    parsePublicCoverReference(
      `${supabaseUrl}/storage/v1/object/public/profile-media/user/cover.jpg`,
      supabaseUrl,
    ),
    null,
  );
  assert.equal(
    parsePublicCoverReference('sorita-storage://place-media/user/%2E%2E/cover.jpg', supabaseUrl),
    null,
  );
  assert.equal(
    parsePublicCoverReference('sorita-storage://place-media/user/%2F..%2F/cover.jpg', supabaseUrl),
    null,
  );
});

test('keeps owner-scoped paths and deterministically repairs foreign paths', () => {
  assert.deepEqual(
    buildPrivateDestination({
      listId: 'list-1',
      ownerId: 'user-1',
      sourcePath: 'user-1/list-1/cover.jpg',
    }),
    {
      path: 'user-1/list-1/cover.jpg',
      storageUri: 'sorita-storage://place-media-private/user-1/list-1/cover.jpg',
    },
  );
  const repaired = buildPrivateDestination({
    listId: 'list-1',
    ownerId: 'user-1',
    sourcePath: 'foreign/cover.png',
  });
  assert.match(repaired.path, /^user-1\/lists\/list-1\/cover-migrated-[a-f0-9]{16}\.png$/u);
  assert.equal(repaired.storageUri, `sorita-storage://place-media-private/${repaired.path}`);

  const repairedUnsafeOwnerPath = buildPrivateDestination({
    listId: 'list-1',
    ownerId: 'user-1',
    sourcePath: 'user-1/list 1/cover.jpg',
  });
  assert.match(
    repairedUnsafeOwnerPath.path,
    /^user-1\/lists\/list-1\/cover-migrated-[a-f0-9]{16}\.jpg$/u,
  );
  assert.doesNotMatch(repairedUnsafeOwnerPath.path, /\s/u);
});

test('defaults to bounded dry-run and requires explicit valid arguments', () => {
  assert.deepEqual(parseArguments([]), { apply: false, maximumRows: 100 });
  assert.deepEqual(parseArguments(['--apply', '--max', '25']), {
    apply: true,
    maximumRows: 25,
  });
  assert.throws(() => parseArguments(['--max', '0']), /between 1 and 1000/u);
  assert.throws(() => parseArguments(['--unknown']), /Unknown option/u);
});

test('canonicalizes equivalent public cover references for reference-counted cleanup', () => {
  assert.deepEqual(
    buildPublicCoverReferenceVariants({
      original: 'sorita-storage://place-media/user-1/list%201/cover.jpg',
      sourcePath: 'user-1/list 1/cover.jpg',
      supabaseUrl,
    }),
    [
      'sorita-storage://place-media/user-1/list%201/cover.jpg',
      `${supabaseUrl}/storage/v1/object/public/place-media/user-1/list%201/cover.jpg`,
    ],
  );
});
