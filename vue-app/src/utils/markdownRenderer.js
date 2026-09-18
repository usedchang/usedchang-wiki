import MarkdownIt from "markdown-it";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItFootnote from "markdown-it-footnote";
import markdownItDeflist from "markdown-it-deflist";
import markdownItMark from "markdown-it-mark";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import markdownItTexmath from "markdown-it-texmath";
import container from "markdown-it-container";
import katex from "katex";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import { pushToast } from "./toast.js";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);

const LANGUAGE_ALIASES = Object.freeze({
  "c++": "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  py: "python",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  sh: "bash",
  shell: "bash",
  console: "bash",
  golang: "go",
  rs: "rust",
});

// Markdown 本身禁用原生 HTML；这里仅补回渲染器生成、DOMPurify 默认不保留的安全属性。
export const MARKDOWN_SANITIZE_OPTIONS = Object.freeze({
  ADD_ATTR: ["target", "referrerpolicy"],
});

function resolveLanguage(language) {
  const normalized = String(language || "").trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function headingText(token) {
  if (!token?.children) return String(token?.content || "").trim();
  return token.children
    .map((child) => {
      if (child.type === "image") return child.content || "";
      if (child.type === "softbreak" || child.type === "hardbreak") return " ";
      return child.content || "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function headingSlug(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "section";
}

function setTokenAttribute(token, name, value) {
  const index = token.attrIndex(name);
  if (index < 0) token.attrPush([name, value]);
  else token.attrs[index][1] = value;
}

function isExternalHttpLink(href) {
  return /^(?:https?:)?\/\//i.test(String(href || ""));
}

async function legacyCopy(text) {
  const doc = globalThis.document;
  if (!doc?.body || typeof doc.createElement !== "function") {
    throw new Error("当前环境不支持复制");
  }
  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "-9999px auto auto -9999px";
  doc.body.appendChild(textarea);
  try {
    textarea.select();
    const copied = doc.execCommand?.("copy");
    if (!copied) throw new Error("浏览器拒绝了复制操作");
  } finally {
    textarea.remove();
  }
}

export async function copyTextToClipboard(text) {
  const value = String(text ?? "");
  const clipboard = globalThis.navigator?.clipboard;
  // isSecureContext 在部分 WebView 中可能未定义；只在明确为不安全环境时跳过现代 API。
  const isSecure = globalThis.window?.isSecureContext ?? globalThis.isSecureContext;
  if (clipboard?.writeText && isSecure !== false) {
    try {
      await clipboard.writeText(value);
      return;
    } catch (modernError) {
      // 权限策略可能拒绝 Clipboard API，继续尝试 execCommand 兼容路径。
      try {
        await legacyCopy(value);
        return;
      } catch (legacyError) {
        throw legacyError || modernError;
      }
    }
  }
  await legacyCopy(value);
}

/**
 * Shared Markdown + KaTeX + highlight.js pipeline for read and editor preview.
 */
export function createMarkdownIt() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: true,
    highlight(str, lang) {
      const resolvedLanguage = resolveLanguage(lang);
      if (resolvedLanguage && hljs.getLanguage(resolvedLanguage)) {
        try {
          const highlighted = hljs.highlight(str, { language: resolvedLanguage }).value;
          const safeLang = escapeHtmlAttr(lang);
          const langClass = resolvedLanguage.replace(/[^a-z0-9_-]/gi, "");
          return `<pre class="hljs"><div class="code-header"><span class="code-lang">${safeLang}</span><button type="button" class="copy-btn" aria-label="复制代码" aria-live="polite">复制</button></div><code class="hljs language-${langClass}">${highlighted}</code></pre>`;
        } catch {
          /* fall through */
        }
      }
      return `<pre class="hljs"><div class="code-header"><span class="code-lang">TEXT</span><button type="button" class="copy-btn" aria-label="复制代码" aria-live="polite">复制</button></div><code>${escapeHtml(str)}</code></pre>`;
    },
  })
    .use(markdownItTaskLists, { enabled: true })
    .use(markdownItFootnote)
    .use(markdownItDeflist)
    .use(markdownItMark)
    .use(markdownItSub)
    .use(markdownItSup)
    .use(markdownItTexmath, {
      engine: katex,
      delimiters: "dollars",
      katexOptions: { throwOnError: false },
    })
    // ??? note / ???+ note 可折叠块
    // marker:"?" 匹配行首的 ??? ，params 是去掉 ??? 后的剩余内容
    .use(container, "admonition", {
      marker: "?",
      validate(params) {
        return params.trim().match(/^(\+)?\s*(\w+)(?:\s+"(.+)")?$/);
      },
      render(tokens, idx) {
        const token = tokens[idx];
        if (token.nesting === 1) {
          const m = token.info.trim().match(/^(\+)?\s*(\w+)(?:\s+"(.+)")?$/);
          const isOpen = !!m[1];
          const typeLabel = m[2];
          const displayTitle = escapeHtml(m[3] || typeLabel);
          return `<details class="admonition admonition-${typeLabel}"${isOpen ? " open" : ""}><summary>${displayTitle}</summary>\n`;
        }
        return "</details>\n";
      },
    });

  const defaultHeadingOpen = md.renderer.rules.heading_open;
  md.renderer.rules.heading_open = (tokens, idx, options, env, renderer) => {
    if (!env?.collectHeadings) {
      return defaultHeadingOpen
        ? defaultHeadingOpen(tokens, idx, options, env, renderer)
        : renderer.renderToken(tokens, idx, options);
    }
    const token = tokens[idx];
    const inline = tokens[idx + 1];
    const text = headingText(inline);
    const counts = env.__headingCounts || (env.__headingCounts = new Map());
    const base = headingSlug(text);
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    const id = `heading-${base}${count > 1 ? `-${count}` : ""}`;
    setTokenAttribute(token, "id", id);
    setTokenAttribute(token, "tabindex", "-1");
    const level = Number(token.tag.slice(1));
    if (text && level >= 1 && level <= 4) {
      (env.headings || (env.headings = [])).push({ id, text, level });
    }
    return defaultHeadingOpen
      ? defaultHeadingOpen(tokens, idx, options, env, renderer)
      : renderer.renderToken(tokens, idx, options);
  };

  const defaultLinkOpen = md.renderer.rules.link_open;
  md.renderer.rules.link_open = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx];
    const href = token.attrGet("href");
    if (isExternalHttpLink(href)) {
      setTokenAttribute(token, "target", "_blank");
      setTokenAttribute(token, "rel", "noopener noreferrer external");
    }
    return defaultLinkOpen
      ? defaultLinkOpen(tokens, idx, options, env, renderer)
      : renderer.renderToken(tokens, idx, options);
  };

  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx];
    setTokenAttribute(token, "loading", "lazy");
    setTokenAttribute(token, "decoding", "async");
    setTokenAttribute(token, "referrerpolicy", "no-referrer");
    return defaultImage
      ? defaultImage(tokens, idx, options, env, renderer)
      : renderer.renderToken(tokens, idx, options);
  };

  return md;
}

