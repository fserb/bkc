// BKC builder
import diff from "./diff.js";

// label-3+4
const RANGE_RE =
  /(?<label>[a-zA-Z_][a-zA-Z0-9_]*)((?<delta>[+-]\d+)(\+(?<len>\d+))?)?/;

function range(prev, out, str) {
  // we may not have generated code yet.
  const cur = out.code !== null ? out : prev;

  const order = RANGE_RE.exec(str).groups;

  let rng = null;

  if (order.label == "all") {
    rng = [0, cur.code.length];
  } else if (order.label == "edit") {
    rng = [cur.range[0], cur.range[1]];
  } else if (order.label == "last") {
    rng = [prev.range[0], prev.range[1]];
  } else if (order.label == "this") {
    if (out.this === null) {
      throw ReferenceError("'this' used ahead of construction");
    }
    rng = [...out.this];
  } else {
    const labels = out.labels !== null ? out.labels : prev.labels;
    if (labels[order.label] === undefined) {
      throw ReferenceError(`Unknown label "${order.label}".`);
    }
    rng = [...labels[order.label]];
  }

  if (order.delta !== undefined) {
    const delta = Number.parseInt(order.delta);
    rng[0] += delta;
    rng[1] -= delta;
  }

  if (order.len !== undefined) {
    rng[1] = Number.parseInt(order.len);
  }

  return rng;
}

/*
Apply add/sub.
*/
function applyEdit(prev, cmd, out) {
  let action = null;
  let deftarget;
  if (cmd.add !== null) {
    action = "add";
    deftarget = "last";
  }
  if (cmd.sub !== null) {
    if (action === "add") {
      throw ReferenceError("Cannot have add and sum operators together");
    }
    action = "sub";
    deftarget = "all";
  }
  if (action === null) return;

  const target = range(prev, out, cmd[action] ?? deftarget);

  const newcode = cmd.code.split('\n').slice(0, -1);
  let start, length, delta;
  if (action === "add") {
    start = target[0] + target[1];
    length = 0;
    delta = newcode.length;
  } else if (action === "sub") {
    start = target[0];
    length = target[1];
    delta = newcode.length - length;
  }

  out.code = [...prev.code];
  out.code.splice(start, length, ...newcode);

  out.range = [start, newcode.length, delta];
}

/*
Apply @cmd.op(@cmd.newcode) into @prev.code.
*/
function applyOp(prev, cmd, out) {
  if (cmd.op === null) return;

  const newcode = cmd.code.split('\n').slice(0, -1);
  out.range = [0, newcode.length, newcode.length];

  if (cmd.op === "") {
    out.code = newcode;
    return;
  }

  if (cmd.op === "+") {
    out.code = [...prev.code, ...newcode];
    out.range[0] = prev.code.length;
    return;
  }

  if (cmd.op === "++") {
    out.code = [...prev.code];
    const end = prev.range[0] + prev.range[1];
    out.code.splice(end, 0, ...newcode);
    out.range[0] = end;
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
    if (!prev.labels[label]) {
      throw TypeError("Invalid label: " + label);
    }
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
  out.range[2] -= length;
}

/*
Parse @cmd.label into ranges related to current edit.
*/
function generateNewLabels(cmd, out) {
  out.labels = {};
  if (!cmd.label) {
    out.thisLabel = [out.range[0], out.range[1]];
    return;
  }
  let rng;
  for (const l of cmd.label.split(':')) {
    rng = [out.range[0], out.range[1]];
    // label:name+<start>+<length>
    const order = /(?<name>[^+-]+)((?<delta>[+-]\d+)(\+(?<len>\d+))?)?/
      .exec(l).groups;
    if (order.delta) {
      const delta = Number.parseInt(order.delta);
      rng[0] += delta;
      rng[1] -= delta;
    }
    if (order.len) {
      rng[1] = Number.parseInt(order.len);
    }
    out.labels[order.name] = [...rng];
  }
  out.thisLabel = rng;
}

/*
Update @prev.labels into @out.labels depending on current edit.
*/
function propagateOldLabels(prev, out) {
  for (const k of Object.keys(prev.labels)) {
    if (out.labels[k]) continue;
    let [start, len] = prev.labels[k];
    if (start > out.range[0]) {
      start += out.range[2];
    } else if (out.range[0] >= start && out.range[0] < start + len) {
      len += out.range[2];
    }
    out.labels[k] = [start, len];
  }
}

/*
Update @out.lens, either with the current edit, or by using new labels.
*/
function calculateLens(prev, cmd, out) {
  out.lens = null;
  // deep copy previous, if it exists.
  if (prev.lens) {
    out.lens = [];
    for (const d of prev.lens) {
      out.lens.push([...d]);
    }
  }

  if (cmd.lens === null) {
    // if lens AND op are ommited, this is probably an empty PRE, so default to
    // showing everything.
    if (cmd.op == "") {
      out.lens = null;
      return;
    }
    // if there's no lens update, just update the current lens range.
    if (out.lens !== null) {
      for (const d of out.lens) {
        if (d[0] > out.range[0]) {
          d[0] += out.range[1];
        } else if (out.range[0] >= d[0] &&
            out.range[0] < d[0] + d[1]) {
          d[1] += out.range[2];
        }
      }
    }
    return;
  }

  if (cmd.lens == "") {
    out.lens = null;
    return;
  }

  if (cmd.lens.startsWith("this")) {
    // this+4+<len>
    const p = /this((?<delta>[+-]\d+)(\+(?<len>\d+))?)?/.exec(cmd.lens).groups;
    const delta = Number.parseInt(p.delta ?? 0);
    const len = Number.parseInt(p.len ?? 0);
    out.lens = [[out.thisLabel[0] + delta, out.thisLabel[1] - delta + len]];
    return;
  }

  // when there are specific labels listed on lens.
  if (cmd.lens != "") {
    out.lens = [];
    for (const d of cmd.lens.split('-')) {
      let dis = null;
      for (const l of d.split('+')) {
        const t = out.labels[l];
        if (!t) {
          throw TypeError("Invalid label: " + l);
        }
        if (dis === null) {
          dis = [...t];
          continue;
        }
        const start = Math.min(dis[0], t[0]);
        const end = Math.max(dis[0] + dis[1], t[0] + t[1]);
        dis = [start, end - start];
      }
      out.lens.push(dis);
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

export function buildState(prev, cmd) {
  const out = {
    code: null,     // [] of lines of code
    highlight: [],  // [] of lines to be highlighted
    labels: null,   // {label: [start, length]} of references
    lens: null,     // null|[[start, length]...] of lines to show
    range: null,    // [start, length, difflength] of current edit
    this: null,     // last label range OR current edit
  };

  applyOp(prev, cmd, out);
  applyEdit(prev, cmd, out);
  generateNewLabels(cmd, out);
  propagateOldLabels(prev, out);
  calculateLens(prev, cmd, out);
  determineHighlight(prev, out);

  if (cmd.debug) console.log(out);

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

