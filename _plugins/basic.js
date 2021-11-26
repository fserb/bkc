import textLoader from "lume/core/loaders/text.ts";

// Make sure that for md files we always run njk first.
class EngineSquence {
  constructor(site, seq) {
    this.engines = [];
    for (const s of seq) {
      this.engines.push(site.renderer.engines.get(`.${s}`));
    }
  }

  async render(content, data, path) {
    for (const e of this.engines) {
      content = await e.render(content, data, path);
    }
    return content;
  }

  addHelper(name, fn, options) {}
}


export default function() {
  return site => {
    site.preprocess([".njk", ".md"], page => {
      // adds {{ rootPath }} that alwaycat bk  s point relative to the root of the site.
      page.data.rootPath =
        page.data.url.split('/')
        .slice(0, -1).filter(x => x).map(_ => '..').join('/') || '.';
      page.data.srcFile = `${page.src.path}${page.src.ext}`;
      page.data.baseURL = site.options.location.toString();
      page.data.relativePath = page.data.url.split('/').slice(1, -1).join('/');
      page.data.dev = site.options.dev;

      // appends .njk on layout
      if (page.data.layout) {
        if (page.data.layout.indexOf('.') == -1) {
          page.data.layout += '.njk';
        }
      } else {
        page.data.layout = "main.njk";
      }
    });

    site.loadPages([".md"], textLoader, new EngineSquence(site, ["njk", "md"]));
  };
}
