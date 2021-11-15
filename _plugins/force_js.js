const FUNCTIONS = new Set(["op", "spawn", "label", "lens"]);

export default function() {
  return site => {
    site.process([".html"], page => {
      page.document.querySelectorAll("pre code").forEach(el => {
        for (const c of el.classList) {
          if (!c.startsWith("language-")) continue;

          for (const cmd of c.substr(9).split(',')) {
            const s = cmd.indexOf(':');
            if (s == -1) continue;
            const f = cmd.substr(0, s);
            const r = cmd.substr(s + 1);

            if (!FUNCTIONS.has(f)) continue;

            el.classList.remove(c);
            el.setAttribute(f, r);
          }
        }
        el.classList.add("language-js");
      });
    });
  };
}
