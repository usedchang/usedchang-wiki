import MarkdownIt from "markdown-it";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItFootnote from "markdown-it-footnote";
import markdownItDeflist from "markdown-it-deflist";
import markdownItMark from "markdown-it-mark";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import markdownItTexmath from "markdown-it-texmath";
import katex from "katex";
import hljs from "highlight.js";

function escapeHtmlAttr(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Shared Markdown + KaTeX + highlight.js pipeline for read and editor preview.
 */
export function createMarkdownIt() {
  return new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    typographer: true,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlighted = hljs.highlight(str, { language: lang }).value;
          const safeLang = escapeHtmlAttr(lang);
          return `<pre class="hljs"><div class="code-header"><span class="code-lang">${safeLang}</span><button type="button" class="copy-btn" data-code="${encodeURIComponent(str)}">copy</button></div><code class="hljs language-${lang}">${highlighted}</code></pre>`;
        } catch {
          /* fall through */
        }
      }
      return `<pre class="hljs"><div class="code-header"><button type="button" class="copy-btn" data-code="${encodeURIComponent(str)}">copy</button></div><code>${str}</code></pre>`;
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
    });
}

export function attachCopyButtons(root = document) {
  const buttons = root.querySelectorAll(".copy-btn");
  buttons.forEach((button) => {
    if (button.dataset.copyBound === "1") return;
    button.dataset.copyBound = "1";
    button.addEventListener("click", () => copyCodeFromButton(button));
  });
}

function copyCodeFromButton(button) {
  const code = button.dataset.code;
  if (!code || button.classList.contains("copied")) return;
  navigator.clipboard.writeText(decodeURIComponent(code)).then(
    () => {
      button.textContent = "Copied!";
      button.classList.add("copied");
      window.setTimeout(() => {
        button.textContent = "copy";
        button.classList.remove("copied");
      }, 1000);
    },
    (err) => console.error("Copy failed:", err)
  );
}
