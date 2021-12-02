// editor.js

const CSS = bgcolor => `
html, body { background-color: ${bgcolor}; margin: 0; width: 100%; height: 100% }
#c { display: block; width: 100%; height: 100%; object-fit: contain; }
`

const HTML = url => `
<canvas id=c></canvas>
<script type="module">
import * as poly from "${url}js/canvas-polyfill.js";
import * as extend from "${url}js/extend.js";

// JSFiddle and Codepen don't accept JS Modules. Shame on them.
window.__bkc_extend = extend;

run(document.getElementById("c"));
</script>
`;

let code = null;
let url = null;

function track(el, clickFunc) {
  el.addEventListener("click", ev => {
    const op =
      window.getComputedStyle(el.parentNode).getPropertyValue("opacity");
    if (op != 1) return;
    clickFunc(ev);
  });
}

export function connectEditor(siteurl, target) {
  url = siteurl;

  track(target.jsfiddle, openJSFiddle);
  track(target.codepen, openCodepen);

}

export function updateEditorCode(newcode) {
  code = newcode;
}

function getCode() {
  const doc = new DOMParser().parseFromString(code.join('\n'), 'text/html');
  const actual = doc.body.textContent ?? "";

  const filtered = actual
    .replace(/const\s+(.*?)\s*=\s*await import\(".*?\/extend.js"\);/s,
      "const $1 = window.__bkc_extend;");
  return `
async function run(canvas) {
${filtered}
}
`;
}

function openJSFiddle(ev) {
  sendPOST("https://jsfiddle.net/api/post/library/pure/", {
    normalize_css: "no",
    js_panel: 0,
    css_panel: 0,
    html_panel: 0,
    title: "Editor " + document.title,
    js: getCode(),
    html: HTML(url),
    css: CSS("#202227"),
    wrap: "b",
  });
}

function openCodepen(ev) {
  sendPOST("https://codepen.io/pen/define", {
    data: JSON.stringify({
      title: "Editor " + document.title,
      editors: "001",
      layout: "left",
      js: getCode(),
      css: CSS("#000"),
      html: HTML(url),
    })
  });
}

function sendPOST(url, data) {
  const form = document.createElement("form");
  form.method = "POST";
  form.target = "_blank";
  form.action = url;
  form.style.display = "none";
  document.body.appendChild(form);

  for (const d of Object.keys(data)) {
    const ih = document.createElement("input");
    ih.type = "hidden";
    ih.name = d;
    ih.value = data[d];
    form.appendChild(ih);
  }
  form.submit();

  form.replaceWith();
}

