// bkc.js

import "./extend.js";

// import WebComponents.
import "./lib/canvas-demo.js";
import "./lib/color-show.js";

import fuzzy from "./lib/fuzzy.js";

/*
BKC is split in 4 parts:

bkc.js - read/write DOM elements (canvas-demo, PRE CODE, rulers), keep all
states.

bkc-builder.js - given the previous state and a command (ops + code) generate a
new state. All this code happens at start up time, as we read the page.

bkc-apply.js - given a current selected state and the current ASIDE, render the
new ASIDE. This happens at scroll time.

bkc-editor.js - open current code in different web editors.
*/
import {buildState, rebuildPRE, mergeState} from "./lib/bkc-builder.js";
import {clearLine, apply} from "./lib/bkc-apply.js";
import {connectEditor, updateEditorCode} from "./lib/bkc-editor.js";

const VALID_KEYS = ["add", "sub", "lens", "label", "debug", "spawn"];

// contains all BKC states referenced by rulers.
export const SYSTEM = [];

let lastScroll = 0;

function keypress(ev) {
  let selector;
  let down;

  const t = performance.now();
  const behavior = t - lastScroll < 500 ? "auto" : "smooth";
  lastScroll = t;

  if (ev.key == "j" || ev.key == "k") {
    selector = "main p";
    down = ev.key == "j";
  } else if (ev.key == "n" || ev.key == "p") {
    selector = "canvas-demo";
    down = ev.key == "n";
  } else if (ev.key == "J" || ev.key == "K") {
    selector = "main h3";
    down = ev.key == "J";
  } else if (ev.key == "N") {
    window.scrollTo({top: document.body.scrollHeight, behavior});
    return;
  } else if (ev.key == "P") {
    window.scrollTo({top: 0, behavior});
    return;
  }

  const center = window.scrollY + window.innerHeight / 2;

  let prev = null;
  let next = null;
  let passed = false;
  for (const el of document.querySelectorAll(selector)) {
    const top = el.offsetTop;
    const bottom = el.offsetTop + el.offsetHeight;
    if (passed) {
      next = el;
      break;
    }

    if (center < bottom) {
      passed = true;
    }

    if (center >= bottom) {
      prev = el;
    } else if (center <= top) {
      next = el;
    }
  }

  const target = down ? next : prev;
  if (target === null) {
    return;
  }

  target.scrollIntoView({behavior, block: "center"});
}

function resizeRulers() {
  const rulers = document.querySelectorAll("main .ruler");
  for (const el of rulers) {
    el.style.height = "0px";
  }

  const stack = [];

  for (let i = 0; i < rulers.length; ++i) {
    const el = rulers[i];
    let end = 0;

    if (i < rulers.length - 1) {
      end = rulers[i + 1].offsetTop;
    } else {
      end = document.querySelector("main").scrollHeight;
    }

    const height = end - el.offsetTop;

    if (height == 0) {
      stack.push(el);
      continue;
    }

    if (stack.length == 0) {
      el.style.height = `${height}px`;
      continue;
    }

    stack.push(el);

    const fs = [];
    let total = 0;
    const lineHeight = parseFloat(getComputedStyle(document.body).lineHeight);
    for (const r of stack) {
      const s = SYSTEM[Number.parseInt(r.getAttribute('bkc-state'))];
      let h = 0;
      for (const f of s.focus) {
        h += f.offsetHeight;
      }
      fs.push(h);
      total += h;
    }

    let base = 0;
    for (let j = 0; j < stack.length; ++j) {
      const h = height * fs[j] / total;
      if (h < lineHeight) {
        base = lineHeight;
        break;
      }
    }

    const diff = height - base * stack.length;

    for (let j = 0; j < stack.length; ++j) {
      const h = base + diff * fs[j] / total;
      stack[j].style.height = `${h}px`;
    }
    stack.length = 0;
  }
}

function createRuler(io, state) {
  const ruler = document.createElement("div");
  ruler.classList.add("ruler");
  SYSTEM.push(state);
  ruler.setAttribute('bkc-state', SYSTEM.length - 1);

  io.observe(ruler);
  return ruler;
}

