/**
 * KaTeX 引擎的共享状态与按需加载入口。
 *
 * 背景：`markdownRenderer.js` 被阅读页、编辑器、DP 专题页共用，但它同时也被
 * 首页 / 归档页 / 管理列表页间接引用。只要 katex 在**共享模块**里被 import
 * （哪怕是 `import(...)`），打包器就会把它挂到入口 chunk 上，导致首页也下载
 * ~470KB 的 JS 与 ~29KB 的 CSS。
 *
 * 因此这里只保存状态，**动态 import 由真正需要公式的视图发起**
 * （见 `loadMathEngine`），使 katex 成为那三个视图独有的 chunk。
 * 不渲染公式的页面既不会下载 katex，也不会执行它的代码。
 */

/** 行内与块级公式定界符，与 markdown-it-texmath 的 "dollars" 配置保持一致。 */
const INLINE_MATH = /\$[^$\n]+\$/;
const DISPLAY_MATH = /\$\$[\s\S]+?\$\$/;

/** 文本里是否可能出现公式——用来避免对纯中文笔记也无谓地拉 katex。 */
export function hasMath(source) {
  const text = String(source || "");
  if (!text.includes("$")) return false;
  return DISPLAY_MATH.test(text) || INLINE_MATH.test(text);
}

const state = { engine: null, loading: null };

/** 当前已就绪的引擎；未加载时返回 null，此时公式会退化为等宽文本且不抛错。 */
export function getMathEngine() {
  return state.engine;
}

/**
 * 登记一个已加载的引擎。由视图在拿到 katex 模块后调用。
 * 重复登记同一实例是幂等的。
 */
export function setMathEngine(engine) {
  if (engine) state.engine = engine;
  return state.engine;
}

/**
 * 供视图使用的加载器工厂：传入一个返回 Promise 的 loader（即 `() => import("katex")`），
 * 得到幂等的 `loadMathEngine()`。
 *
 * 之所以要多这一层，是为了让动态 import 语句出现在**视图**模块里，
 * 这样打包器只会为用到的视图生成 katex chunk，而不会污染共享入口。
 */
export function createMathEngineLoader(loader) {
  return function loadMathEngine() {
    if (state.engine) return Promise.resolve(state.engine);
    if (state.loading) return state.loading;
    state.loading = loader()
      .then((mod) => setMathEngine(mod.default ?? mod))
      .catch((error) => {
        state.loading = null;
        console.warn("KaTeX 加载失败，公式将以纯文本显示", error);
        return null;
      });
    return state.loading;
  };
}

/** 测试用：清空已加载状态。 */
export function resetMathEngine() {
  state.engine = null;
  state.loading = null;
}
