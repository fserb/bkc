import renderMath from "../mathjax/mathjax.js";
import svgo from "https://unpkg.com/svgo@2.8.0/dist/svgo.browser.js";

export default class SVG {
  base = SVG
  constructor(base = {}, opts = {}) {
    this.children = [];
    this.options = {...base, ...opts};

    this.tag = this.options.tag ?? "svg";
    delete this.options.tag;

    if (this.tag == "svg") {
      this.options['xmlns'] = "http://www.w3.org/2000/svg";
      this.options['xmlns:xlink'] = "http://www.w3.org/1999/xlink";
    }
  }

  _add(child) {
    this.children.push(child);
    return this;
  }

  _newChild(base = {}, opts = {}) {
    const c = new this.base(base, opts);
    this.children.push(c);
    return c;
  }

  circle(cx, cy, r, opts) {
    this._newChild({tag: "circle", cx, cy, r}, opts);
    return this;
  }
  c = this.circle

  ellipse(cx, cy, rx, ry, opts) {
    this._newChild({tag: "ellipse", cx, cy, rx, ry}, opts);
    return this;
  }
  e = this.ellipse

  rect(x, y, width, height, opts) {
    this._newChild({tag: "rect", x, y, width, height}, opts);
    return this;
  }
  r = this.rect

  line(x1, y1, x2, y2, opts) {
    this._newChild({tag: "line", x1, y1, x2, y2}, opts);
    return this;
  }
  l = this.line

  polygon(pts, opts) {
    const points = [];
    for (let i = 0; i < pts.length; i += 2) {
      points.push(`${pts[i]},${pts[i + 1]}`);
    }
    this._newChild({tag: "polygon", points: points.join(' ')}, opts);
    return this;
  }
  poly = this.polygon

  polyline(pts, opts) {
    const points = [];
    for (let i = 0; i < pts.length; i += 2) {
      points.push(`${pts[i]},${pts[i + 1]}`);
    }
    this._newChild({tag: "polyline", points: points.join(' ')}, opts);
    return this;
  }
  polyl = this.polyline


  path(opts) {
    const p = new SVGPath(opts);
    this._add(p);
    return p;
  }
  p = this.path

  text(x, y, content, opts) {
    const p = this._newChild({tag: "text", x, y}, opts);
    p.children.push(new SVGText(content));
    return this;
  }
  t = this.text

  style(css) {
    const p = this._newChild({tag: "style"});
    p.children.push(new SVGText(css));
    return this;
  }

  mask(id, opts) {
    return this._newChild({tag: "mask", id}, opts);
  }

  g(opts) {
    return this._newChild({tag: "g"}, opts);
  }

  defs() {
    return this._newChild({tag: "defs"});
  }

  symbol(id, viewBox, opts) {
    return this._newChild({tag: "symbol", id, viewBox}, opts);
  }

  use(x, y, href, opts) {
    this._newChild({tag: "use", x, y, "xlink:href": `${href}`}, opts);
    return this;
  }

  html(x, y, width, height, content, opts) {
    const p = this._newChild({tag: "foreignObject", x, y, width, height}, opts);
    p.children.push(new SVGText(
      '<div xmlns="http://www.w3.org/1999/xhtml">\n' + content + '\n</div>'));
    return this;
  }

  tex(x, y, content, opts) {
    const g = this._newChild({tag: "svg"}, {x, y, ...opts});
    const o = renderMath(content, {display: true});
    g._add(new SVGText(o));
    return this;
  }

  render(tab = 0) {
    const s = " ".repeat(tab);
    const out = [];
    const opts = [''];
    for (const k of Object.keys(this.options)) {
      opts.push(`${k}="${this.options[k]}"`);
    }
    out.push(`${s}<${this.tag}${opts.join(' ')}>`);
    for (const c of this.children) {
      out.push("\n" + c.render(tab + 2));
    }
    if (out.length != 1) out.push(`\n${s}`);
    out.push(`</${this.tag}>`);
    return out.join("");
  }

  renderOpt(multipass=false) {
    const s = this.render();

    const res = svgo.optimize(s, {multipass: multipass,
      plugins: [ { name: 'preset-default' } ] });
    return res.data;
  }
}

class SVGText extends SVG {
  constructor(text) {
    super();
    this.text = text;
  }
  render() {
    return this.text;
  }
}

class SVGPath extends SVG {
  constructor(options = {}) {
    super(options);
    this.tag = "path";
    this.path = [];
  }

  _pts(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i += 2) {
      out.push(`${pts[i]},${pts[i + 1]}`);
    }
    return out.join(' ');
  }

  _step(action) {
    return (...pts) => {
      const out = [];
      for (let i = 0; i < pts.length; i += 2) {
        out.push(`${pts[i]},${pts[i + 1]}`);
      }
      this.path.push(`${action} ${out.join(' ')}`);
      return this;
    }
  }

  moveTo = this.M = this._step('M')
  move = this.m = this._step('m')

  lineTo = this.L = this._step('L')
  line = this.l = this._step('l')

  H = this._step('H')
  h = this._step('h')
  V = this._step('V')
  v = this._step('v')

  cubicTo = this.C = this._step('C')
  cubic = this.c = this._step('c')

  quadTo = this.Q = this._step('Q')
  quad = this.q = this._step('q')

  arcTo = this.A = this._step('A')
  arc = this.a = this._step('a')

  close() { this.path.push('Z'); return this; }
  Z = this.z = this.close

  render(tab = 0) {
    if (this.path.length > 0) {
      this.options.d = this.path.join(" ");
    }
    return super.render(tab);
  }
}

if (import.meta.main) {
  const s = new SVG({width: 512, height: 512, viewBox: "0 0 512 512"})
    .circle(50, 50, 50, {fill: "red"})
    .rect(10, 10, 20, 20, {fill: "green"})
    .line(0, 0, 256, 256, {stroke: "blue"})
    .polyline([ 100, 100, 150, 125, 125, 150],
      {fill: "none", stroke: "purple", 'stroke-width': 1})

  const g = s.g({fill: 'none', stroke: 'red', 'stroke-width': 3});

  const p = g.path();
  p.moveTo(200, 200);
  p.lineTo(400, 300, 200, 300).L(100, 350).z()

  s.html(400, 100, 112, 400, `
    <b>hello</b>
  `);

  console.log(s.render());
}
