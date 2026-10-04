import test from "node:test";
import assert from "node:assert/strict";

import {
  createMathEngineLoader,
  getMathEngine,
  hasMath,
  resetMathEngine,
  setMathEngine,
} from "../src/utils/markdownMath.js";

test("hasMath detects inline and display delimiters", () => {
  assert.equal(hasMath("行内公式 $a^2+b^2=c^2$ 结束"), true);
  assert.equal(hasMath("块级公式：\n\n$$\n\\sum_{i=1}^{n} a_i\n$$\n"), true);
  assert.equal(hasMath("$$x$$"), true);
});

test("hasMath ignores text without real math", () => {
  assert.equal(hasMath(""), false);
  assert.equal(hasMath(null), false);
  assert.equal(hasMath(undefined), false);
  assert.equal(hasMath("纯中文笔记，没有任何定界符"), false);
  assert.equal(hasMath("价格是 100 元，没有美元符号"), false);
  // 只有一个孤立的 \$ 不构成公式
  assert.equal(hasMath("单个 $ 符号"), false);
  // 跨行的单个 \$ 不是行内公式
  assert.equal(hasMath("$开头\n换行结束$"), false);
});

test("hasMath is cheap enough to run on every render (no \$ short-circuit)", () => {
  // 文档里没有 $ 时应立即返回，不应进入正则
  const big = "段落。".repeat(50_000);
  assert.equal(hasMath(big), false);
});

test("math engine starts empty and can be registered", () => {
  resetMathEngine();
  assert.equal(getMathEngine(), null);

  const fake = { renderToString: (tex) => `<span>${tex}</span>` };
  setMathEngine(fake);
  assert.equal(getMathEngine(), fake);

  resetMathEngine();
  assert.equal(getMathEngine(), null);
});

test("createMathEngineLoader loads once and reuses the engine", async () => {
  resetMathEngine();
  let calls = 0;
  const load = createMathEngineLoader(() => {
    calls++;
    return Promise.resolve({ default: { renderToString: () => "<span/>", tag: "fake" } });
  });

  const first = await load();
  const second = await load();
  assert.equal(calls, 1, "重复调用应共享同一次加载");
  assert.equal(first, second);
  assert.equal(getMathEngine().tag, "fake", "loader 应解包 default 导出");
  resetMathEngine();
});

test("concurrent callers share a single in-flight load", async () => {
  resetMathEngine();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const load = createMathEngineLoader(() => {
    calls++;
    return gate.then(() => ({ default: { renderToString: () => "<span/>" } }));
  });

  const pending = [load(), load(), load()];
  release();
  const results = await Promise.all(pending);
  assert.equal(calls, 1, "并发调用只应触发一次 import");
  assert.equal(new Set(results).size, 1, "所有调用者应拿到同一个引擎");
  resetMathEngine();
});

test("a failed load degrades gracefully and can be retried", async () => {
  resetMathEngine();
  let calls = 0;
  const load = createMathEngineLoader(() => {
    calls++;
    return calls === 1
      ? Promise.reject(new Error("chunk 加载失败"))
      : Promise.resolve({ default: { renderToString: () => "<span/>" } });
  });

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const failed = await load();
    assert.equal(failed, null, "失败时返回 null 而不是抛错，页面应继续渲染");
    assert.equal(getMathEngine(), null);

    // 失败后状态被重置，下一次调用可以重试
    const retried = await load();
    assert.equal(calls, 2, "失败后应允许重试");
    assert.ok(retried, "重试应成功");
  } finally {
    console.warn = originalWarn;
    resetMathEngine();
  }
});
