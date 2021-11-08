

import * as esbuild from 'https://deno.land/x/esbuild@v0.13.12/mod.js'

function ignoreESP(filters) {
  return {
    name: "ignoreESP",
    setup(build) {
      for (const f of filters) {
        build.onResolve({filter: f}, args => ({
          path: args.path, namespace: 'ignore'
        }));

        build.onLoad({filter: f, namespace: 'ignore'}, n => {
          return { contents: '' };
        });
      }
    }
  }
}

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
        sourcemap: false,
        treeShaking: true,
        legalComments: 'none',
        entryPoints: [path],
        plugins: [ignoreESP([/^\.\/package$/])],
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
