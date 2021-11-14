import prismjs from "https://esm.sh/prismjs";

export default function (options) {
  const built = new Set();

  return site => {
    site.process([".html"], page => {
      page.document.querySelectorAll("pre code")
        .forEach((element) => prismjs.highlightElement(element));
    });
  };
}
