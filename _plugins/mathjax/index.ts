import { mathjax } from "mathjax-full/js/mathjax";
import { TeX } from "mathjax-full/js/input/tex";
import { SVG } from "mathjax-full/js/output/svg";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages";
import juice from "juice";

export default function renderMath(content: string, options: any): string {
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({ packages: AllPackages });
  const svg = new SVG({ fontCache: "none" });
  const mathDocument = mathjax.document(content, { InputJax: tex, OutputJax: svg });
  const c = mathDocument.convert(content, options);
  const display = c.attributes.display;
  const target = c.children[0];
  if (display) {
    target.attributes.display = display;
  }
  const html = adaptor.outerHTML(target);
  const stylesheet = adaptor.outerHTML(svg.styleSheet(mathDocument) as any);
  return juice(html+stylesheet)
}
