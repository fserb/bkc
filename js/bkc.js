// bkc.js

import "./lib/canvas-demo.js";
import "./lib/color-show.js";

import diff from "./lib/diff.js";

function clearLine(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#x60;', '`');
}

const LINE_HEIGHT = 1.1;

function applyOp(state) {
  const aside = document.querySelector("aside ol");

  const high = new Set(state.highlight);
  const output = clearLine(state.code.join("\n")).split("\n");

  // drop empty lines at the beginning/end.
  // while (output.length > 0 && output[0].length == 0) {
  //   output.shift();
  // }
  // while (output.length > 0 && output[output.length - 1].length == 0) {
  //   output.pop();
  // }

  const input = [];
  const alives = [];
  for (const li of aside.querySelectorAll("li.alive")) {
    input.push(clearLine(li.innerHTML));
    alives.push(li);
  }

  let pos = 0;
  let rel = 0;
  let relsub = 0;
  const pendingAlive = [];
  for (const [op, line] of diff(input, output)) {
    if (op == "=") {
      const o = alives[pos];
      if (high.has(pos)) {
        o.classList.remove("low");
      } else {
        o.classList.add("low");
      }
      pos++;
      rel = relsub = 0;
    } else if (op == "-") {
      rel = 0;
      const o = alives[pos];
      if (!o) continue;
      o.addEventListener("transitionend", () => {
        o.replaceWith();
      });

      o.classList.add("dead");
      o.classList.remove("alive");
      alives.splice(pos, 1);
      o.style.top = `${LINE_HEIGHT * relsub++}em`;
    } else if (op == "+") {
      const o = document.createElement("li");
      o.classList.add("alive");
      o.innerHTML = output[line];
      if (high.has(pos)) {
        o.classList.remove("low");
      } else {
        o.classList.add("low");
      }
      o.classList.add("born");
      o.style.top = `${LINE_HEIGHT * (rel++ - 1)}em`;
      aside.insertBefore(o, alives[pos]);
      alives.splice(pos, 0, o);
      pendingAlive.push(o);
      relsub = 0;
      pos++;
    }
  }

  if (pendingAlive.length > 0) {
    pendingAlive[0].getBoundingClientRect();
    for (const o of pendingAlive) {
      o.classList.remove("born");
      o.style.top = `0px`;
    }
  }
  const h = Math.ceil(aside.querySelectorAll('li.alive').length * LINE_HEIGHT);
  aside.style.height = `${h}em`;
}

function intersect(entries) {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    applyOp(JSON.parse(e.target.getAttribute('bkc-state')));
  }
}

function place(input, state) {
  console.log(input, state.labels);
  const int = Number.parseInt(input);
  if (Number.isFinite(int)) return int;
  const p = /(?<name>[^+]+)(\+(?<delta>\d+))?/.exec(input).groups;
  let delta = Number.parseInt(p.delta ?? 0);
  console.log("RES", state.labels[p.name][0] + delta);
  return state.labels[p.name][0] + delta;
}

function buildState(state, code, opts) {

  // apply op and generate new code.
  const op = opts.op;
  const old = state.code;
  let lines = code.split('\n').slice(0, -1);
  let addedlines = lines.length;
  let topline = 1;
  if (op === "+") {
    lines = [...old, ...lines];
    topline = old.length + 1;
  } else if (op !== "") {
    const ed = lines;
    lines = [...old];
    const s = op.split(':');
    const start = place(s[0], state) - 1;
    const length = s.length >= 2 ? Number.parseInt(s[1]) : 0;
    lines.splice(start, length, ...ed);
    topline = start;
  }

  // generate new label.
  const labels = {};
  if (opts.label) {
    // label:name+<start>+<length>
    const order = /(?<name>[^+]+)(\+(?<delta>\d+)(\+(?<len>\d+))?)?/
      .exec(opts.label).groups;

    const delta = Number.parseInt(order.delta ?? 0);
    let start = topline + delta;
    let length = Number.parseInt(order.end ?? addedlines - delta);

    labels[order.name] = [start, length];
  }

  // propagate older labels.
  for (const k of Object.keys(state.labels)) {
    let [start, len] = state.labels[k];
    if (start > topline) {
      start += addedlines;
    } else if (topline >= start && topline < start + len) {
      len += addedlines;
    }

    labels[k] = [start, len];
  }

  // calculate highlighted area.
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

  return {code: lines, highlight, labels};
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

  let state = {code: [], highlight: [], labels: {}};

  main.insertBefore(createRuler(io, state), main.firstElementChild);

  for (const el of document.querySelectorAll("main pre code, canvas-demo")) {
    if (el.tagName == "CANVAS-DEMO") {
      const doc = new DOMParser().parseFromString(
        state.code.join('\n'), 'text/html');
      el.code = doc.body.textContent ?? "";
      el.reRender();
      continue;
    }

    if (el.tagName != "CODE") continue;
    const op = el.getAttribute('op') ?? "";
    const label = el.getAttribute('label') ?? "";
    const lens = el.getAttribute('lens') ?? "";
    state = buildState(state, el.innerHTML, {op, label, lens});

    const spawn = Number.parseInt(el.getAttribute('spawn') ?? 1);

    let touse = el.innerHTML;
    if (touse.length == 0) touse = state.code.join("\n");
    const out = touse.split("\n");

    let firstLine = op == "" ? 0 : state.highlight[0];

    // clean up empty lines at the beginning and end.
    while (out.length > 0 && out[0].length == 0) {
      out.shift();
      firstLine++;
    }
    while (out.length > 0 && out[out.length - 1].length == 0) {
      out.pop();
    }

    el.innerHTML = "";
    for (const l of out) {
      const o = document.createElement("li");
      o.innerHTML = l;
      el.appendChild(o);
    }
    el.firstElementChild.style.counterSet = `code-line ${firstLine}`;

    let target = el.parentNode;
    for (let i = 0; i < spawn; ++i) {
      const n = target.previousElementSibling;
      if (!n) break;
      target = n;
    }

    main.insertBefore(createRuler(io, state), target);
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
