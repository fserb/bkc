// bkc.js

import Tonic from "./tonic.min.esm.js";

let cdid = 0;
class CanvasDemo extends Tonic {
  constructor() {
    super();
    if (!this.id) {
      this.id = `canvas-demo-${cdid++}`;
    }
    this.visible = false;
    this.io = null;
    this.rafid = 0;
  }

  connected() {
    // this.updated();
  }

  #setContent(html='') {
    if (!this.visible) return;
    const iframe = this.querySelector("iframe");
    if (!html.length) {
      iframe.contentWindow.location.reload();
    } else {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();
    }
  }

  updated() {
    if (!this.io) {
      this.io = new IntersectionObserver(en => this.intersect(en), {
        rootMargin: '-50% 0% -50% 0%',
      });
    }
    this.io.disconnect();
    this.io.observe(this);

    if (!this.visible) return;

    const iframe = this.querySelector("iframe");

    this.querySelector('#r').addEventListener('click', ev => {
      this.reRender();
    });
    if (this.visible) {
      iframe.addEventListener('load', ev => {
        this.start();
      })
    }
    iframe.src = "about:blank";
  }

  start() {
    if (!this.state.bkc) return;
    const code = this.state.bkc.code.join('\n');
    this.#setContent(`
      <!doctype html>
      <html><head><style>
      html, body { margin: 0; padding: 0; height: 100%; }
      #c { width: 100%; height: 100%; }
      </style></head><body>
      <canvas id=c></canvas>
      <script type='module'>
      const canvas = document.getElementById('c');
      ${code}
      </script>
      </body></html>`);
    this.lastts = -1;
    this.buffer = [];
    if (this.rafid) {
      cancelAnimationFrame(this.rafid);
    }
    this.rafid = requestAnimationFrame(t => this.frame(t));
  }

  intersect(entries) {
    const nv = entries[0].isIntersecting;
    if (nv == this.visible) return;
    this.visible = nv;
    this.reRender();
    if (!this.visible || !this.state.bkc) {
      this.#setContent();
      return;
    }
  }

  frame(t) {
    if (this.lastts == -1) {
      this.lastts = t;
      this.rafid = requestAnimationFrame(t => this.frame(t));
      return;
    }
    const dt = (t - this.lastts) / 1000;
    this.lastts = t;

    this.buffer.push(dt);
    while (this.buffer.length > 30) this.buffer.shift();

    let s = 0;
    for (const v of this.buffer) s += v;
    s /= this.buffer.length;

    if (this.visible) {
      this.querySelector('#f').innerText = `${Math.round(1 / s)} fps`;
      this.rafid = requestAnimationFrame(t => this.frame(t));
    } else {
      cancelAnimationFrame(this.rafid);
      this.rafid = 0;
    }
  }

  stylesheet() {
    return `
iframe, #ph {
  border: none;
  max-width: 600px;
  width: 100%;
  aspect-ratio: 1920 / 1080;
  display: block;
}
#ph {
  border: 1px solid #000;
  background-color: rgba(0,0,0,0.1);
}
#bar {
  margin: 0;
  width: 100%;
  max-width: 600px;
  height: 24px;
  vertical-align: top;
}
#r {
  float: right;
  line-height: 16px;
  font-size: 32px;
  opacity: 0.5;
  cursor: pointer;
}
#r:hover { opacity: 1.0; }
#f {
  opacity: 0.5;
  float: left;
  font-size: 12px;
}
    `;
  }

  load(ev) {
    console.log(ev);
  }

  render() {
    if (!this.visible) {
      return this.html`
<div id=ph></div>
<div id=bar></div>
      `;
    }

    return this.html`
 <iframe></iframe>
 <div id=bar><div id=f>-</div><div id=r>⟳</div></div>
    `;
  }
}
Tonic.add(CanvasDemo);


function diff(a, b) {
  const frontier = {1: [0, []]};

  for (let d = 0; d <= a.length + b.length; ++d) {
    for (let k = -d; k <= d; k += 2) {
      let x, y, oldX, history;
      const goDown = (k == -d ||
        (k != d && frontier[k - 1][0] < frontier[k + 1][0]));
      if (goDown) {
        [oldX, history] = frontier[k + 1];
        x = oldX;
      } else {
        [oldX, history] = frontier[k - 1];
        x = oldX + 1;
      }
      history = [...history];
      y = x - k;

      if (1 <= y && y <= b.length && goDown) {
        history.push(["+", y - 1]);
      } else if (1 <= x && x <= a.length) {
        history.push(["-", x - 1]);
      }

      while (x < a.length && y < b.length && a[x] == b[y]) {
        x++;
        y++;
        history.push(["=", x - 1]);
      }

      if (x >= a.length && y >= b.length) {
        return history;
      }

      frontier[k] = [x, history];
    }
  }

  return null;
}

function clearLine(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#x60;', '`');
}

