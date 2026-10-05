/**
 * 分栏拖拽的纯计算部分。
 *
 * 单独放一个模块，是为了让「指针位置 → 左栏宽度占比」这一步可以被单元测试
 * 直接覆盖：拖拽的运行时手感在浏览器里不好断言，而这一步就是拖拽是否跟手、
 * 边界是否夹得住的不部分逻辑。
 */

export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

/** 把占比夹在允许区间内。 */
export function clampSplitRatio(ratio) {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

/**
 * 把指针的 clientX 换算成左栏宽度占比。
 *
 * 分母用容器整宽而不是「容器宽 - 拖拽条宽」，因为 CSS 里左栏宽度写的是
 * `calc(var(--editor-split) * 100%)`，只有同分母，指针停在拖拽条正中时
 * 占比才不会漂移。
 *
 * @param {number} clientX 指针位置（viewport 坐标）
 * @param {{ left: number, width: number }} rect 栅格容器的 bounding rect
 * @param {number} resizerSize 中间拖拽条那一列的宽度
 * @returns {number|null} 左栏占比（MIN_SPLIT_RATIO ~ MAX_SPLIT_RATIO）；
 *   容器还没布局或宽度不宽于拖拽条时返回 null，调用方保持原值即可
 */
export function splitRatioFromPointer(clientX, rect, resizerSize) {
  // 比拖拽条还窄的容器里，左右两栏都没有落脚之处，换出的占比没有意义。
  if (!rect || !(rect.width > resizerSize)) return null;
  // 指针落在拖拽条正中时才与两栏分界对齐，所以要先减掉半个拖拽条。
  const offset = clientX - rect.left - resizerSize / 2;
  return clampSplitRatio(offset / rect.width);
}
