// editor.js

const HTML = url => `<!doctype html>
<html><head>
<style>
html, body { background-color: #000; margin: 0; width: 100%; height: 100% }
#c { display: block; width: 100%; height: 100%; object-fit: contain; }
</style>
<script type="module">
import * as poly from "${url}js/canvas-polyfill.js";
import * as extend from "${url}extend.js";

for (const k of Object.keys(extend)) {
  window[k] = extend[k];
}

run(document.getElementById("c"));
</script>
</head><body>
<canvas id=c></canvas>
</body></html>
`;

let code = null;
let url = null;

export function connectEditor(siteurl, target) {
  url = siteurl;
  target.jsfiddle.addEventListener("click", openJSFiddle);
  target.codepen.addEventListener("click", openCodepen);
}

export function updateEditorCode(newcode) {
  code = newcode;
}

function getCode() {
  const doc = new DOMParser().parseFromString(code.join('\n'), 'text/html');
  const actual = doc.body.textContent ?? "";

  const filtered = actual
    .replace(/const.*?await import\(".*?\/extend.js"\);\n/s, "");
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

