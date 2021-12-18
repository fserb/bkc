/*
BKC apply

applies and animates a BKC state into the aside DOM.

Highlight dimension: .low
Write dimension: .born .alive .dead
Lens dimension: .hide .spacer
*/

import diffCode from "./diff.js";

// this is the line-height em attribute for the `aside li`.
// in theory, we could query this from the stylesheet, but why bother?
const LINE_HEIGHT_EM = 1.1;

// We do this little apply() dance, so we can re-run apply after transitions.
let pending = 0;
let applyState = null;
let lastScrollPosition = Infinity;

export function apply(state) {
  applyState = state;
  lastScrollPosition = Infinity;
  if (pending == 0) {
    runApply();
  }
}

function scheduleApplyAfter(evname = null, delay = 0) {
  pending++;
  const cb = () => {
    setTimeout(() => {
      pending--;
      runApply();
    }, delay * 1000);
  };

  if (evname === null) {
    requestAnimationFrame(cb);
  } else {
    document.querySelector("aside ol").addEventListener(
      evname, cb, {once: true, passive: true});
  }
}

function applyFocus(lens, quick) {
  const aside = document.querySelector("aside");
  if (lastScrollPosition !== Infinity) {
    const lsp = lastScrollPosition;
    lastScrollPosition = aside.scrollTop;
    if (lsp == aside.scrollTop) {
      return false;
    }
    return true;
  }

  const lineHeight =
    parseFloat(window.getComputedStyle(aside).fontSize) * LINE_HEIGHT_EM;
  const viewportHeight = parseFloat(window.getComputedStyle(aside).height);

  let minLens = 1e9;
  let maxLens = 0;
  for (const l of lens) {
    minLens = Math.min(l[0], minLens);
    maxLens = Math.max(l[0] + l[1] - 1, maxLens);
  }
  const lensFocus = (minLens + maxLens) / 2;

  const s = viewportHeight / 2 + (lensFocus + 0.5) * lineHeight;

  aside.scrollTo({top: s, left: 0, behavior: quick ? "auto" : "smooth"});

  // If we tried to scroll past the height of the content, we let apply finish,
  // but we book a second one after, to redo the scrolling.
  // The reason we remove viewportHeight, is that the content includes a padding
  // of viewportHeight on top and on the bottom. As long as we have enough
  // content to fill half of the screen with this scroll, we are good.
  // This is a bit scary, as it may lead to an infinite loop if the lens area is
  // half viewport bigger than the content.
  if (s > aside.scrollHeight - viewportHeight * 3 / 2) {
    scheduleApplyAfter();
    return false;
  }

  lastScrollPosition = aside.scrollTop;

  // if the scroll will keep us at the same screen area, we don't block until
  // the scrolling is over. This has a potential problem: the next call to
  // applyFocus() will block. But at point, we hope the new lines have already
  // been added.
  const delta = Math.abs(s - lastScrollPosition);
  return delta > viewportHeight / 4;
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
  aside.parentNode.classList.remove("scrolled");

  const lens = state.lens ?? [[0, output.length]];
  if (applyFocus(lens, aside.children.length == 0)) {
    return scheduleApplyAfter();
  }

  const alives = [];
  const input = [];
  for (const li of aside.querySelectorAll("li.alive")) {
    input.push(clearLine(li.innerHTML));
    alives.push(li);
  }
  const diff = diffCode(input, output);

  let changed = false;

  // Pre-apply outlens highlight. We have to go through diff, to map lens to
  // the old code.
  let l = 0;
  for (const [op, line] of diff) {
    if (op == "+") {
      l++;
      continue;
    }

    const o = alives[line];
    if (changeClass(o, "outlens", lensMatch(lens, l) === null)) {
      changed = true;
    }
    if (changeClass(o, "low", !highlight.has(l))) {
      changed = true;
    }

    if (op == "=") l++;
  }

  if (changed) {
    return scheduleApplyAfter(null, 0.5);
  }

  let pos = 0;
  let rel = 0;
  let relsub = 0;
  const pendingAlive = [];
  for (const [op, line] of diff) {
    if (op == "-") {
      changed = true;
      const o = alives[pos];
      o.addEventListener("transitionend", () => { o.replaceWith(); },
        {once: true, passive: true});
      o.classList.add("dead");
      o.classList.remove("alive");
      alives.splice(pos, 1);
      o.style.top = `${LINE_HEIGHT_EM * relsub++}em`;
      rel = 0;
    } else if (op == "=") {
      pos++;
      rel = relsub = 0;
    } else if (op == "+") {
      changed = true;
      const o = document.createElement("li");
      o.classList.add("alive");
      o.innerHTML = output[line];

      o.classList.add("born");
      o.style.top = `${LINE_HEIGHT_EM * (rel++ - 1)}em`;
      pendingAlive.push(o);

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
    changeClass(o, "low", !highlight.has(i));
    changeClass(o, "outlens", !lensMatch(lens, i));
  }
}

export function setupScroll() {
  const aside = document.querySelector("aside");
  const cb = () => {
    aside.classList.add("scrolled");
  };
  for (const evname of ["wheel", "mousedown", "wheel", "keyup"]) {
    aside.addEventListener(evname, cb, {passive: true});
  }
}

export function clearLine(s) {
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

function changeClass(obj, className, want) {
  const has = obj.classList.contains(className);
  if (want === has) return false;
  if (want) {
    obj.classList.add(className);
  } else {
    obj.classList.remove(className);
  }
  return true;
}

