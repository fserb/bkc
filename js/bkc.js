// bkc.js

// import WebComponents.
import "./lib/canvas-demo.js";
import "./lib/color-show.js";

import {builder} from "./lib/bkc-builder.js";
import {apply} from "./lib/bkc-apply.js";

function setup() {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      apply(JSON.parse(e.target.getAttribute('bkc-state')));
    }
  }, {
    rootMargin: '-50% 0% -50% 0%',
  });
  builder(io);
}

function onReady() {
  if (document.readyState !== "complete") return;
  document.removeEventListener("readystatechange", onReady);
  setup();
}

export default function BKC() {
  document.addEventListener("readystatechange", onReady);
}
