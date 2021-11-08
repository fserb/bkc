import lume from "lume/mod.ts";
import relative from "lume/plugins/relative_urls.ts";
import basePath from "lume/plugins/base_path.ts";
import date from "lume/plugins/date.ts";
import slugifyUrls from "lume/plugins/slugify_urls.ts";

import basic from "./_plugins/basic.js";
import esbuild from "./_plugins/esbuild.js";

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
    options: { typographer: true },
  }
});

if (site.options.dev) {
  site.options.location = new URL("https://dev.metaphora.co/bkc/_site");
} else {
  site.options.location = new URL("https://bkc.fserb.com");
}

site.ignore("_images", "_plugins", ".gitignore", ".git", "js/lib");

site.copy("assets", "assets");

// update relative paths to include URL path.
site.use(basePath());
// replace URLs on output page that finish with "/" to use relative path.
site.use(relative());
// register `date` plugin.
site.use(date());
// clean up URLS to ASCII.
site.use(slugifyUrls());

site.use(basic());
site.use(esbuild());

// auto reload
site.addEventListener("afterUpdate", ev => {
  console.log("reload");
  Deno.run({ cmd: ["chrome-reload", "reload"] });
});

export default site;
