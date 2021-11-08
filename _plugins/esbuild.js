
import * as esbuild from 'https://deno.land/x/esbuild@v0.13.12/mod.js'

export default function (options) {
  return site => {
    site.loadAssets([".js"], async path => {
      const {outputFiles, warnings, errors} = await esbuild.build({
        bundle: true,
        format: 'esm',
        minify: true,
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
        entryPoints: [path],
      });
      esbuild.stop();

      for (const e of errors) {
        console.error(e);
      }
      for (const e of warnings) {
        console.warning(e);
      }

      return {content: outputFiles[0].contents};
    });

  };
}