function applyOp(state) {
  const aside = document.querySelector("aside ol");

  const c = hljs.highlight(state.code.join("\n"), {language: "js"});

  const high = new Set(state.highlight);

  const output = clearLine(c.value).split("\n");

  // drop empty lines at the beginning/end.
  while (output.length > 0 && output[0].length == 0) {
    output.shift();
  }
  while (output.length > 0 && output[output.length - 1].length == 0) {
    output.pop();
  }

  const input = [];
  for (const li of aside.querySelectorAll("li.alive")) {
    input.push(clearLine(li.innerHTML));
  }


  let pos = 0;
  let rel = 0;
  let relsub = 0;
  let linedelta = 0;
  for (const [op, line] of diff(input, output)) {
    if (op == "=") {
      const o = aside.querySelectorAll(`li.alive`)[pos];
      if (high.has(pos)) {
        o.classList.remove("low");
      } else {
        o.classList.add("low");
      }
      pos++;
      linedelta++;
      rel = relsub = 0;
    }
    if (op == "-") {
      rel = 0;
      const o = aside.querySelectorAll(`li.alive`)[pos];
      if (!o) continue;
      o.addEventListener("transitionend", () => {
        o.replaceWith();
      });

      linedelta--;
      o.classList.add("dead");
      o.classList.remove("alive");
      o.style.top = `${1.25 * relsub++}em`;
    }
    if (op == "+") {
      linedelta++;
      const o = document.createElement("li");
      o.classList.add("alive");
      o.innerHTML = output[line];
      if (high.has(pos)) {
        o.classList.remove("low");
      } else {
        o.classList.add("low");
      }
      o.classList.add("born");
      o.style.top = `${1.25 * rel++}em`;
      aside.insertBefore(o, aside.querySelectorAll(`li.alive`)[pos]);
      o.getBoundingClientRect();
      o.classList.remove("born");
      o.style.top = `0px`;
      relsub = 0;
      pos++;
    }
  }

  aside.style.height = `${aside.querySelectorAll('li.alive').length * 1.25}em`;
}

function calcOp(state, op, code) {
  const old = state.code;
  let lines = code.split('\n').slice(0, -1);

  if (op === "add") {
    lines = [...old, ...lines];
  } else if (op.startsWith("ed:")) {
    const ed = lines;
    lines = [...old];
    const s = op.split(':');
    const start = Number.parseInt(s[1]) - 1;
    const length = s.length >= 3 ? Number.parseInt(s[2]) : 0;
    lines.splice(start, length, ...ed);
  }

  const highlight = [];
  let pos = 0;
  for (const [op, line] of diff(old, lines)) {
    if (op == '+') {
      highlight.push(pos++);
    } else if (op == '=') {
      pos++;
    }
  }
  if (highlight.length == 0) {
    for (let i = 0; i < lines.length; ++i) {
      highlight.push(i);
    }
  }

  return {code: lines, highlight};
}

function intersect(entries) {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    applyOp(JSON.parse(e.target.getAttribute('bkc-state')));
  }
}

function resizeRulers() {
  const rulers = document.querySelectorAll("main .ruler");
  for (const el of rulers) {
    el.style.height = "0px";
  }

  for (let i = 0; i < rulers.length; ++i) {
    const el = rulers[i];
    let h = 0;

    if (i < rulers.length - 1) {
      h = rulers[i + 1].offsetTop;
    } else {
      h = document.querySelector("main").scrollHeight;
    }

    el.style.height = `${h - el.offsetTop}px`;
  }
}

function createRuler(io, state) {
  const ruler = document.createElement("div");
  ruler.classList.add("ruler");
  ruler.setAttribute('bkc-state', JSON.stringify(state));

  io.observe(ruler);
  return ruler;
}

function setup() {
  const ro = new ResizeObserver(resizeRulers);

  const main = document.querySelector("main");
  ro.observe(main);

  const io = new IntersectionObserver(intersect, {
    rootMargin: '-50% 0% -50% 0%',
  });

  let state = {code: [], highlight: []};

  main.insertBefore(createRuler(io, state), main.firstElementChild);

  for (const el of document.querySelectorAll("main pre, canvas-demo")) {
    if (el.tagName == "PRE") {
      state = calcOp(state, el.getAttribute('op') ?? "", el.innerText);

      const spawn = Number.parseInt(el.getAttribute('spawn') ?? 1);

      let touse = el.innerText;
      if (touse.length == 0) touse = state.code.join("\n");

      const c = hljs.highlight(touse, {language: "js"});
      const out = c.value.split("\n");
      el.innerHTML = "";

      while (out.length > 0 && out[0].length == 0) {
        out.shift();
      }
      while (out.length > 0 && out[out.length - 1].length == 0) {
        out.pop();
      }

      for (const l of out) {
        const o = document.createElement("li");
        o.innerHTML = l;
        el.appendChild(o);
      }

      let target = el;
      for (let i = 0; i < spawn; ++i) {
        const n = target.previousSibling;
        if (!n) break;
        target = n;
      }

      main.insertBefore(createRuler(io, state), target);
    } else if (el.tagName == "CANVAS-DEMO") {
      el.state.bkc = JSON.parse(JSON.stringify(state));
      el.reRender();
    }
  }

  resizeRulers();
}

function onReady() {
  if (document.readyState !== "complete") return;
  document.removeEventListener("readystatechange", onReady);
  setup();
}

export default function BKC() {
  document.addEventListener("readystatechange", onReady);
}
