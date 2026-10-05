import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

/**
 * 由 JS 在运行时写到元素 style 上的变量，不会出现在样式表里。
 * 这两个都带了 var(--x, 兜底值) 的兜底，所以即使没读到也不会让声明失效。
 */
const INLINE_ONLY = new Set(["--editor-split", "--plan-stage"]);

test("every custom property used in style.css is also defined in it", () => {
  const defined = new Set(
    [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((match) => match[1])
  );
  const referenced = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]));

  const missing = [...referenced]
    .filter((name) => !defined.has(name) && !INLINE_ONLY.has(name))
    .sort();

  // 未定义的 var() 会让整条声明静默失效（颜色回退到继承值），肉眼很难发现 ——
  // 这条断言就是为了让这种问题在测试里直接爆出来。
  assert.deepEqual(missing, [], `undefined custom properties: ${missing.join(", ")}`);
});
