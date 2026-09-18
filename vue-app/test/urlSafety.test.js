import test from "node:test";
import assert from "node:assert/strict";

import { getSafeExternalUrl } from "../src/utils/urlSafety.js";

test("allows absolute HTTP(S) links", () => {
  assert.equal(getSafeExternalUrl("https://example.com/task?id=1"), "https://example.com/task?id=1");
  assert.equal(getSafeExternalUrl(" http://example.com/a "), "http://example.com/a");
});

test("rejects executable, credential, and relative link schemes", () => {
  assert.equal(getSafeExternalUrl("javascript:alert(1)"), "");
  assert.equal(getSafeExternalUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(getSafeExternalUrl("//example.com/task"), "");
  assert.equal(getSafeExternalUrl("/local/path"), "");
  assert.equal(getSafeExternalUrl("not a url"), "");
});
