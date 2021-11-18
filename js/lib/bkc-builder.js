// BKC builder
import diff from "./diff.js";

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

function place(input, state, rel) {
  const int = Number.parseInt(input);
  if (Number.isFinite(int)) {
    if (input[0] == '+' || input[1] == '-') {
      return rel + int;
    }
    return int;
  }
  const p = /(?<name>[^+-]+)(?<delta>[+-]\d+)?/.exec(input).groups;
  const delta = Number.parseInt(p.delta ?? 0);
  return state.labels[p.name][0] + delta + 1;
}

function buildState(state, code, opts) {
  // apply op and generate new code.
  const op = opts.op;
  const old = state.code;
  let lines = code.split('\n').slice(0, -1);
  let addedlines = lines.length;
  let topline = 0;
  if (op === "+") {
    lines = [...old, ...lines];
    topline = old.length;
  } else if (op !== "") {
    const ed = lines;
    lines = [...old];
    const s = op.split(':');
    const start = place(s[0], state, lines.length) - 1;
    const length = s.length >= 2 ? Number.parseInt(s[1]) : 0;
    lines.splice(start, length, ...ed);
    topline = start;
    addedlines -= length;
  }

  // generate new label.
  const labels = {};
  const range = [topline, addedlines];
  if (opts.label) {
    for (const l of opts.label.split(':')) {
      range[0] = topline;
      range[1] = addedlines;
      // label:name+<start>+<length>
      const order = /(?<name>[^+-]+)(\+(?<delta>\d+)(\+(?<len>\d+))?)?/
        .exec(l).groups;
      if (order.delta) {
        const delta = Number.parseInt(order.delta);
        range[0] += delta;
        range[1] -= delta;
      }
      if (order.len) {
        range[1] = Number.parseInt(order.len);
      }
      labels[order.name] = [range[0], range[1]];
    }
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

  // calculate lens.
  let lens = state.lens;
  if (opts.lens !== null) {
    if (opts.lens == "") {
      lens = null;
    } else if (opts.lens.startsWith("this")) {
      const p = /this(?<delta>[+-]\d+)?/.exec(opts.lens).groups;
      const delta = Number.parseInt(p.delta ?? 0);
      lens = [range[0] + delta, range[1] - delta];
    } else if (opts.lens != "") {
      lens = null;
      for (const l of opts.lens.split('+')) {
        const t = labels[l];
        if (lens === null) {
          lens = [t[0], t[1]];
          continue;
        }
        const start = Math.min(lens[0], t[0]);
        const end = Math.max(lens[0] + lens[1], t[0] + t[1]);
        lens = [start, end - start];
      }
    }
  } else if (lens !== null) {
    if (lens[0] > topline) {
      lens[0] += addedlines;
    } else if (topline >= lens[0] && topline < lens[0] + lens[1]) {
      lens[1] += addedlines;
    }
  }

  // calculate highlighted area.
  const highlight = [];
  let pos = 0;
  for (const [oper, _] of diff(old, lines)) {
    if (oper == '+') {
      highlight.push(pos++);
    } else if (oper == '=') {
      pos++;
    }
  }
  if (highlight.length == 0) {
    for (let i = 0; i < lines.length; ++i) {
      highlight.push(i);
    }
  }

  return {code: lines, highlight, labels, lens};
}

export function builder(io) {
  const ro = new ResizeObserver(resizeRulers);

  const main = document.querySelector("main");
  ro.observe(main);

  let state = {code: [], highlight: [], labels: {}, lens: null};

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
    const lens = el.getAttribute('lens') ?? null;
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
    if (el.firstElementChild) {
      el.firstElementChild.style.counterSet = `code-line ${firstLine}`;
    }

    let target = el.parentNode;
    for (let i = 0; i < spawn; ++i) {
      const n = target.previousElementSibling;
      if (!n) break;
      target = n;
    }

    main.insertBefore(createRuler(io, state), target);
  }

  resizeRulers();
};
