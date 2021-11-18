// BKC builder
import diff from "./diff.js";

function parsePlace(input, state, rel) {
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

function applyOp(state, op, code) {
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
    const start = parsePlace(s[0], state, lines.length) - 1;
    const length = s.length >= 2 ? Number.parseInt(s[1]) : 0;
    lines.splice(start, length, ...ed);
    topline = start;
    addedlines -= length;
  }
  return {lines, topline, addedlines};
}

function generateNewLabels(opts, topline, addedlines) {
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
  return {labels, range};
}

function propagateOldLabels(labels, state, topline, addedlines) {
  for (const k of Object.keys(state.labels)) {
    let [start, len] = state.labels[k];
    if (start > topline) {
      start += addedlines;
    } else if (topline >= start && topline < start + len) {
      len += addedlines;
    }

    labels[k] = [start, len];
  }
}

function calculateLens(state, labels, askedlens, range, topline, addedlines) {
  let lens = state.lens;
  if (askedlens !== null) {
    if (askedlens == "") {
      lens = null;
    } else if (askedlens.startsWith("this")) {
      const p = /this(?<delta>[+-]\d+)?/.exec(askedlens).groups;
      const delta = Number.parseInt(p.delta ?? 0);
      lens = [range[0] + delta, range[1] - delta];
    } else if (askedlens != "") {
      lens = null;
      for (const l of askedlens.split('+')) {
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

  return lens;
}

function determineHighlight(old, lines) {
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
  return highlight;
}

export function buildState(state, code, opts) {
  // apply op and generate new code.
  const {lines, topline, addedlines} = applyOp(state, opts.op, code);

  const {labels, range} = generateNewLabels(opts, topline, addedlines);
  propagateOldLabels(labels, state, topline, addedlines);

  const lens = calculateLens(state, labels, opts.lens, range, topline, addedlines);

  const highlight = determineHighlight(state.code, lines);

  return {code: lines, highlight, labels, lens};
}

export function rebuildPRE(state, el) {
  let touse = el.innerHTML;
  if (touse.length == 0) touse = state.code.join("\n");
  const out = touse.split("\n");

  const op = el.getAttribute('op') ?? "";
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
}

