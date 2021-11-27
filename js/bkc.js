// bkc.js

// import WebComponents.
import "./lib/canvas-demo.js";
import "./lib/color-show.js";

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
import {apply} from "./lib/bkc-apply.js";
import {connectEditor, updateEditorCode} from "./lib/bkc-editor.js";

// contains all BKC states referenced by rulers.
const SYSTEM = [];
let URL;

function resizeRulers() {
  const rulers = document.querySelectorAll("main .ruler");
  for (const el of rulers) {
    el.style.height = "0px";
  }
  for (let i = 0; i < rulers.length; ++i) {
    const el = rulers[i];
    let end = 0;

    if (i < rulers.length - 1) {
      end = rulers[i + 1].offsetTop;
    } else {
      end = document.querySelector("main").scrollHeight;
    }

    el.style.height = `${end - el.offsetTop}px`;
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
      apply(SYSTEM[id]);
      updateEditorCode(SYSTEM[id].code);
    }
  }, {
    rootMargin: '-50% 0% -50% 0%',
  });

  const ro = new ResizeObserver(resizeRulers);

  const main = document.querySelector("main");
  ro.observe(main);

  let state = {code: [], highlight: [], labels: {}, lens: null, range: [0, 0]};

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
    const debug = el.getAttribute('debug') !== null;
    state = buildState(state, {op, label, lens, debug, code: el.innerHTML});

    rebuildPRE(state, el);

    const spawn = Number.parseInt(el.getAttribute('spawn') ?? 1);
    let target = el.parentNode;
    let merged = false;
    for (let i = 0; i < spawn; ++i) {
      const n = target.previousElementSibling;
      if (!n) break;

      // if one of the spawn targets is a `pre code`, merge the state.
      if (n.tagName == 'PRE') {
        if (n.firstElementChild?.tagName == 'CODE') {
          SYSTEM[SYSTEM.length - 1] = mergeState(SYSTEM[SYSTEM.length - 2],
            SYSTEM[SYSTEM.length - 1], state);
          merged = true;
        }
      }

      target = n;
    }
    if (!merged) {
      main.insertBefore(createRuler(io, state), target);
    }
  }

  resizeRulers();
  connectEditor(URL, {
    jsfiddle: document.getElementById("ed_jsfiddle"),
    codepen: document.getElementById("ed_codepen"),
  });
}

function onReady() {
  if (document.readyState !== "complete") return;
  document.removeEventListener("readystatechange", onReady);
  setup();
}

export default function BKC(url) {
  URL = url;
  document.addEventListener("readystatechange", onReady);
}
