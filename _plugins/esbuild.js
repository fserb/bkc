
import * as esbuild from 'https://deno.land/x/esbuild@v0.13.12/mod.js'
import * as path from "https://deno.land/std@0.113.0/path/mod.ts";

export default function(_options) {
  return site => {
    site.loadAssets([".js"]);

    site.addEventListener("beforeSave", ev => {
      esbuild.stop();
    });

    site.process([".js"], async page => {
      const name = `${page.src.path}${page.src.ext}`;
      const filename = path.relative(site.src(), path.join(site.src(), name));

      console.log("📦", name);

      try {
        const {outputFiles, warnings, errors} = await esbuild.build({
          bundle: true,
          format: 'esm',
          minify: !site.options.dev,
          keepNames: true,
          platform: 'browser',
          target: 'esnext',
          banner: {
            js: `// source code available at https://github.com/fserb/bkc
  `},
          write: false,
          incremental: false,
          watch: false,
          metafile: false,
          sourcemap: site.options.dev ? "inline" : false,
          treeShaking: true,
          legalComments: 'none',
          entryPoints: [filename],
        });
        for (const e of errors) {
          console.warn("esbuild error", e);
        }
        for (const e of warnings) {
          console.warn("esbuild warning", e);
        }

        page.content = outputFiles[0].contents;
      } catch (e) {
        console.warn('esbuild throw', e);
      }
    });
  };
}
