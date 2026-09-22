// Why this exists.
//
// An EAS update reaches only a binary that embeds the identical runtime
// string. A binary built before `nativeRuntimeVersion` was split from `version`
// embeds the marketing version instead, so every update published afterwards
// silently misses it. The device is not told it is stranded: expo-updates asks
// the server, the server has nothing for that runtime, and the app logs
// "No update available", which is true and completely misleading.
//
// That cost a full day of chasing app bugs that were in fact fixes that never
// arrived. Nothing in the repository could see it, because the orphaned binary
// was a sideloaded build on a test device, not the recorded store binary.
//
// These helpers read the runtime a real installed binary embeds so the mismatch
// can be caught in one command instead of inferred from symptoms.

import { inflateRawSync } from 'node:zlib';

// Exactly three dot-separated numbers and nothing adjacent, so an IPv4 literal
// in the resource table cannot be mistaken for a runtime: `127.0.0.1` offers
// `127.0.0`, which this rejects because a `.1` follows it.
const VERSION_PATTERN = /(?<![\d.])\d+\.\d+\.\d+(?![\d.])/gu;

/** Walk a ZIP's central directory, found from its end-of-central-directory. */
export function readZipEntries(buffer) {
  let eocd = -1;

  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }

  if (eocd < 0) {
    throw new Error('Not a ZIP archive: no end-of-central-directory record.');
  }

  const total = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = [];

  for (let index = 0; index < total; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Corrupt central directory entry at offset ${cursor}.`);
    }

    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);

    entries.push({
      compressedSize: buffer.readUInt32LE(cursor + 20),
      localHeaderOffset: buffer.readUInt32LE(cursor + 42),
      method: buffer.readUInt16LE(cursor + 10),
      name: buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength),
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function readZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);

  return entry.method === 8 ? inflateRawSync(raw) : raw;
}

/**
 * The runtime lives in `resources.arsc` as the value of the
 * `expo_runtime_version` string resource. The table is a binary format, so read
 * the version strings it holds rather than pretending to parse it: one version
 * is the answer, none or several are reported as unreadable instead of guessed.
 */
export function extractRuntimeVersion(resourcesBuffer) {
  const text = resourcesBuffer.toString('latin1');

  if (!text.includes('expo_runtime_version')) {
    return { ok: false, reason: 'no_runtime_resource' };
  }

  const versions = [...new Set([...text.matchAll(VERSION_PATTERN)].map((match) => match[0]))];

  if (versions.length === 0) {
    return { ok: false, reason: 'no_version_string' };
  }

  if (versions.length > 1) {
    return { ok: false, reason: 'ambiguous', candidates: versions };
  }

  return { ok: true, runtimeVersion: versions[0] };
}

export function readApkRuntimeVersion(apkBuffer) {
  const entries = readZipEntries(apkBuffer);
  const resources = entries.find((entry) => entry.name === 'resources.arsc');

  if (!resources) {
    return { ok: false, reason: 'no_resources' };
  }

  return extractRuntimeVersion(readZipEntry(apkBuffer, resources));
}

export function describeRuntimeMatch({ deviceRuntime, publishedRuntime }) {
  if (!publishedRuntime) {
    return {
      ok: false,
      message: 'Could not read the runtime this repository publishes for.',
    };
  }

  if (!deviceRuntime) {
    return {
      ok: false,
      message:
        'Could not read the runtime the installed binary embeds, so it cannot be ' +
        'proven to receive updates. Treat it as stranded until it can.',
    };
  }

  if (deviceRuntime !== publishedRuntime) {
    return {
      ok: false,
      message:
        `The installed binary embeds runtime ${deviceRuntime}, but this repository publishes ` +
        `for ${publishedRuntime}. No update published from here will ever reach it, and the ` +
        'app will keep reporting "No update available". Install a binary built from this ' +
        'commit, or point nativeRuntimeVersion at the runtime the binary embeds.',
    };
  }

  return {
    ok: true,
    message: `The installed binary embeds runtime ${deviceRuntime} and receives updates published from here.`,
  };
}
