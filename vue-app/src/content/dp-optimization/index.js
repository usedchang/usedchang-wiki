import intro from "./intro.md?raw";
import stateDesign from "./01-state-design.md?raw";
import prefix from "./02-prefix.md?raw";
import dataStructure from "./03-data-structure.md?raw";
import matrix from "./04-matrix.md?raw";
import bitset from "./05-bitset.md?raw";
import convolution from "./06-convolution.md?raw";

/** @typedef {{ id: string; num: string; title: string; subtitle: string; markdown: string }} DpSection */

/** @type {DpSection[]} */
export const DP_SECTIONS = [
  {
    id: "intro",
    num: "00",
    title: "介绍",
    subtitle: "六类优化总览与选用顺序",
    markdown: intro,
  },
  {
    id: "state-design",
    num: "01",
    title: "状态设计优化",
    subtitle: "滚动数组、值域交换、等价合并",
    markdown: stateDesign,
  },
  {
    id: "prefix",
    num: "02",
    title: "前缀和与前缀最值优化",
    subtitle: "区间聚合压缩为 O(n)",
    markdown: prefix,
  },
  {
    id: "data-structure",
    num: "03",
    title: "数据结构优化",
    subtitle: "单调队列、BIT、线段树",
    markdown: dataStructure,
  },
  {
    id: "matrix",
    num: "04",
    title: "矩阵快速幂与倍增优化",
    subtitle: "阶段跳跃 O(log T)",
    markdown: matrix,
  },
  {
    id: "bitset",
    num: "05",
    title: "位运算优化",
    subtitle: "bitset 压位加速布尔 DP",
    markdown: bitset,
  },
  {
    id: "convolution",
    num: "06",
    title: "卷积优化",
    subtitle: "FFT / NTT / FWT / 分治",
    markdown: convolution,
  },
];
