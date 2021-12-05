// BKC builder
import diff from "./diff.js";
import fuzzy from "./fuzzy.js";

function _fuzzySearch(labels, name) {
  let bestScore = 0;
  let best = null;

  for (const k of Object.keys(labels)) {
    const s = fuzzy(k, name);
    if (s > bestScore) {
      bestScore = s;
      best = k;
    }
  }

  if (best === null) return null;

  if (bestScore <= 0.6) {
    console.log(name, "MATCHED", best, "SCORE", bestScore);
  }
  return [...labels[best]];
}

// label-3+4
const RANGE_RE =
  /(?<label>[a-zA-Z#_][a-zA-Z0-9#_]*)(?<collapse>\.)?((?<delta>[+-]\d+)(\+(?<len>\d+))?)?/;

function _label(prev, out, str) {
  // we may not have generated code yet.
  const cur = out.code !== null ? out : prev;

  let order = null;
  try {
    order = RANGE_RE.exec(str).groups;
  } catch (e) {
    throw ReferenceError(`Can't parse label "${str}".`);
  }
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
    if (order.label[0] == '#') {
      autoGenerateLabels(out, prev);
    }

    rng = _fuzzySearch(out.labels, order.label);
    if (rng === null) {
      rng = _fuzzySearch(prev.labels, order.label);
    }
    if (rng === null) {
      throw ReferenceError(`Unknown label "${order.label}".`);
    }
  }

  if (order.collapse !== undefined) {
    rng = [rng[0] + rng[1], 0];
  }

  const delta = order.delta !== undefined ? Number.parseInt(order.delta) : null;
  const len = order.len !== undefined ? Number.parseInt(order.len) : null;
  return {rng, delta, len};
}

function range(prev, out, str) {
  const {rng, delta, len} = _label(prev, out, str);

  if (delta !== null) {
    rng[0] += delta;
    rng[1] -= delta;
  }

  if (len !== null) {
    rng[1] = len;
  }

  return rng;
}

function place(prev, out, str) {
  const {rng, delta, len} = _label(prev, out, str);

  if (delta !== null) {
    rng[0] += delta;
    rng[1] = len !== null ? len : 0;
  }

  return rng;
}

/*
Apply add/sub.
*/
function applyEdit(prev, cmd, out) {
  let action = null;
  let deftarget;

  if (cmd.sub !== null) {
    action = "sub";
    deftarget = "all";
  }

  if (cmd.add !== null) {
    if (action === "sub") {
      throw ReferenceError("Cannot have add and sum operators together");
    }
    action = "add";
    deftarget = "last";
  }

  if (action === null) {
    action = "add";
    deftarget = "last";
  }

  const target = cmd[action] ? cmd[action] : deftarget;

  const newcode = cmd.code.split('\n').slice(0, -1);
  let start, length, delta;
  if (action === "add") {
    const p = place(prev, out, target);
    start = p[0] + p[1];
    length = 0;
    delta = newcode.length;
  } else if (action === "sub") {
    const r = range(prev, out, target);
    start = r[0];
    length = r[1];
    delta = newcode.length - length;
  }

  out.code = [...prev.code];
  out.code.splice(start, length, ...newcode);

  out.range = [start, newcode.length, delta];
}

/*
Parse @cmd.label into ranges related to current edit.
*/
function generateNewLabels(cmd, out) {
  out.labels = {};
  out._autogen = false;
  if (cmd.label === null) {
    out.this = [out.range[0], out.range[1]];
    return;
  }
  let rng;
  for (const l of cmd.label.split(':')) {
    rng = [out.range[0], out.range[1]];
    const order = RANGE_RE.exec(l).groups;
    const name = order.label;
    if (name == "this" || name == "edit" || name == "last" || name == "all") {
      throw ReferenceError(`Name can't be reserved word "${name}"`);
    }
    if (name[0] == "#") {
      throw ReferenceError(`Name can't start with # "${name}"`);
    }
    if (order.delta) {
      const delta = Number.parseInt(order.delta);
      rng[0] += delta;
      rng[1] -= delta;
    }
    if (order.len) {
      rng[1] = Number.parseInt(order.len);
    }
    out.labels[name] = [...rng];
  }
  out.this = rng;
}

/*
Update @prev.labels into @out.labels depending on current edit.
*/
function propagateOldLabels(prev, out) {
  for (const k of Object.keys(prev.labels)) {
    if (out.labels[k]) continue;
    if (k[0] == '#') continue;

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
Super-hacky JS parser, to get functions, class names and methods.
*/
const HTML_RE = /<[^>]+>/gm;
const JS_RE =
  /^((function\s+(?<fname>.+?)\s*\()|(class\s+(?<cname>.+?)\s)|((?<mname>.*?)\s*\(.*?\)\s*\{)|(?<close>}$))/;
const JS_INVALID = new Set(["for", "while", "switch", "if"]);
function* _autogenJS(code) {
  if (!code) return;
  const stack = [];
  const starts = [];
  for (let i = 0; i < code.length; ++i) {
    const l = code[i];
    if (l.length == 0) continue;
    if (l.startsWith("  ".repeat(stack.length + 1))) continue;

    const c = l.replace(HTML_RE, '').trim();

    const M = JS_RE.exec(c);
    if (!M) continue;
    const g = M.groups;

    const name = g.fname ?? g.cname ?? g.mname;

    if (name) {
      stack.push(name);
      starts.push(i);
    } else if (g.close) {
      if (stack.length == 0) continue;
      const final = '#' + stack.join('#');
      const bname = stack.pop();
      const start = starts.pop();
      if (JS_INVALID.has(bname)) continue;
      yield [final, [start, i - start + 1]];
    }
  }
}

/*
Auto-generate labels based on the language.

This is only called if a label is referenced that starts with #.
*/
function autoGenerateLabels(out, prev) {
  if (out._lang === null) return;
  if (out._autogen) return;
  out._autogen = true;
  if (out.labels === null) out.labels = {};
  const code = out.code ?? prev.code;

  const FN = {
    "js": _autogenJS,
  };

  if (!FN[out._lang]) return;

  for (const [l, r] of FN[out._lang](code)) {
    out.labels[l] = r;
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
    // if lens AND there's no edit operation, this is probably an empty PRE, so
    // default to showing everything.
    if (out.range === null) {
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

  // reset lens.
  if (cmd.lens == "") {
    out.lens = null;
    return;
  }

  out.lens = [];
  for (const d of cmd.lens.split('&')) {
    let dis = null;
    for (const l of d.split('>')) {
      const t = range(prev, out, l);
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
    _lang: cmd.lang,
    _codegen: false,
    code: null,     // [] of lines of code
    highlight: [],  // [] of lines to be highlighted
    labels: {},     // {label: [start, length]} of references
    lens: null,     // null|[[start, length]...] of lines to show
    range: null,    // [start, length, difflength] of current edit
    this: null,     // last label range OR current edit
    focus: [],
  };

  applyEdit(prev, cmd, out);
  generateNewLabels(cmd, out);
  propagateOldLabels(prev, out);
  calculateLens(prev, cmd, out);
  determineHighlight(prev, out);

  if (cmd.debug) console.log(out);

  delete out._lang;
  delete out._codegen;

  return out;
}

/*
Rebuild PRE to show up directly without BKC.
*/
export function rebuildPRE(state, el) {
  let touse = el.innerHTML;
  if (touse.length == 0) touse = state.code.join("\n");
  const out = touse.split("\n");

  const op = el.getAttribute('add') ?? el.getAttribute('sub') ?? "";
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
