import assert from "node:assert/strict";
import test from "node:test";

import { inspectBuffer, inspectText } from "../check-text-encoding.mjs";

test("clean Turkish copy produces no findings", () => {
  const samples = [
    "Güncel çalışma doğrulaması yapıldı",
    "İstanbul'da şu an açık mekânlar",
    "Bildirim ayarlarınızı güncelleyin",
    "Ş ş İ ı Ğ ğ Ü ü Ö ö Ç ç",
  ];
  for (const sample of samples) {
    assert.deepEqual(inspectText(sample), [], `false positive on: ${sample}`);
  }
});

test("plain ASCII and code punctuation produce no findings", () => {
  assert.deepEqual(
    inspectText("const value = foo?.bar ?? []; // 100% fine — em dash"),
    [],
  );
});

test("mojibake from Latin-1 mis-decoding is caught", () => {
  const original = "Güncel çalışma doğrulaması";
  const corrupted = Buffer.from(original, "utf8").toString("latin1");
  const findings = inspectText(corrupted);
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /mojibake sequence/u);
  assert.equal(findings[0].lineNumber, 1);
});

test("the Unicode replacement character is caught", () => {
  const findings = inspectText("bozuk\nmetin � burada");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].lineNumber, 2);
  assert.match(findings[0].reason, /replacement character/u);
});

test("bytes that are not valid UTF-8 are caught", () => {
  const findings = inspectBuffer(Buffer.from([0x48, 0x69, 0xff, 0xfe, 0x21]));
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /not valid UTF-8/u);
});

test("a UTF-8 byte order mark is caught", () => {
  const buffer = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("merhaba", "utf8"),
  ]);
  const findings = inspectBuffer(buffer);
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /byte order mark/u);
});

test("a clean UTF-8 buffer with Turkish characters passes", () => {
  assert.deepEqual(
    inspectBuffer(Buffer.from("Değişiklikler kaydedildi\n", "utf8")),
    [],
  );
});

test("findings report the correct line number in multi-line text", () => {
  const corrupted = Buffer.from("üç", "utf8").toString("latin1");
  const findings = inspectText(`birinci\nikinci\n${corrupted}\ndördüncü`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].lineNumber, 3);
});
