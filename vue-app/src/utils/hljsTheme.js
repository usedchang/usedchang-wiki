/**
 * highlight.js themes all target `.hljs`; importing several at once makes them fight.
 * Swap a single stylesheet link when the app UI theme changes.
 */
const LINK_ID = "usedchang-hljs-theme";

import academicUrl from "highlight.js/styles/github.css?url";
import modernUrl from "highlight.js/styles/vs2015.css?url";
import darkUrl from "highlight.js/styles/github-dark.css?url";
import eyecareUrl from "highlight.js/styles/stackoverflow-light.css?url";

const THEME_TO_HLJS_HREF = {
  academic: academicUrl,
  modern: modernUrl,
  dark: darkUrl,
  eyecare: eyecareUrl,
};

/**
 * @param {string} themeId - matches `data-theme` on documentElement (academic | modern | dark | eyecare)
 */
export function applyHljsStylesheet(themeId) {
  const href = THEME_TO_HLJS_HREF[themeId] || THEME_TO_HLJS_HREF.academic;
  let link = document.getElementById(LINK_ID);
  if (!link) {
    link = document.createElement("link");
    link.id = LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}
