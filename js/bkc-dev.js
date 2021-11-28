// bkc-dev.js

const CSS_STYLE = `
#bkcdev {
  width: 600px;
  height: calc(100vh - 50px);
  position: fixed;
  background-color: #181923;
  top: 25px;
  right: 5px;
  border-radius: 10px;
  border: 1px outset #F4EFE7;
  box-shadow: 4px 4px 10px rgba(40,40,40,0.6);
  display: grid;
  gap: 0px 0px;
  grid-template-rows: 1fr;
  grid-template-areas: "code";
  color: #EEE;
  font-family: 'Inconsolata', monospace;
  font-size: 10px;
  line-height: 11px;
  white-space: pre;
  z-index: 20000;
}

#bkcdev #code {
  padding: 1em 0;
  border-radius: 10px;
  background-color: #181923;
  grid-area: code;
  margin: 0;
  counter-reset: code-line;
  list-style: none;
  overflow-x: auto;
  overflow-y: scroll;
  position: relative;
}

#bkcdev #code li:before {
  counter-increment: code-line;
  content: counter(code-line);
  color: #3A3F58;
  width: 4ch;
  display: inline-block;
  text-align: right;
  margin: 0 1ch 0 60px;
  transition: all 0s ease-in-out 0.5s;
  opacity: 1.0;
  user-select: none;
}

#bkcdev #code li.low {
  filter: opacity(0.75) contrast(0.25);
}

#bkcdev #labels {
  width: 100px;
  min-height: 100px;
  position: absolute;
}

#bkcdev #labels div {
  position: absolute;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: scale(-1);
  color: #F4EFE7;
  border-top: 1px solid #F4EFE7;
  border-bottom: 1px solid #F4EFE7;
  border-right: 1px solid #F4EFE7;
  padding: 0;
  font-size: 13px;
  display: flex;
  justify-content: center;
}

#bkcdev #labels div.pair {
  opacity: 0.4;
}

#bkcdev #labels div.lens {
  border-color: #C00;
}

#bkcdev #labels div span {
  margin-right: -15px;
}

`;

const LINE_HEIGHT = 11;

let currentState = -1;
function buildDev(system) {
  system.id = system.id ?? 0;
  if (currentState == system.id) return;
  currentState = system.id;

  let pop = document.querySelector("#bkcdev");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "bkcdev";
    document.querySelector("main").appendChild(pop);
  } else {
    pop.innerHTML = "";
  }

  const ol = document.createElement("ol");
  ol.id = "code";
  pop.appendChild(ol);

  const labels = document.createElement("div");
  labels.id = "labels";
  ol.insertBefore(labels, ol.firstElementChild);

  const state = system[system.id];
  let first = null;
  const highlight = new Set(state.highlight);
  for (let i = 0; i < state.code.length; ++i) {
    const el = document.createElement("li");
    el.innerHTML = state.code[i];
    if (!highlight.has(i)) {
      el.classList.add("low");
    } else {
      if (first === null) {
        first = el;
      }
    }
    ol.appendChild(el);
  }
  if (first) {
    setTimeout(() => {
      first.scrollIntoView({block: "center"});
    }, 0);
  }

  let pair = false;

  const keys = Object.keys(state.labels);
  keys.sort((a, b) => state.labels[a][0] - state.labels[b][0]);

  const stacked = [];

  for (const label of keys) {
    const range = state.labels[label];
    const l = document.createElement("div");
    const t = document.createElement("span");
    t.innerText = label;
    l.appendChild(t);

    stacked.filterIn(e => e[0] + e[1] > range[0]);
    const stack = stacked.length;
    const m = 2 + stack + (pair ? 1 : -1);

    l.style.top = `${LINE_HEIGHT * range[0] + m}px`;
    l.style.height = `${LINE_HEIGHT * range[1] - 2 * m}px`;

    if (pair) {
      l.classList.add("pair");
    }
    pair = !pair;

    const p = 55 - stack * 18;

    // console.log(label, range, stack, p);

    l.style.left = `${p}px`;
    l.style.width = `${60 - p}px`;

    labels.appendChild(l);

    stacked.push(range);
  }

  if (state.lens) {
    for (const range of state.lens) {
      const l = document.createElement("div");
      const t = document.createElement("span");
      l.appendChild(t);
      const m = 2;
      l.style.top = `${LINE_HEIGHT * range[0] + m}px`;
      l.style.height = `${LINE_HEIGHT * range[1] - 2 * m}px`;
      l.classList.add("lens");
      l.style.left = `10px`;
      l.style.width = `10px`;
      labels.appendChild(l);
    }
  }
}

export default function BKCdev(system) {
  const style = document.createElement('style');
  document.head.append(style);
  style.textContent = CSS_STYLE;

  window.addEventListener("keypress", ev => {
    if (ev.key != "/") return;

    const pop = document.querySelector("#bkcdev");
    if (!!pop) {
      pop.replaceWith();
      currentState = -1;
    } else {
      buildDev(system);
    }
  }, {passive: true});

  const io = new IntersectionObserver(entries => {
    setTimeout(() => {
      const pop = document.querySelector("#bkcdev");
      if (pop) buildDev(system);
    }, 0);
  }, {
    rootMargin: '-50% 0% -50% 0%',
  });

  function onReady() {
    if (document.readyState !== "complete") return;
    document.removeEventListener("readystatechange", onReady);

    for (const r of document.querySelectorAll("main .ruler")) {
      r.style.opacity = "0.1";
      io.observe(r);
    }

    if (document.location.hash == "#dev") {
      buildDev(system);
    }
  }
  document.addEventListener("readystatechange", onReady);
}
