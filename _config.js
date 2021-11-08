import lume from "lume/mod.ts";
import relative from "lume/plugins/relative_urls.ts";
import basePath from "lume/plugins/base_path.ts";
import date from "lume/plugins/date.ts";
import slugifyUrls from "lume/plugins/slugify_urls.ts";
import codeHighlight from "lume/plugins/code_highlight.ts";
import binaryLoader from "lume/core/loaders/binary.ts";

import markdownItKatex from
  "https://jspm.dev/@iktakahiro/markdown-it-katex@4.0.1";

import basic from "./_plugins/basic.js";
import esbuild from "./_plugins/esbuild.js";
import forceJs from "./_plugins/force_js.js";

const site = lume({
  watcher: {
    debounce: 0,
  }
}, {
  verbose: 2,
  nunjucks: {
  options: {
      autoescape: false,
    },
    plugins: {
    },
  },
  markdown: {
    options: {
      typographer: true,
    },
    plugins: [markdownItKatex],
  }
});

if (site.options.dev) {
  site.options.location = new URL("https://dev.metaphora.co/bkc/_site");
} else {
  site.options.location = new URL("https://bkc.fserb.com");
}

site.ignore("_images", "_plugins", ".gitignore", ".git", "js/lib");

site.copy("assets", "assets");
site.loadAssets([".html"]);
site.loadAssets([".png"], binaryLoader);

// update relative paths to include URL path.
site.use(basePath());
// replace URLs on output page that finish with "/" to use relative path.
site.use(relative());
// register `date` plugin.
site.use(date());
// clean up URLS to ASCII.
site.use(slugifyUrls());

site.use(forceJs());
site.use(codeHighlight());

site.use(basic());
site.use(esbuild());

// auto reload
site.addEventListener("afterUpdate", ev => {
  console.log("reload");
  Deno.run({ cmd: ["chrome-reload", "reload"] });
});

export default site;
