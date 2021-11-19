// bkc.js

// import WebComponents.
import "./lib/canvas-demo.js";
import "./lib/color-show.js";

import {buildState, rebuildPRE} from "./lib/bkc-builder.js";
import {apply} from "./lib/bkc-apply.js";

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
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      apply(JSON.parse(e.target.getAttribute('bkc-state')));
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
    state = buildState(state, {op, label, lens, code: el.innerHTML});

    rebuildPRE(state, el);

    const spawn = Number.parseInt(el.getAttribute('spawn') ?? 1);
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
