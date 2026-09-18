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
