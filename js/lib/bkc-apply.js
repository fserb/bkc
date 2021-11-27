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
  document.querySelector("aside ol").addEventListener(evname, () => {
    pending--;
    runApply();
  }, {once: true});
}

function preApplyLens(alives, diff, lens) {
  const hideState = [];
  let allHidden = true;
  let inputPos = 0;
  let outputPos = 0;
  for (const [op, _] of diff) {
    if (inputPos >= alives.length) break;
    if (op == "+") {
      outputPos++;
      continue;
    }

    const hide = lensMatch(lens, outputPos) === null;
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
    if (!hide && isHidden) {
      changed = true;
      el.classList.remove("hidden");
      el.style.animation = UNHIDE_ANIMATION;
    }
  }

  const lbs = lensBorderSet(lens);
  for (let i = 0; i < alives.length; ++i) {
    const el = alives[i];
    if (lbs.has(i)) {
      el.classList.add("spacer");
    } else {
      el.classList.remove("spacer");
    }
  }

  if (changed) return true;

  for (let i = 0; i < alives.length; ++i) {
    const el = alives[i];
    const hide = hideState[i];
    const isHidden = el.classList.contains("hidden");
    if (hide && !isHidden) {
      changed = true;
      el.classList.add("hidden");
      el.style.animation = HIDE_ANIMATION;
    }
  }

  return changed;
}

function postApplyLens(alives, lens) {
  let changed = false;
  for (let i = 0; i < alives.length; ++i) {
    const el = alives[i];
    const hide = lensMatch(lens, i) === null;
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

// Every time runApply() does any DOM animation, we can leave the function and
// reschedule apply to re-run after the animation is over. This has two effects:
// it allows CSS animations in sequence, AND it allows us to "give up" on a
// certain animation and move to the next state.
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

  const lens = state.lens ?? [[0, output.length]];

  // we try to apply lens before editing. If this would lead to an empty area,
  // we give up and let postApplyLens do the actual lensing.
  if (preApplyLens(alives, diff, lens)) {
    return scheduleApplyAfter("animationend");
  }

  let changed = false;
  let pos = 0;
  let rel = 0;
  let relsub = 0;
  const pendingAlive = [];
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
    } else if (op == "=") {
      pos++;
      rel = relsub = 0;
    } else if (op == "+") {
      changed = true;
      const o = document.createElement("li");
      o.classList.add("alive");
      o.innerHTML = output[line];

      const ln = lensMatch(lens, pos);
      if (ln !== null) {
        const begin = (alives.length == 0 ? ln[0] : 0) + 1;
        o.classList.add("born");
        o.style.top = `${LINE_HEIGHT * (rel++ - begin)}em`;
        pendingAlive.push(o);
      } else {
        o.classList.add("hidden");
      }

      aside.insertBefore(o, alives[pos]);
      alives.splice(pos, 0, o);
      relsub = 0;
      pos++;
    }
  }

  // we need a re-layout before setting .born animation, so we group them into a
  // single place. In theory, we could do this as an animation and not do this.
  // In practice, it's a bit hard to set up a proper animation for this.
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

  // After all animations have passed, we force-apply the lens. This catches the
  // case where we didn't apply lens initially, because it would lead to an
  // empty list.
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

function lensMatch(lens, pos) {
  for (const d of lens) {
    if (pos >= d[0] && pos < d[0] + d[1]) {
      return d;
    }
  }
  return null;
}

function lensBorderSet(lens) {
  const ret = new Set();
  if (lens.length == 1) return ret;

  const start = new Set();
  let last = 0;
  for (const d of lens) {
    start.add(d[0]);
    last = Math.max(last, d[0] + d[1]);
  }
  for (const d of lens) {
    const e = d[0] + d[1];
    if (!start.has(e) && last != e) {
      ret.add(e - 1);
    }
  }
  return ret;
}
