#!/usr/bin/env node

import {
  constants,
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  writeFileSync,
} from "node:fs";
import { createPrivateKey } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KEY_ID_PATTERN = /^[A-Z0-9]{10}$/u;
const ISSUER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const MIN_KEY_BYTES = 100;
const MAX_KEY_BYTES = 16 * 1024;

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--output" || !argv[1]) {
    fail("Usage: materialize-asc-api-key.mjs --output <absolute-path>.");
  }
  if (!isAbsolute(argv[1])) {
    fail("The output path must be absolute.");
  }
  return resolve(argv[1]);
}

export function validateAscCredentialMetadata({ issuerId, keyId }) {
  if (!KEY_ID_PATTERN.test(keyId ?? "")) {
    fail(
      "EXPO_ASC_KEY_ID must be a 10-character upper-case alphanumeric key ID.",
    );
  }
  if (!ISSUER_ID_PATTERN.test(issuerId ?? "")) {
    fail("EXPO_ASC_ISSUER_ID must be a canonical UUID.");
  }
}

export function decodeAndValidateAscPrivateKey(encoded) {
  if (typeof encoded !== "string" || encoded.length === 0) {
    fail("EXPO_ASC_API_KEY_BASE64 is required.");
  }
  if (
    encoded !== encoded.trim() ||
    encoded.length % 4 !== 0 ||
    !BASE64_PATTERN.test(encoded)
  ) {
    fail("EXPO_ASC_API_KEY_BASE64 must be strict, single-line base64.");
  }

  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length < MIN_KEY_BYTES || decoded.length > MAX_KEY_BYTES) {
    decoded.fill(0);
    fail("The decoded App Store Connect key has an invalid size.");
  }
  if (decoded.toString("base64") !== encoded) {
    decoded.fill(0);
    fail("EXPO_ASC_API_KEY_BASE64 is not canonical base64.");
  }

  const pem = decoded.toString("utf8");
  if (
    !pem.startsWith("-----BEGIN PRIVATE KEY-----\n") ||
    !pem.trimEnd().endsWith("-----END PRIVATE KEY-----")
  ) {
    decoded.fill(0);
    fail("The decoded credential must be an unencrypted PKCS#8 private key.");
  }

  try {
    const privateKey = createPrivateKey({
      key: decoded,
      format: "pem",
      type: "pkcs8",
    });
    if (
      privateKey.type !== "private" ||
      privateKey.asymmetricKeyType !== "ec" ||
      privateKey.asymmetricKeyDetails?.namedCurve !== "prime256v1"
    ) {
      fail("The App Store Connect key must be an EC P-256 private key.");
    }
  } catch (error) {
    decoded.fill(0);
    if (
      error instanceof Error &&
      error.message.startsWith("The App Store Connect key")
    ) {
      throw error;
    }
    fail("The decoded App Store Connect private key is invalid.");
  }

  return decoded;
}

export function materializeAscApiKey({
  encodedKey,
  issuerId,
  keyId,
  outputPath,
}) {
  validateAscCredentialMetadata({ issuerId, keyId });
  if (!isAbsolute(outputPath)) fail("The output path must be absolute.");

  const resolvedOutput = resolve(outputPath);
  if (existsSync(resolvedOutput))
    fail("Refusing to overwrite an existing credential file.");

  const parent = dirname(resolvedOutput);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (lstatSync(parent).isSymbolicLink())
    fail("The credential directory cannot be a symbolic link.");
  chmodSync(parent, 0o700);

  const decoded = decodeAndValidateAscPrivateKey(encodedKey);
  let descriptor;
  try {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    descriptor = openSync(
      resolvedOutput,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow,
      0o600,
    );
    writeFileSync(descriptor, decoded);
    closeSync(descriptor);
    descriptor = undefined;
    chmodSync(resolvedOutput, 0o600);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw error;
  } finally {
    decoded.fill(0);
  }

  return resolvedOutput;
}

function main() {
  const outputPath = parseArguments(process.argv.slice(2));
  materializeAscApiKey({
    encodedKey: process.env.EXPO_ASC_API_KEY_BASE64,
    issuerId: process.env.EXPO_ASC_ISSUER_ID,
    keyId: process.env.EXPO_ASC_KEY_ID,
    outputPath,
  });
  process.stdout.write(
    "App Store Connect credential validated and materialized with restricted permissions.\n",
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
