import Tonic from "./tonic.js";

let cdid = 0;
class CanvasDemo extends Tonic {
  constructor() {
    super();
    if (!this.id) {
      this.id = `canvas-demo-${cdid++}`;
    }
    this.visible = false;
    this.io = null;
    this.rafid = 0;
  }

  connected() {
    // this.updated();
  }

  #setContent(html='') {
    if (!this.visible) return;
    const iframe = this.querySelector("iframe");
    if (!html.length) {
      iframe.contentWindow.location.reload();
    } else {
      iframe.srcdoc = html;
      // iframe.contentWindow.document.open();
      // iframe.contentWindow.document.write(html);
      // iframe.contentWindow.document.close();
    }
  }

  updated() {
    if (!this.io) {
      this.io = new IntersectionObserver(en => this.intersect(en), {
        rootMargin: '-50% 0% -50% 0%',
      });
    }
    this.io.disconnect();
    this.io.observe(this);

    if (!this.visible) return;

    this.querySelector('#r').addEventListener('click', ev => {
      this.reRender();
    });
    if (this.visible) {
      this.start();
    }
  }

  start() {
    this.#setContent(`
      <!doctype html>
      <html><head><style>
      html, body { margin: 0; padding: 0; height: 100%; }
      #c { width: 100%; height: 100%; }
      </style></head><body>
      <canvas id=c></canvas>
      <script type='module'>
      const canvas = document.getElementById('c');
      ${this.state.code}
      </script>
      </body></html>`);
    this.lastts = -1;
    this.buffer = [];
    if (this.rafid) {
      cancelAnimationFrame(this.rafid);
    }
    this.rafid = requestAnimationFrame(t => this.frame(t));
  }

  intersect(entries) {
    const nv = entries[0].isIntersecting;
    if (nv == this.visible) return;
    this.visible = nv;
    this.reRender();
    if (!this.visible || !this.state.code) {
      this.#setContent();
      return;
    }
  }

  frame(t) {
    if (this.lastts == -1) {
      this.lastts = t;
      this.rafid = requestAnimationFrame(t => this.frame(t));
      return;
    }
    const dt = (t - this.lastts) / 1000;
    this.lastts = t;

    this.buffer.push(dt);
    while (this.buffer.length > 30) this.buffer.shift();

    let s = 0;
    for (const v of this.buffer) s += v;
    s /= this.buffer.length;

    if (this.visible) {
      this.querySelector('#f').innerText = `${Math.round(1 / s)} fps`;
      this.rafid = requestAnimationFrame(t => this.frame(t));
    } else {
      cancelAnimationFrame(this.rafid);
      this.rafid = 0;
    }
  }

  stylesheet() {
    return `
iframe, #ph {
  border: 1px solid #000;
  max-width: 600px;
  width: 100%;
  aspect-ratio: 1920 / 1080;
  display: block;
}
#ph {
  background-color: rgba(0,0,0,0.1);
}
#bar {
  margin: 0;
  width: 100%;
  max-width: 600px;
  height: 24px;
  vertical-align: top;
}
#r {
  float: right;
  line-height: 16px;
  font-size: 32px;
  opacity: 0.5;
  cursor: pointer;
}
#r:hover { opacity: 1.0; }
#f {
  opacity: 0.5;
  float: left;
  font-size: 12px;
}
    `;
  }

  load(ev) {
    console.log(ev);
  }

  render() {
    if (!this.visible) {
      return this.html`<div id=ph></div><div id=bar></div>`;
    }

    return this.html`<iframe></iframe>
<div id=bar><div id=f>-</div><div id=r>⟳</div></div>`;
  }
}
Tonic.add(CanvasDemo);
