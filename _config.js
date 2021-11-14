
import lume from "lume/mod.ts";
import date from "lume/plugins/date.ts";
import slugifyUrls from "lume/plugins/slugify_urls.ts";
import binaryLoader from "lume/core/loaders/binary.ts";

import markdownItKatex from
  "https://jspm.dev/@iktakahiro/markdown-it-katex@4.0.1";

import basic from "./_plugins/basic.js";
import esbuild from "./_plugins/esbuild.js";
import prism from "./_plugins/prism.js";
import forceJs from "./_plugins/force_js.js";

import markdownItComponent from
  "./_plugins/markdown-it-component.js";

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
    plugins: [
      markdownItKatex,
      markdownItComponent(),
    ]
  }
});

if (site.options.dev) {
  site.options.location = new URL("https://dev.metaphora.co/bkc/_site/");
} else {
  site.options.location = new URL("https://canvas.rocks/");
}

site.ignore("_images", "_plugins", "orig", "3rdp", ".gitignore", ".git",
  "js/lib", "README.md");

site.copy("assets", "assets");
site.loadAssets([".html"]);
site.loadAssets([".png"], binaryLoader);

// register `date` primitive on NJK.
site.use(date());
// clean up URLS to ASCII only.
site.use(slugifyUrls());

site.use(forceJs());
site.use(prism());

site.use(basic());
site.use(esbuild());

// auto reload

const hasReload = (await Deno.run({ cmd: ["which", "chrome-reload"],
  stdout: "null", stderr: "null" }).status()).success;
if (hasReload) {
  console.log("has reload");
  site.addEventListener("afterUpdate", ev => {
    console.log("reload");
    Deno.run({ cmd: ["chrome-reload", "reload"] });
  });
}

export default site;
