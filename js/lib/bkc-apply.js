/*
BKC apply

applies and animates a BKC state into the aside DOM.

Highlight dimension: .low
Write dimension: .born .alive .dead
Lens dimension: .hide
*/

import diffCode from "./diff.js";

// this is the line-height em attribute for the `aside li`.
// in theory, we could query this from the stylesheet, but why bother?
const LINE_HEIGHT = 1.1;
const HIDE_ANIMATION = `ease-in forwards lens_hide 0.5s`;
const UNHIDE_ANIMATION = `ease-in forwards lens_show 0.5s`;

// We do this little apply() dance, so we can re-run apply after transitions.
let pending = 0;
let applyState = null;

export function apply(state) {
  applyState = state;
  if (pending == 0) {
    runApply();
  }
}

function scheduleApplyAfter(evname) {
  pending++;
  document.querySelector("aside ol").addEventListener(evname, ev => {
    pending--;
    runApply();
  }, {once: true});
}


function preApplyLens(alives, diff, lens) {
  let inputPos = 0;
  let outputPos = 0;

  const hideState = [];
  let allHidden = true;

  for (const [op, _] of diff) {
    if (inputPos >= alives.length) break;
    if (op == "+") {
      outputPos++;
      continue;
    }

    const hide = outputPos < lens[0] || outputPos >= lens[0] + lens[1];
    hideState.push(hide);
    if (!hide) {
      allHidden = false;
    }
    inputPos++;

    if (op == "=") {
      outputPos++;
    }
  }

  if (allHidden) return false;

  let changed = false;
  for (let i = 0; i < alives.length; ++i) {
    const el = alives[i];
    const hide = hideState[i];
    const isHidden = el.classList.contains("hidden");
    if (hide != isHidden) {
      if (!hide) {
        changed = true;
        el.classList.remove("hidden");
        el.style.animation = UNHIDE_ANIMATION;
      }
    }
  }

  if (changed) return true;

  for (let i = 0; i < alives.length; ++i) {
    const el = alives[i];
    const hide = hideState[i];
    const isHidden = el.classList.contains("hidden");
    if (hide != isHidden) {
      if (hide) {
        changed = true;
        el.classList.add("hidden");
        el.style.animation = HIDE_ANIMATION;
      }
    }
  }

  return changed;
}

function postApplyLens(alives, lens) {
  let changed = false;
  for (let i = 0; i < alives.length; ++i) {
    const el = alives[i];
    const hide = i < lens[0] || i >= lens[0] + lens[1];
    const isHidden = el.classList.contains("hidden");
    if (hide != isHidden) {
      changed = true;
      if (hide) {
        el.classList.add("hidden");
        el.style.animation = HIDE_ANIMATION;
      } else {
        el.classList.remove("hidden");
        el.style.animation = UNHIDE_ANIMATION;
      }
    }
  }
  return changed;
}

function runApply() {
  const state = applyState;
  const highlight = new Set(state.highlight);
  const output = clearLine(state.code.join("\n")).split("\n");

  const aside = document.querySelector("aside ol");
  const alives = [];
  const input = [];
  for (const li of aside.querySelectorAll("li.alive")) {
    input.push(clearLine(li.innerHTML));
    alives.push(li);
  }
  const diff = diffCode(input, output);

  const lens = state.lens ?? [0, output.length];

  if (preApplyLens(alives, diff, lens)) {
    return scheduleApplyAfter("animationend");
  }

  let changed = false;

  let pos = 0;
  let rel = 0;
  let relsub = 0;
  let visible = 0;
  const pendingAlive = [];
  const begin = (alives.length == 0 && lens ? lens[0] : 0) + 1;
  for (const [op, line] of diff) {
    if (op == "-") {
      changed = true;
      const o = alives[pos];
      o.addEventListener("transitionend", () => { o.replaceWith(); },
        {once: true});
      o.classList.add("dead");
      o.classList.remove("alive");
      alives.splice(pos, 1);
      o.style.top = `${LINE_HEIGHT * relsub++}em`;
      rel = 0;
      if (!o.classList.contains("hidden")) visible++;
    } else if (op == "=") {
      if (!alives[pos].classList.contains("hidden")) visible++;
      pos++;
      rel = relsub = 0;
    } else if (op == "+") {
      changed = true;
      const o = document.createElement("li");
      o.classList.add("alive");
      o.innerHTML = output[line];

      if (pos >= lens[0] && pos < lens[0] + lens[1]) {
        o.classList.add("born");
        o.style.top = `${LINE_HEIGHT * (rel++ - begin)}em`;
        pendingAlive.push(o);
       visible++;
      } else {
        o.classList.add("hidden");
      }

      aside.insertBefore(o, alives[pos]);
      alives.splice(pos, 0, o);
      relsub = 0;
      pos++;
    }
  }

  // we need a re-layout before setting .born animation, so we group them
  // into a single place.
  if (pendingAlive.length > 0) {
    pendingAlive[0].getBoundingClientRect();

    for (const o of pendingAlive) {
      o.classList.remove("born");
      o.style.top = "0px";
    }
  }

  // Apply highlight.
  for (let i = 0; i < alives.length; ++i) {
    const o = alives[i];
    if (highlight.has(i)) {
      o.classList.remove("low");
    } else {
      o.classList.add("low");
    }
  }

  if (changed) {
    return scheduleApplyAfter("transitionend");
  }

  postApplyLens(alives, lens);
}

function clearLine(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#x60;', '`');
}