function setup() {
  const io = new IntersectionObserver(entries => {

    for (const e of entries) {
      if (!e.isIntersecting) continue;

      const id = Number.parseInt(e.target.getAttribute('bkc-state'));
      SYSTEM.id = id;
      apply(SYSTEM[id]);
      updateEditorCode(SYSTEM[id].code);

      for (const el of document.querySelectorAll("main .focused")) {
        el.classList.remove("focused");
      }
      for (const el of SYSTEM[id].focus) {
        el.classList.add("focused");
      }
    }
  }, {
    rootMargin: '-50% 0% -50% 0%',
  });

  const ro = new ResizeObserver(resizeRulers);

  const main = document.querySelector("main");
  ro.observe(main);

  let state = {code: [], highlight: [], labels: {}, lens: null, range: [0, 0],
    focus: new Set()};

  main.insertBefore(createRuler(io, state), main.firstElementChild);

  for (const el of document.querySelectorAll("main pre code, canvas-demo")) {
    if (el.tagName == "CANVAS-DEMO") {
      el.code = clearLine(state.code.join('\n').replace(/<[^>]+>/gm, ''));
      el.reRender();
      continue;
    }

    if (el.tagName != "CODE") continue;
    const cmd = {code: el.innerHTML};
    for (const k of VALID_KEYS) {
      cmd[k] = el.getAttribute(k);
    }
    const langstr = /\blanguage-(.+?)\b/.exec(el.classList.value);
    cmd.lang = langstr !== null ? langstr[1] : null;

    state = buildState(state, cmd);

    rebuildPRE(state, el);

    // Do merge.
    const spawn = Number.parseInt(el.getAttribute('spawn') ?? 1);

    let target = el.parentNode;
    let mergingCode = true;
    let needNewRuler = true;

    const mergeBlocks = [];
    let mergedCode = false;

    for (let i = 0; i < spawn; ++i) {
      const n = target.previousElementSibling;
      if (!n) break;
      target = n;

      if (mergingCode) {
        if (n.tagName == 'PRE' && n.firstElementChild?.tagName == 'CODE') {
          SYSTEM[SYSTEM.length - 1] = mergeState(SYSTEM[SYSTEM.length - 2],
            SYSTEM[SYSTEM.length - 1], state);
          needNewRuler = false;
          continue;
        }
        mergingCode = false;
      }

      if (n.tagName == "PRE") mergedCode = true;
      mergeBlocks.push(n);

      // We don't count the rulers we add as part of the spawn, but we still
      // add them, so we can group them below.
      if (n.classList.contains("ruler")) i--;
    }

    if (mergedCode) {
      const placement = mergeBlocks[0].nextElementSibling;
      mergeBlocks.reverse();

      target = mergeBlocks[0];
      for (const m of mergeBlocks) {
        if (m.classList.contains("ruler")) {
          main.insertBefore(m, target);
        }
      }

      const g = document.createElement("div");
      for (const m of mergeBlocks) {
        if (!m.classList.contains("ruler")) {
          g.appendChild(m);
        }
      }
      g.classList.add("merged");
      main.insertBefore(g, placement);
      target = g;
      mergeBlocks.reverse();
    }

    state.focus = new Set();
    for (const n of mergeBlocks) {
      if (n.tagName == "PRE" || n.classList.contains("ruler")) break;
      state.focus.add(n);
    }

    if (needNewRuler) {
      main.insertBefore(createRuler(io, state), target);
    }
  }

  fuzzy._cache.clear();

  connectEditor(document.head.baseURI, {
    jsfiddle: document.getElementById("ed_jsfiddle"),
    codepen: document.getElementById("ed_codepen"),
  });

  addEventListener("keypress", keypress);
}

function onReady() {
  if (document.readyState !== "complete") return;
  document.removeEventListener("readystatechange", onReady);
  setup();
}

export function BKC() {
  document.addEventListener("readystatechange", onReady);
}
