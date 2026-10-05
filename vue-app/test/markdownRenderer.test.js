import assert from "node:assert/strict";
import test from "node:test";
import { createMarkdownIt, renderMarkdown } from "../src/utils/markdownRenderer.js";

test("creates stable unique heading ids and a table of contents", () => {
  const md = createMarkdownIt();
  const result = renderMarkdown(md, "## 重复标题\n\n### 子节\n\n## 重复标题");

  assert.deepEqual(result.headings, [
    { id: "heading-重复标题", text: "重复标题", level: 2 },
    { id: "heading-子节", text: "子节", level: 3 },
    { id: "heading-重复标题-2", text: "重复标题", level: 2 },
  ]);
  assert.match(result.html, /id="heading-重复标题"/);
  assert.match(result.html, /id="heading-重复标题-2"/);
});

test("hardens external links and images", () => {
  const md = createMarkdownIt();
  const { html } = renderMarkdown(
    md,
    "[站外](https://example.com/path) [站内](/solutions)\n\n![图](https://example.com/a.png)"
  );

  assert.match(html, /href="https:\/\/example\.com\/path" target="_blank" rel="noopener noreferrer external"/);
  assert.doesNotMatch(html, /href="\/solutions" target=/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
});

test("does not duplicate source code into a data attribute", () => {
  const md = createMarkdownIt();
  const source = "const payload = '<tag>&';";
  const { html } = renderMarkdown(md, `\`\`\`js\n${source}\n\`\`\``);

  assert.match(html, /class="copy-btn"/);
  assert.doesNotMatch(html, /data-code=/);
  assert.match(html, /&lt;tag&gt;&amp;/);
});

test("keeps the language label and copy button inside the code block", () => {
  const md = createMarkdownIt();
  const { html } = renderMarkdown(md, "```cpp\nint main() {}\n```");

  // 控件与 <code> 平级、贴在 <pre> 内部，不再单独占一条 header。
  assert.match(html, /<pre class="hljs"><code class="hljs language-cpp">/);
  assert.match(html, /<\/code><div class="code-tools">/);
  assert.match(html, /<span class="code-lang">cpp<\/span>/);
  assert.match(html, /class="copy-btn"/);
  assert.doesNotMatch(html, /code-header/);
});

test("keeps the copy button on unlabelled fenced blocks", () => {
  const md = createMarkdownIt();
  const { html } = renderMarkdown(md, "```\nplain text\n```");

  // 没有语言时走兜底分支，但结构一致：标签写 text，复制按钮照旧可用。
  assert.match(html, /<pre class="hljs"><code>/);
  assert.match(html, /<span class="code-lang">text<\/span>/);
  assert.match(html, /class="copy-btn"/);
});
