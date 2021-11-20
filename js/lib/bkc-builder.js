// BKC builder
import diff from "./diff.js";

/*
Apply @cmd.op(@cmd.newcode) into @prev.code.
*/
function applyOp(prev, cmd, out) {
  const newcode = cmd.code.split('\n').slice(0, -1);
  out.range = [0, newcode.length];
  if (cmd.op === "") {
    out.code = newcode;
    return;
  }

  if (cmd.op === "+") {
    out.code = [...prev.code, ...newcode];
    out.range[0] = prev.code.length;
    return;
  }

  let start, length;
  let label = null, delta;

  const input = cmd.op.split(':');
  // parse first part of the input (start).
  const int = Number.parseInt(input[0]);
  if (Number.isFinite(int)) {
    if (input[0][0] == '+' || input[0][1] == '-') {
      start = prev.code.length + int;
    }
    start = int;
  } else {
    // name+3
    const p = /(?<name>[^+-]+)(?<delta>[+-]\d+)?/.exec(input[0]).groups;
    delta = Number.parseInt(p.delta ?? 0);
    label = p.name;
    start = prev.labels[label][0] + delta;
  }

  // parse second part of the input (length).
  if (input.length >= 2) {
    if (input[1] == "") {
      length = prev.labels[label][1] - delta;
    } else {
      length = Number.parseInt(input[1]);
    }
  } else {
    length = 0;
  }

  out.code = [...prev.code];
  out.code.splice(start, length, ...newcode);
  out.range[0] = start;
  out.range[1] -= length;
}

/*
Parse @cmd.label into ranges related to current edit.
*/
function generateNewLabels(cmd, out) {
  out.labels = {};
  if (!cmd.label) return;
  let range;
  for (const l of cmd.label.split(':')) {
    range = [...out.range];
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
    out.labels[order.name] = [...range];
  }
  out.thislabel = range;
}

/*
Update @prev.labels into @out.labels depending on current edit.
*/
function propagateOldLabels(prev, out) {
  for (const k of Object.keys(prev.labels)) {
    let [start, len] = prev.labels[k];
    if (start > out.range[0]) {
      start += out.range[1];
    } else if (out.range[0] >= start && out.range[0] < start + len) {
      len += out.range[1];
    }
    out.labels[k] = [start, len];
  }
}

/*
Update @out.lens, either with the current edit, or by using new labels.
*/
function calculateLens(prev, cmd, out) {
  out.lens = prev.lens ? [...prev.lens] : null;

  if (cmd.lens === null) {
    // if there's no lens update, just update the current lens range.
    if (out.lens !== null) {
      if (out.lens[0] > out.range[0]) {
        out.lens[0] += out.range[1];
      } else if (out.range[0] >= out.lens[0] &&
          out.range[0] < out.lens[0] + out.lens[1]) {
        out.lens[1] += out.range[1];
      }
    }
    return;
  }

  if (cmd.lens == "") {
    out.lens = null;
    return;
  }

  if (cmd.lens.startsWith("this")) {
    // this+4
    const p = /this(?<delta>[+-]\d+)?/.exec(cmd.lens).groups;
    const delta = Number.parseInt(p.delta ?? 0);
    out.lens = [out.thislabel[0] + delta, out.thislabel[1] - delta];
    return;
  }

  if (cmd.lens != "") {
    out.lens = null;
    for (const l of cmd.lens.split('+')) {
      const t = out.labels[l];
      if (out.lens === null) {
        out.lens = [...t];
        continue;
      }
      const start = Math.min(out.lens[0], t[0]);
      const end = Math.max(out.lens[0] + out.lens[1], t[0] + t[1]);
      out.lens = [start, end - start];
    }
  }
}

/*
Determine the diff lines between @prev.code and @out.code.
*/
function determineHighlight(prev, out) {
  out.highlight = [];
  let pos = 0;
  for (const [oper, _] of diff(prev.code, out.code)) {
    if (oper == '+') {
      out.highlight.push(pos++);
    } else if (oper == '=') {
      pos++;
    }
  }

  if (out.highlight.length == 0) {
    for (let i = 0; i < out.code.length; ++i) {
      out.highlight.push(i);
    }
  }
}

/*
state:
  - code: [] of lines of code
  - highlight: [] of lines to be highlighted
  - labels: {label: [start, length]} of references
  - lens: null|[start, length] of lines to show
  - range: [start, length] of current edit
*/
export function buildState(prev, cmd) {
  const out = {};

  applyOp(prev, cmd, out);
  generateNewLabels(cmd, out);
  propagateOldLabels(prev, out);
  calculateLens(prev, cmd, out);
  determineHighlight(prev, out);

  return out;
}

/*
Rebuild PRE to show up directly without BKC.
*/
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

/*
Merge @prev and @state into a new state.

TODO: we could also manually merge lens.
*/
export function mergeState(parent, prev, state) {
  const out = {...state};
  determineHighlight(parent, out);
  return out;
}

