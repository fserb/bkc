/*
BKC apply

applies and animates a BKC state into the aside DOM.
*/

import diff from "./diff.js";

function clearLine(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#x60;', '`');
}

const LINE_HEIGHT = 1.1;

export function apply(state) {
  const aside = document.querySelector("aside ol");

  const high = new Set(state.highlight);
  const output = clearLine(state.code.join("\n")).split("\n");

  const input = [];
  const alives = [];
  for (const li of aside.querySelectorAll("li.alive")) {
    input.push(clearLine(li.innerHTML));
    alives.push(li);
  }

  let pos = 0;
  let rel = 0;
  let relsub = 0;
  const begin = (alives.length == 0 && state.lens ? state.lens[0] : 0) + 1;

  const pendingAlive = [];
  for (const [op, line] of diff(input, output)) {
    if (op == "-") {
      rel = 0;
      const o = alives[pos];
      if (!o) continue;
      o.addEventListener("transitionend", () => {
        o.replaceWith();
      }, {once: true});
      o.classList.add("dead");
      o.classList.remove("alive");
      alives.splice(pos, 1);
      o.style.top = `${LINE_HEIGHT * relsub++}em`;
    } else if (op == "=") {
      const o = alives[pos];
      if (high.has(pos)) {
        o.classList.remove("low");
      } else {
        o.classList.add("low");
      }
      pos++;
      rel = relsub = 0;
    } else if (op == "+") {
      const o = document.createElement("li");
      o.classList.add("alive");
      o.innerHTML = output[line];
      if (high.has(pos)) {
        o.classList.remove("low");
      } else {
        o.classList.add("low");
      }
      o.classList.add("born");
      o.style.top = `${LINE_HEIGHT * (rel++ - begin)}em`;
      aside.insertBefore(o, alives[pos]);
      alives.splice(pos, 0, o);
      pendingAlive.push(o);
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

  // remove all lines that are not supposed to be in the current view.
  let cnt = 0;
  let pass = 0;
  for (let i = 0; i < alives.length; ++i) {
    if (state.lens !== null &&
      (i < state.lens[0] || i >= state.lens[0] + state.lens[1])) {
      if (!alives[i].classList.contains("hidden")) {
        alives[i].classList.add("hidden");
        alives[i].style.top = `${pass++ * LINE_HEIGHT}em`;
        alives[i].addEventListener("transitionend", ev => {
          ev.target.style.display = "none";
        }, {once: true});
      }
    } else {
      if (alives[i].classList.contains("hidden")) {
        alives[i].classList.remove("hidden");
        alives[i].style.display = null;
        alives[i].style.top = "0px";
      }
      if (cnt == 0) {
        alives[i].style.counterSet = `code-line ${i}`;
      }
      cnt++; pass++;
    }
  }
  const h = Math.ceil(cnt * LINE_HEIGHT);
  aside.style.height = `${h}em`;
}
