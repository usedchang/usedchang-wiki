import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  clampSplitRatio,
  splitRatioFromPointer,
} from "../src/utils/editorSplit.js";

test("clamps the split ratio into the allowed range", () => {
  assert.equal(clampSplitRatio(0.5), 0.5);
  assert.equal(clampSplitRatio(0), MIN_SPLIT_RATIO);
  assert.equal(clampSplitRatio(-3), MIN_SPLIT_RATIO);
  assert.equal(clampSplitRatio(1), MAX_SPLIT_RATIO);
  assert.equal(clampSplitRatio(99), MAX_SPLIT_RATIO);
});

test("pointer at the divider centre keeps the split unchanged", () => {
  // 容器 [100, 1120]（宽 1020）；左栏 50% = 510px，拖拽条 20px 落在 [610, 630]，
  // 它的中心是 620 —— 指针停在这里，占比必须还是 0.5，否则拖拽会自己漂移。
  const rect = { left: 100, width: 1020 };
  assert.equal(splitRatioFromPointer(620, rect, 20), 0.5);
  // 分隔条左边缘与右边缘只相差 20px，占比偏差应小于 2%。
  assert.ok(Math.abs(splitRatioFromPointer(610, rect, 20) - 0.5) < 0.02);
  assert.ok(Math.abs(splitRatioFromPointer(630, rect, 20) - 0.5) < 0.02);
});

test("pointer outside the container is clamped to the limits", () => {
  const rect = { left: 100, width: 1020 };
  assert.equal(splitRatioFromPointer(0, rect, 20), MIN_SPLIT_RATIO);
  assert.equal(splitRatioFromPointer(-400, rect, 20), MIN_SPLIT_RATIO);
  // 容器右边界是 100 + 1020 = 1120；贴到右边缘时左栏占比已经超过上限。
  assert.equal(splitRatioFromPointer(1120, rect, 20), MAX_SPLIT_RATIO);
  assert.equal(splitRatioFromPointer(5000, rect, 20), MAX_SPLIT_RATIO);
});

test("moves the split by the same distance the pointer moved", () => {
  const rect = { left: 0, width: 1000 };
  const before = splitRatioFromPointer(500, rect, 20);
  const after = splitRatioFromPointer(600, rect, 20);
  // 容器宽 1000，指针右移 100px，占比应当正好增加 0.1。
  assert.ok(Math.abs(after - before - 0.1) < 1e-9);
});

test("returns null when the container cannot fit the divider", () => {
  assert.equal(splitRatioFromPointer(50, { left: 0, width: 20 }, 20), null);
  assert.equal(splitRatioFromPointer(50, { left: 0, width: 0 }, 20), null);
  assert.equal(splitRatioFromPointer(50, null, 20), null);
});
