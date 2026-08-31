import { afterEach, describe, expect, it, vi } from 'vitest';

import { mediaAssetsInternals as media } from './handler';

function ascii(value: string) {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function ftyp(brand: string) {
  const bytes = new Uint8Array(64);
  bytes.set(ascii('ftyp'), 4);
  bytes.set(ascii(brand), 8);
  return bytes;
}

function setUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function completePayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'complete-upload',
    bucket: 'place-media-private',
    contentType: 'image/png',
    fileSizeBytes: 1024,
    height: 20,
    mediaType: 'photo',
    objectPath: 'user-1/list-1/place-1/asset.png',
    uploadSessionId: '11111111-1111-4111-8111-111111111111',
    width: 10,
    ...overrides,
  } as Parameters<typeof media.assertMediaMetadata>[0];
}

describe('media-assets validation internals', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses every supported action and rejects malformed action-specific payloads', () => {
    const validPayloads = [
      {
        action: 'upload', bucket: 'profile-media', contentType: 'image/png',
        fileBase64: 'aGVsbG8=', prefix: 'avatar',
      },
      {
        action: 'create-upload-url', bucket: 'place-media-private', contentType: 'video/mp4',
        fileSizeBytes: 100, prefix: 'list/place/video',
        uploadSessionId: '22222222-2222-4222-8222-222222222222',
      },
      {
        action: 'create-upload-url', bucket: 'place-media', contentType: 'image/png',
        fileSizeBytes: 100, prefix: 'list/place/image',
        uploadSessionId: '33333333-3333-4333-8333-333333333333',
      },
      { action: 'create-read-url', bucket: 'place-media-private', path: 'owner/list/image.jpg' },
      { action: 'create-read-urls', bucket: 'place-media-private', paths: ['owner/list/image.jpg'] },
      completePayload(),
      { action: 'delete', bucket: 'place-media', paths: ['user-1/image.jpg'] },
    ];
    for (const payload of validPayloads) {
      expect(media.parseMediaPayload(JSON.stringify(payload))).toMatchObject(payload);
    }

    const invalidPayloads = [
      null,
      [],
      'text',
      {},
      { action: 'upload', bucket: 1, contentType: 'image/png', fileBase64: 'x', prefix: 'a' },
      { action: 'upload', bucket: 'place-media-private', contentType: 'image/png', fileBase64: 'x', prefix: 'a' },
      { action: 'upload', bucket: 'place-media', contentType: 1, fileBase64: 'x', prefix: 'a' },
      { action: 'upload', bucket: 'place-media', contentType: 'image/gif', fileBase64: 'x', prefix: 'a' },
      { action: 'upload', bucket: 'place-media', contentType: 'image/png', fileBase64: 1, prefix: 'a' },
      { action: 'upload', bucket: 'place-media', contentType: 'image/png', fileBase64: ' ', prefix: 'a' },
      { action: 'upload', bucket: 'place-media', contentType: 'image/png', fileBase64: 'x', prefix: '' },
      { action: 'create-upload-url', bucket: 'place-media', contentType: 'image/png', fileSizeBytes: 1, prefix: 'a' },
      { action: 'create-upload-url', bucket: 'place-media-private', contentType: 1, fileSizeBytes: 1, prefix: 'a' },
      { action: 'create-upload-url', bucket: 'place-media-private', contentType: 'image/gif', fileSizeBytes: 1, prefix: 'a' },
      { action: 'create-upload-url', bucket: 'place-media-private', contentType: 'image/png', fileSizeBytes: 0, prefix: 'a' },
      { action: 'create-read-url', bucket: 'place-media', path: 'owner/list/x.jpg' },
      { action: 'create-read-url', bucket: 'place-media-private', path: '' },
      { action: 'create-read-urls', bucket: 'place-media', paths: ['owner/list/x.jpg'] },
      { action: 'create-read-urls', bucket: 'place-media-private', paths: [] },
      {
        ...completePayload(),
        bucket: 'place-media',
        contentType: 'video/mp4',
        durationSeconds: 1,
        mediaType: 'video',
      },
      { ...completePayload(), contentType: 1 },
      { ...completePayload(), contentType: 'image/gif' },
      { ...completePayload(), objectPath: '' },
      { action: 'delete', bucket: 'unknown', paths: [] },
      { action: 'delete', bucket: 'place-media', paths: 'bad' },
      { action: 'delete', bucket: 'place-media', paths: Array.from({ length: 65 }, () => 'x') },
      { action: 'delete', bucket: 'place-media', paths: [1] },
    ];
    for (const payload of invalidPayloads) {
      expect(() => media.parseMediaPayload(JSON.stringify(payload))).toThrow();
    }
  });

  it('normalizes all MIME extensions and rejects unsafe path components', () => {
    const defaults = [
      ['image/heic', 'heic'],
      ['image/png', 'png'],
      ['image/webp', 'webp'],
      ['video/mp4', 'mp4'],
      ['video/quicktime', 'mov'],
      ['video/x-m4v', 'm4v'],
      ['video/3gpp', '3gp'],
      ['video/webm', 'webm'],
      ['image/jpeg', 'jpg'],
      ['unknown', 'jpg'],
    ] as const;
    for (const [contentType, extension] of defaults) {
      expect(media.normalizeExtension(undefined, contentType)).toBe(extension);
    }
    expect(media.normalizeExtension(' JPEG ', 'image/jpeg')).toBe('jpg');
    expect(media.normalizeExtension('png', 'image/png')).toBe('png');
    expect(() => media.normalizeExtension('exe', 'image/png')).toThrow('Invalid media extension');

    expect(media.sanitizePrefix('/list/place/')).toBe('list/place');
    expect(media.sanitizeStoragePath('/owner/list/image.jpg')).toBe('owner/list/image.jpg');
    expect(media.getOwnedPath('user-1', '/user-1/list/image.jpg')).toBe('user-1/list/image.jpg');
    for (const value of ['', '../escape', 'a b', 'a'.repeat(161)]) {
      expect(() => media.sanitizePrefix(value)).toThrow('Invalid upload prefix');
    }
    for (const value of ['', '../escape', 'a b', 'a'.repeat(513)]) {
      expect(() => media.sanitizeStoragePath(value)).toThrow('Invalid storage path');
    }
    for (const value of ['other/image.jpg', 'user-1/../image.jpg']) {
      expect(() => media.getOwnedPath('user-1', value)).toThrow('outside');
    }
  });

  it('applies bucket/action budgets and formats both short and long retry windows', () => {
    expect(media.getMaxUploadBytes('profile-media', 'image/png')).toBe(5 * 1024 * 1024);
    expect(media.getMaxUploadBytes('place-media', 'image/png')).toBeGreaterThan(5 * 1024 * 1024);
    expect(media.getMediaRequestRateLimit('delete')).toBe(160);
    expect(media.getMediaRequestRateLimit('create-upload-url')).toBe(72);
    expect(media.getMediaRequestRateLimit('complete-upload')).toBe(72);
    expect(media.getMediaRequestRateLimit('create-read-url')).toBe(600);
    expect(media.getMediaRequestRateLimit('create-read-urls')).toBe(600);
    expect(media.getMediaRequestRateLimit('upload')).toBe(120);
    expect(media.formatRetryAfterMessage(30_000)).toContain('30 saniye');
    expect(media.formatRetryAfterMessage(60_000)).toContain('1 dakika sonra');
    expect(media.formatRetryAfterMessage(75_000)).toContain('1 dakika 15 saniye');
    expect(media.formatRetryAfterMessage()).toContain('1 dakika sonra');
    expect(media.formatRetryAfterMessage(0)).toContain('1 saniye');
  });

  it('decodes plain/data URL base64 and enforces malformed and size limits', () => {
    expect(media.decodeBase64Payload('aGVsbG8=', 5)).toEqual(ascii('hello'));
    expect(media.decodeBase64Payload('data:image/png;base64,aGk=', 10)).toEqual(ascii('hi'));
    expect(() => media.decodeBase64Payload('%%%%', 10)).toThrow('Malformed media payload');
    expect(() => media.decodeBase64Payload('aGVsbG8=', 4)).toThrow('exceeds size limit');
  });

  it('accepts exact magic bytes for every allowed media family and rejects mismatches', () => {
    const signatures: Array<[string, Uint8Array]> = [
      ['image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      ['image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff])],
      ['image/webp', Uint8Array.from([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')])],
      ['image/heic', ftyp('heic')],
      ['image/heic', ftyp('mif1')],
      ['video/3gpp', ftyp('3gp5')],
      ['video/quicktime', ftyp('qt  ')],
      ['video/x-m4v', ftyp('M4V ')],
      ['video/x-m4v', ftyp('M4VH')],
      ['video/mp4', ftyp('isom')],
      ['video/mp4', ftyp('mp42')],
      ['video/webm', Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3])],
    ];
    for (const [contentType, bytes] of signatures) {
      expect(() => media.assertMediaSignature(contentType, bytes)).not.toThrow();
    }
    for (const [contentType, bytes] of [
      ['image/png', new Uint8Array(2)],
      ['image/webp', ascii('RIFFxxxxNOPE')],
      ['image/heic', ftyp('nope')],
      ['video/3gpp', ftyp('isom')],
      ['video/quicktime', ftyp('isom')],
      ['video/x-m4v', ftyp('isom')],
      ['video/mp4', ftyp('qt  ')],
      ['video/webm', new Uint8Array(4)],
    ] as Array<[string, Uint8Array]>) {
      expect(() => media.assertMediaSignature(contentType, bytes)).toThrow('does not match');
    }
  });

  it('reads PNG, JPEG, WebP, HEIC, ISO, and WebM metadata', () => {
    const png = new Uint8Array(24);
    setUint32(png, 16, 640);
    setUint32(png, 20, 480);
    expect(media.readActualMediaMetadata('image/png', png)).toEqual({ width: 640, height: 480 });
    expect(media.readActualMediaMetadata('image/png', new Uint8Array(10))).toEqual({});

    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 7, 8, 0x01, 0xe0, 0x02, 0x80, 0]);
    expect(media.readActualMediaMetadata('image/jpeg', jpeg)).toEqual({ width: 640, height: 480 });
    expect(media.readActualMediaMetadata('image/jpeg', Uint8Array.from([0xff, 0xd8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toEqual({});
    expect(media.readActualMediaMetadata('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 1, 0, 0, 0, 0, 0, 0]))).toEqual({});

    const webpX = new Uint8Array(30);
    webpX.set(ascii('VP8X'), 12);
    webpX.set([0x7f, 0x02, 0, 0xdf, 0x01, 0], 24);
    expect(media.readActualMediaMetadata('image/webp', webpX)).toEqual({ width: 640, height: 480 });
    const webpL = new Uint8Array(25);
    webpL.set(ascii('VP8L'), 12);
    webpL[20] = 0x2f;
    const packed = (639 | (479 << 14)) >>> 0;
    setUint32(webpL, 21, ((packed & 0xff) << 24) | ((packed & 0xff00) << 8) | ((packed >>> 8) & 0xff00) | (packed >>> 24));
    expect(media.readActualMediaMetadata('image/webp', webpL)).toMatchObject({ width: 640, height: 480 });
    const webpLossy = new Uint8Array(32);
    webpLossy.set([0x9d, 0x01, 0x2a, 0x80, 0x02, 0xe0, 0x01], 16);
    expect(media.readActualMediaMetadata('image/webp', webpLossy)).toEqual({ width: 640, height: 480 });
    expect(media.readActualMediaMetadata('image/webp', new Uint8Array(20))).toEqual({});

    const heic = new Uint8Array(28);
    heic.set(ascii('ispe'), 4);
    setUint32(heic, 12, 640);
    setUint32(heic, 16, 480);
    expect(media.readActualMediaMetadata('image/heic', heic)).toEqual({ width: 640, height: 480 });
    expect(media.readActualMediaMetadata('image/heic', new Uint8Array(8))).toEqual({});

    const iso = new Uint8Array(96);
    iso.set(ascii('mvhd'), 4);
    setUint32(iso, 20, 1000);
    setUint32(iso, 24, 2500);
    setUint32(iso, 32, 64);
    iso.set(ascii('tkhd'), 36);
    setUint32(iso, 88, 640 * 65_536);
    setUint32(iso, 92, 480 * 65_536);
    expect(media.readActualMediaMetadata('video/mp4', iso)).toEqual({
      durationSeconds: 2.5, width: 640, height: 480,
    });

    const float = new Uint8Array(4);
    new DataView(float.buffer).setFloat32(0, 2500);
    const webm = Uint8Array.from([
      0xb0, 0x82, 0x02, 0x80,
      0xba, 0x82, 0x01, 0xe0,
      0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40,
      0x44, 0x89, 0x84, ...float,
    ]);
    expect(media.readActualMediaMetadata('video/webm', webm)).toEqual({
      durationSeconds: 2.5, width: 640, height: 480,
    });
    expect(media.readActualMediaMetadata('video/webm', new Uint8Array(3))).toEqual({
      durationSeconds: undefined, height: undefined, width: undefined,
    });
  });

  it('requires trustworthy dimensions, durations, and declared metadata consistency', () => {
    expect(() => media.assertMediaMetadata(completePayload())).not.toThrow();
    expect(() => media.assertMediaMetadata(completePayload({ mediaType: 'video' }))).toThrow('does not match');
    expect(() => media.assertMediaMetadata(completePayload({
      contentType: 'video/mp4', mediaType: 'photo',
    }))).toThrow('does not match');
    expect(() => media.assertMediaMetadata(completePayload({
      contentType: 'video/mp4', durationSeconds: undefined, mediaType: 'video',
    }))).toThrow('duration is required');
    expect(() => media.assertMediaMetadata(completePayload({ height: undefined }))).toThrow('provided together');
    expect(() => media.assertMediaMetadata(completePayload({ height: undefined, width: undefined }))).not.toThrow();

    expect(() => media.assertActualMediaMetadata(completePayload(), { width: 10, height: 20 })).not.toThrow();
    for (const actual of [
      {},
      { width: 10 },
      { width: 10, height: 0 },
      { width: 8193, height: 20 },
      { width: 10, height: 8193 },
    ]) {
      expect(() => media.assertActualMediaMetadata(completePayload(), actual)).toThrow('dimensions');
    }
    expect(() => media.assertActualMediaMetadata(completePayload(), { width: 11, height: 20 })).toThrow('do not match');
    expect(() => media.assertActualMediaMetadata(completePayload(), { width: 10, height: 21 })).toThrow('do not match');

    const video = completePayload({
      contentType: 'video/mp4', durationSeconds: 5, mediaType: 'video',
    });
    expect(() => media.assertActualMediaMetadata(video, { width: 10, height: 20, durationSeconds: 5.5 })).not.toThrow();
    expect(() => media.assertActualMediaMetadata(video, { width: 10, height: 20 })).toThrow('duration');
    expect(() => media.assertActualMediaMetadata(video, { width: 10, height: 20, durationSeconds: 301 })).toThrow('duration');
    expect(() => media.assertActualMediaMetadata(video, { width: 10, height: 20, durationSeconds: 7 })).toThrow('does not match');
    expect(() => media.assertActualMediaMetadata(
      completePayload({ contentType: 'video/mp4', durationSeconds: undefined, mediaType: 'video' }),
      { width: 10, height: 20, durationSeconds: 5 },
    )).toThrow('does not match');
  });

  it('normalizes database authorization result shapes', () => {
    expect(media.parsePrivateMediaAuthorizationResult(true)).toBe(true);
    expect(media.parsePrivateMediaAuthorizationResult(false)).toBe(false);
    expect(media.parsePrivateMediaAuthorizationResult([{ allowed: false }, { allowed: true }])).toBe(true);
    expect(media.parsePrivateMediaAuthorizationResult({ can_read_private_place_media: true })).toBe(true);
    expect(media.parsePrivateMediaAuthorizationResult({ authorized: true })).toBe(true);
    expect(media.parsePrivateMediaAuthorizationResult({ allowed: true })).toBe(true);
    expect(media.parsePrivateMediaAuthorizationResult({ allowed: false })).toBe(false);
    expect(media.parsePrivateMediaAuthorizationResult(null)).toBe(false);
  });

  it('fetches a bounded prefix/suffix and maps transport failures to verification errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(Uint8Array.from([1, 2, 3, 4]), { status: 206 }))
      .mockResolvedValueOnce(new Response(Uint8Array.from([7, 8, 9, 10]), { status: 206 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(media.fetchObjectPrefixWithRange('https://storage.example/object', 4, 10))
      .resolves.toEqual(Uint8Array.from([1, 2, 3, 4, 7, 8, 9, 10]));
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://storage.example/object', expect.objectContaining({
      headers: { Range: 'bytes=0-3' },
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://storage.example/object', expect.objectContaining({
      headers: { Range: 'bytes=6-9' },
    }));

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(Uint8Array.from([1]), { status: 206 }))));
    await expect(media.fetchObjectPrefixWithRange('https://storage.example/object', 4, 4))
      .resolves.toEqual(Uint8Array.from([1]));
    await expect(media.fetchObjectPrefixWithRange('https://storage.example/object', 4))
      .resolves.toEqual(Uint8Array.from([1]));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('failed', { status: 500 })));
    await expect(media.fetchObjectPrefixWithRange('https://storage.example/object', 4, 4)).rejects.toThrow('could not be verified');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(media.fetchObjectPrefixWithRange('https://storage.example/object', 4, 4)).rejects.toThrow('could not be verified');
  });

  it('authorizes private paths via RPC, safe fallback rules, and batch fail-closed behavior', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { owner_id: 'owner', is_public: true }, error: null }) }),
      }),
    }));
    const admin = (rpc?: ReturnType<typeof vi.fn>) => ({ from, rpc });

    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      admin(vi.fn().mockResolvedValue({ data: true, error: null })) as never,
      'viewer', 'owner/list/image.jpg',
    )).resolves.toBe('owner/list/image.jpg');
    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      admin(vi.fn().mockResolvedValue({ data: false, error: null })) as never,
      'viewer', 'owner/list/image.jpg',
    )).rejects.toThrow('not visible');
    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      admin(vi.fn().mockResolvedValue({ data: null, error: { message: 'db' } })) as never,
      'viewer', 'owner/list/image.jpg',
    )).rejects.toThrow('authorization failed');
    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      admin(undefined) as never, 'owner', 'owner/list/image.jpg',
    )).resolves.toBe('owner/list/image.jpg');
    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      admin(undefined) as never, 'viewer', 'owner/list/image.jpg',
    )).resolves.toBe('owner/list/image.jpg');
    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      admin(undefined) as never, 'viewer', 'invalid',
    )).rejects.toThrow('Invalid storage path');

    const batchRpc = vi.fn().mockResolvedValue({
      data: [{ path: 'owner/list/a.jpg', allowed: true }, { path: 'owner/list/b.jpg', allowed: true }],
      error: null,
    });
    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      admin(batchRpc) as never, 'viewer', ['owner/list/a.jpg', 'owner/list/b.jpg'],
    )).resolves.toEqual(['owner/list/a.jpg', 'owner/list/b.jpg']);
    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      admin(vi.fn().mockResolvedValue({ data: [{ path: 'owner/list/a.jpg', allowed: false }, null], error: null })) as never,
      'viewer', ['owner/list/a.jpg'],
    )).rejects.toThrow('not visible');
    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      admin(vi.fn().mockResolvedValue({ data: null, error: { code: 'XX000', message: 'db' } })) as never,
      'viewer', ['owner/list/a.jpg'],
    )).rejects.toThrow('authorization failed');
    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      admin(vi.fn()
        .mockResolvedValueOnce({ data: null, error: { code: '42883', message: 'missing' } })
        .mockResolvedValue({ data: true, error: null })) as never,
      'viewer', ['owner/list/a.jpg'],
    )).resolves.toEqual(['owner/list/a.jpg']);
    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      admin(vi.fn()
        .mockResolvedValueOnce({ data: null, error: { code: 'XX', message: 'can_read_private_place_media_batch missing' } })
        .mockResolvedValue({ data: true, error: null })) as never,
      'viewer', ['owner/list/a.jpg'],
    )).resolves.toEqual(['owner/list/a.jpg']);
  });
});
