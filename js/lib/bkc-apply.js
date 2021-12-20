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
let applyState = null;
let lastState = null;

export function apply(state = null) {
  const mustStart = applyState == null || applyState.pending == 0;

  prepareApply(state ?? lastState.state);

  if (mustStart) {
    runApply();
  }
}

function prepareApply(state) {
  lastState = applyState = {
    state,
    aside: document.querySelector("aside"),
    ol: document.querySelector("aside ol"),
    highlight: new Set(state.highlight),
    output: clearLine(state.code.join("\n")).split("\n"),
    alives: [],
    input: [],

    // state
    pending: applyState?.pending ?? 0,
    hasMerged: false,
    hasScrolled: false,
    hasPreHighlight: false,
    lastScrollPosition: Infinity,

  };

  for (const li of applyState.ol.querySelectorAll("li.alive")) {
    applyState.input.push(clearLine(li.innerHTML));
    applyState.alives.push(li);
  }

  applyState.diff = diffCode(applyState.input, applyState.output);
}

function scheduleApplyAfter(evname = null, delay = 0) {
  if (applyState.pending > 0) return;

  applyState.pending++;
  const cbNow = () => {
    applyState.pending--;
    runApply();
  };

  const cb = () => setTimeout(cbNow, delay * 1000);

  if (evname === null) {
    requestAnimationFrame(delay == 0 ? cbNow : cb);
  } else {
    applyState.ol.addEventListener(evname, cb, {once: true, passive: true});
  }
}

function waitForScroll() {
  const lsp = applyState.lastScrollPosition;
  applyState.lastScrollPosition = applyState.aside.scrollTop;
  return lsp != applyState.lastScrollPosition;
}

function scrollToFocus() {
  if (applyState.hasScrolled) {
    return false;
  }
  if (applyState.state.lens === null && applyState.aside.scrollTop !== 0) {
    applyState.hasScrolled = true;
    return false;
  }

  const lens = applyState.state.lens ?? [0, applyState.state.code.length];

  const quick = (applyState.ol.children.length == 0);
  const aside = applyState.aside;

  const lineHeight =
    parseFloat(window.getComputedStyle(aside).fontSize) * LINE_HEIGHT_EM;
  const viewportHeight = parseFloat(window.getComputedStyle(aside).height);

  const lensFocus = lens[0] + lens[1] / 2;
  const s = (lensFocus + 0.5) * lineHeight;

  aside.scrollTo({top: s, left: 0, behavior: quick ? "auto" : "smooth"});

  // If we tried to scroll past the height of the content, let's allow merge to
  // execute and then redo the scrolling after.
  // The reason we remove viewportHeight, is that the content includes a padding
  // of viewportHeight/2 on top and on the bottom.

  // There's a chance that even after merge we don't have enough scrolling to
  // get to where we want. So we only do this when merging hasn't happened yet.
  if (s > aside.scrollHeight - viewportHeight) {
    return false;
  }

  applyState.hasScrolled = true;

  // if the scroll will keep us at the same screen area, we don't block until
  // the scrolling is over.
  const delta = Math.abs(s - applyState.aside.scrollTop);
  return delta > viewportHeight / 8;
}

function mergeCode() {
  if (applyState.hasMerged) return false;
  applyState.hasMerged = true;

  let changed = false;
  let pos = 0;
  let rel = 0;
  let relsub = 0;
  for (const [op, line] of applyState.diff) {
    if (op == "-") {
      changed = true;
      const o = applyState.alives[pos];
      o.addEventListener("transitionend", () => { o.replaceWith(); },
        {once: true, passive: true});
      o.classList.add("dead");
      o.classList.remove("alive");
      applyState.alives.splice(pos, 1);
      o.style.top = `${LINE_HEIGHT_EM * relsub++}em`;
      rel = 0;
    } else if (op == "=") {
      pos++;
      rel = relsub = 0;
    } else if (op == "+") {
      changed = true;
      const o = document.createElement("li");
      o.classList.add("alive");
      o.innerHTML = applyState.output[line];

      o.classList.add("born");
      o.style.top = `${LINE_HEIGHT_EM * (rel++ - 1)}em`;

      applyState.ol.insertBefore(o, applyState.alives[pos]);
      applyState.alives.splice(pos, 0, o);
      relsub = 0;
      pos++;
    }
  }
  return changed;
}

function showPendingAlive() {
  const pending = applyState.ol.querySelectorAll("li.born");

  if (pending.length == 0) return false;

  // we need a re-layout before setting .born animation, so we group them into a
  // single place. In theory, we could do this as an animation and not do this.
  // In practice, it's a bit hard to set up a proper animation.
  pending[0].getBoundingClientRect();

  for (const o of pending) {
    o.classList.remove("born");
    o.style.top = "0px";
  }

  return true;
}

/*
pre-Highlight set up the lines for merging: everything outside lens is dark,
everything inside lens is low (it's always the old code).
*/
function applyPreHighlight() {
  if (applyState.hasPreHighlight) return false;
  applyState.hasPreHighlight = true;

  applyState.aside.classList.remove("scrolled");

  let changed = false;
  let l = 0;
  for (const [op, line] of applyState.diff) {
    if (op == "+") {
      l++;
      continue;
    }

    const o = applyState.alives[line];
    if (changeClass(o, "outlens", !lensMatch(l))) {
      changed = true;
    }
    if (changeClass(o, "low", true)) {
      changed = true;
    }
    if (op == "=") l++;
  }
  return changed;
}

/*
Highlight applies the final highlight: lens and low/high.
*/
function applyHighlight() {
  for (let i = 0; i < applyState.alives.length; ++i) {
    const o = applyState.alives[i];
    changeClass(o, "low", !applyState.highlight.has(i));
    changeClass(o, "outlens", !lensMatch(i));
  }
}

// Every time runApply() does any DOM animation, we can leave the function and
// reschedule apply to re-run after the animation is over. This has two effects:
// it allows CSS animations in sequence, AND it allows us to "give up" on a
// certain animation and move to the next state.
function runApply() {
  if (waitForScroll()) {
    return scheduleApplyAfter();
  }

  applyPreHighlight();

  if (scrollToFocus()) {
    return scheduleApplyAfter(null, 0.5);
  }

  mergeCode();

  if (waitForScroll()) {
    return scheduleApplyAfter();
  }

  showPendingAlive();

  // In the case we added code before scrolling, let's go back and do the
  // scroll.
  if (!applyState.hasScrolled) {
    return scheduleApplyAfter();
  }

  applyHighlight();

  // If we reached the end, there's nothing pending and we can clean up.
  applyState = null;
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

function lensMatch(pos) {
  if (applyState.state.lens === null) return true;

  const l = applyState.state.lens;
  if (pos >= l[0] && pos < l[0] + l[1]) {
    return true;
  }
  return false;
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

