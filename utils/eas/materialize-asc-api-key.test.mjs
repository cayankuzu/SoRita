import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  decodeAndValidateAscPrivateKey,
  materializeAscApiKey,
  validateAscCredentialMetadata,
} from "./materialize-asc-api-key.mjs";

function validEncodedKey() {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  return Buffer.from(
    privateKey.export({ format: "pem", type: "pkcs8" }),
  ).toString("base64");
}

const metadata = {
  issuerId: "27f87a66-f102-47b0-be3b-9ab8359d393f",
  keyId: "DC34BUDLPC",
};

test("validates metadata and materializes only a valid P-256 PKCS#8 key", () => {
  const directory = mkdtempSync(join(tmpdir(), "sorita-asc-key-"));
  const outputPath = join(directory, "ephemeral", "AuthKey.p8");
  const encodedKey = validEncodedKey();

  try {
    assert.equal(
      materializeAscApiKey({ encodedKey, outputPath, ...metadata }),
      outputPath,
    );
    assert.match(
      readFileSync(outputPath, "utf8"),
      /^-----BEGIN PRIVATE KEY-----/u,
    );
    if (process.platform !== "win32") {
      assert.equal(statSync(outputPath).mode & 0o777, 0o600);
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("rejects malformed metadata, noncanonical base64 and the wrong key type", () => {
  assert.throws(
    () =>
      validateAscCredentialMetadata({
        issuerId: metadata.issuerId,
        keyId: "bad",
      }),
    /KEY_ID/u,
  );
  assert.throws(
    () =>
      validateAscCredentialMetadata({
        issuerId: "not-a-uuid",
        keyId: metadata.keyId,
      }),
    /ISSUER_ID/u,
  );
  assert.throws(() => decodeAndValidateAscPrivateKey("not base64"), /strict/u);

  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const encodedRsa = Buffer.from(
    privateKey.export({ format: "pem", type: "pkcs8" }),
  ).toString("base64");
  assert.throws(() => decodeAndValidateAscPrivateKey(encodedRsa), /EC P-256/u);
});

test("never overwrites a credential path", () => {
  const directory = mkdtempSync(join(tmpdir(), "sorita-asc-key-"));
  const outputPath = join(directory, "AuthKey.p8");
  const encodedKey = validEncodedKey();

  try {
    materializeAscApiKey({ encodedKey, outputPath, ...metadata });
    assert.throws(
      () => materializeAscApiKey({ encodedKey, outputPath, ...metadata }),
      /overwrite/u,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
