import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthRedirect, getSafeNextPath } from "../src/utils/authNavigation.js";

test("accepts normal same-site destinations", () => {
  assert.equal(getSafeNextPath("/solutions?draft=1#editor"), "/solutions?draft=1#editor");
  assert.equal(getSafeNextPath(["/journal", "//evil.example"]), "/journal");
});

test("rejects external, malformed and recursive auth destinations", () => {
  const rejected = [
    undefined,
    "solutions",
    "https://evil.example/path",
    "javascript:alert(1)",
    "//evil.example/path",
    "/\\evil.example/path",
    "/login",
    "/login/",
    "/auth/callback?next=/solutions",
    "/reset-password/",
  ];

  for (const value of rejected) assert.equal(getSafeNextPath(value), "/");
});

test("builds an encoded auth callback on the current origin", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://blog.example" } },
  });

  assert.equal(
    buildAuthRedirect("/auth/callback", "/solutions?draft=1"),
    "https://blog.example/auth/callback?next=%2Fsolutions%3Fdraft%3D1"
  );
  assert.equal(
    buildAuthRedirect("/reset-password", "https://evil.example"),
    "https://blog.example/reset-password"
  );
  assert.throws(
    () => buildAuthRedirect("https://evil.example/callback", "/"),
    /不允许的认证回调路径/
  );

  delete globalThis.window;
});
