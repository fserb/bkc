// BKC builder
import diff from "./diff.js";
import fuzzy from "./fuzzy.js";

/*
Fuzzy search all available labels.
*/
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
    console.warn(name, "MATCHED", best, "SCORE", bestScore);
  }
  return [...labels[best]];
}

/*
Find the upper indent context of the code.
It assumes code is indented with 2 spaces.
*/
function _getContextRange(cur) {
  if (cur.range[1] == 0) return [0, cur.code.length];

  let indent = 1e9;
  for (let l = cur.range[0]; l < cur.range[0] + cur.range[1]; ++l) {
    if (cur.code[l].length == 0) continue;
    const id = cur.code[l].search(/\S|$/);
    indent = Math.min(indent, id);
  }
  indent = 2 * (Math.ceil(indent / 2) - 1);

  let start;
  for (start = cur.range[0] - 1; start >= 0; --start) {
    if (cur.code[start].length == 0) continue;
    const id = cur.code[start].search(/\S|$/);
    if (id <= indent) break;
  }

  let end;
  for (end = cur.range[0] + cur.range[1]; end < cur.code.length; ++end) {
    if (cur.code[end].length == 0) continue;
    const id = cur.code[end].search(/\S|$/);
    if (id <= indent) break;
  }

  start = Math.max(0, start);
  end = Math.min(cur.code.length, end);

  return [start, end - start + 1];
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
  } else if (order.label == "edit" || order.label == "this") {
    rng = [cur.range[0], cur.range[1]];
  } else if (order.label == "last") {
    rng = [prev.range[0], prev.range[1]];
  } else if (order.label == "ctx") {
    rng = _getContextRange(cur);
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
const JS_TOP_RE = new RegExp([
  /^(class\s+(?<cname>[^\s]+))/,                     // class X
  /^((async\s+)?function\s*\*?\s*(?<fname>[^\s.(]+))/,  // function Y()
].map(r => r.source).join('|'));
const JS_CLASS_RE = new RegExp([
  /^(async\s*)?\*?\s*(?<mname>[^\s(]+)\s*\(/,              // method()
].map(r => r.source).join('|'));

function* _autogenJS(code) {
  if (!code) return;
  const stack = [];
  for (let i = 0; i < code.length; ++i) {
    const l = code[i];
    if (l.length == 0) continue;

    const s = l.replace(HTML_RE, '').split(/([{}])/);

    let lastName = null;
    for (const p of s) {
      if (p == "{") {
        const m = stack.length > 0 && stack[stack.length - 1].isClass ?
          JS_CLASS_RE.exec(lastName) : JS_TOP_RE.exec(lastName);
        const g = m?.groups;
        const name = g?.cname ?? g?.fname ?? g?.mname;
        stack.push({name: name, start: i, isClass: g?.cname !== undefined });
      } else if (p == "}") {
        if (stack.length == 0) continue;
        const invalid = stack.some(n => n.name === undefined);
        const name = '#' + stack.map(n => n.name).join('#');
        const last = stack.pop();
        if (invalid) continue;
        yield [name, [last.start, i - last.start + 1]];
      } else {
        lastName = p.trim();
      }
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
  const req = out.lensCmd = cmd.lens ?? prev.lensCmd ?? "";
  out.lens = null;

  // reset lens.
  if (req == "") {
    out.lens = null;
    return;
  }

  if (req === "fixed") {
    const o = out.lens = [...prev.lens];
    if (o[0] > out.range[0]) {
      o[0] += out.range[1];
    } else if (out.range[0] >= o[0] && out.range[0] < o[0] + o[1]) {
      o[1] += out.range[2];
    }
    return;
  }

  out.lens = null;
  for (const l of req.split('>')) {
    const t = range(prev, out, l);
    if (out.lens === null) {
      out.lens = [...t];
      continue;
    }
    const start = Math.min(out.lens[0], t[0]);
    const end = Math.max(out.lens[0] + out.lens[1], t[0] + t[1]);
    out.lens[0] = start;
    out.lens[1] = end - start;
  }

  if (out.lensCmd === "this") {
    out.lensCmd = "fixed";
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
    _lang: cmd.lang,   // temp: specified language for code.
    _codegen: false,   // temp: does labels contain auto labels?

    code: null,        // [] of lines of code.
    highlight: [],     // [] of lines to be highlighted.
    labels: {},        // {label: [start, length]} of references.
    lens: null,        // null|[start, length] of lines to show.
    lensCmd: null,     // actual request for lens.
    range: null,       // [start, length, difflength] of current edit.
    focus: new Set(),  // Elements that are mapped to this state.
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
  for (const f of prev.focus) {
    state.focus.add(f);
  }
  determineHighlight(parent, state);
  return state;
}