export function renderMarkdown(md, source) {
  const env = { collectHeadings: true };
  const html = md.render(String(source || ""), env);
  return { html, headings: env.headings || [] };
}

export function attachCopyButtons(root = document) {
  const buttons = root.querySelectorAll(".copy-btn");
  buttons.forEach((button) => {
    if (button.dataset.copyBound === "1") return;
    button.dataset.copyBound = "1";
    button.dataset.copyLabel = button.textContent?.trim() || "复制";
    button.setAttribute("aria-live", "polite");
    button.addEventListener("click", () => copyCodeFromButton(button));
  });
}

function setCopyButtonState(button, state) {
  const label = button.dataset.copyLabel || "复制";
  const labels = {
    copying: "复制中…",
    copied: "已复制",
    failed: "复制失败",
  };
  const isBusy = state === "copying" || state === "copied";
  button.dataset.copyState = state;
  button.classList.toggle("copying", state === "copying");
  button.classList.toggle("copied", state === "copied");
  button.classList.toggle("copy-failed", state === "failed");
  button.textContent = labels[state] || label;
  button.disabled = isBusy;
  button.setAttribute("aria-label", labels[state] || "复制代码");
  button.setAttribute("title", labels[state] || "复制代码");
}

function resetCopyButton(button) {
  if (button.dataset.copyState === "copying") return;
  setCopyButtonState(button, "idle");
}

function copyCodeFromButton(button) {
  const code = button.closest("pre")?.querySelector("code")?.textContent;
  if (code == null || button.dataset.copyState === "copying" || button.dataset.copyState === "copied") return;
  setCopyButtonState(button, "copying");
  copyTextToClipboard(code).then(
    () => {
      setCopyButtonState(button, "copied");
      pushToast("代码已复制", "success", 1800);
      window.setTimeout(() => {
        resetCopyButton(button);
      }, 1400);
    },
    (error) => {
      setCopyButtonState(button, "failed");
      pushToast("代码复制失败，请手动选择复制", "error", 3200);
      window.setTimeout(() => {
        resetCopyButton(button);
      }, 1800);
      // Keep the rejection handled while retaining a useful diagnostic for devtools.
      if (import.meta.env?.DEV) console.warn("代码复制失败", error);
    }
  );
}
