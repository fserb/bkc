import { posix } from "https://deno.land/std@0.113.0/path/mod.ts";

export function url(page) {
  let path = page.dest.path.replace(/^\/pages\//, '/');

  const sp = path.split("/");

  if (sp.length >= 2) {
    if (sp[sp.length - 1] == sp[sp.length - 2]) {
      sp[sp.length - 1] = "index";
      path = sp.join("/");
    }
  }

  page.dest.path = path;
}
