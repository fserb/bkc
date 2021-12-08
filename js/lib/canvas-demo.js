import Tonic from "./tonic.js";

import "../canvas-polyfill.js";

const BASE = content => `<!doctype html>
<html><head>
<meta http-equiv="origin-trial" content="AhLQm4ICiudjd0hChY39JD0RgNfBTsrra93PD/\
2pTGC05WgqUq//jwCDNVDQo0KVAPPjF/xi+IX4xeP8pn+bdA8AAABUeyJvcmlnaW4iOiJodHRwczovL\
2NhbnZhcy5yb2Nrczo0NDMiLCJmZWF0dXJlIjoiTmV3Q2FudmFzMkRBUEkiLCJleHBpcnkiOjE2NDU1\
NzQzOTl9">
<style>
html, body { background-color: #222; margin: 0; width: 100%; height: 100% }
#c { display: block; width: 100%; height: 100%; object-fit: contain; }
</style>
<script>
function sendFPS(fps) {
  window.frameElement.updateFPS(fps);
}
</script>
</head><body>
<canvas id=c></canvas>
${content}
</body></html>`;

const FPS = `
const buffer = [];
let last = -1;
function frame(t) {
  if (last == -1) {
    last = t;
    requestAnimationFrame(frame);
    return;
  }
  const dt = (t - last) / 1000;
  last = t;
  buffer.push(dt);
  while (buffer.length > 120) buffer.shift();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(() => {
  let s = 0;
  for (const v of buffer) s += v;
  s /= buffer.length;
  sendFPS(Math.round(1 / s));
}, 1000);
`;

const SAFE_SRC = code => BASE(`<script type='module'>
import "./js/canvas-polyfill.js";
function run(canvas) {
${code}
}
${FPS}
run(document.getElementById("c"));
</script>`);

const WORKER_SRC = code => BASE(`<script type='worker-module'>
async function run(canvas) {
${code}
}

self.addEventListener('message', ev => {
  run(ev.data);
});
function sendFPS(fps) {
  self.postMessage(fps);
}
${FPS}
</script>

 <script type='module'>
const script = document.querySelector('[type="worker-module"]').textContent;
const blob = new Blob([script], {type: 'text/javascript'});
const worker = new Worker(URL.createObjectURL(blob), {type: "module"});

worker.onerror = ev => console.log('worker failed!', ev);

const ofc = document.getElementById("c").transferControlToOffscreen();
worker.addEventListener("message", ev => {
  sendFPS(ev.data);
});
worker.postMessage(ofc, [ofc]);
 </script>`);

class CanvasDemo extends Tonic {
  constructor() {
    super();
    this.visible = false;
    this.io = null;
    this.code = "";
    this.attachShadow({mode: 'open'});
  }

  updateFPS(fps) {
    if (!this.visible) return;
    this.shadowRoot.querySelector('#f').innerText = `${fps} fps`;
  }

  updated() {
    // IO to only start the iframe when we are in the middle of the screen.
    if (!this.io) {
      this.io = new IntersectionObserver(en => this.intersect(en), {
        rootMargin: '-50% 0% -50% 0%',
      });
    }
    this.io.disconnect();
    this.io.observe(this);

    if (!this.visible) return;

    this.shadowRoot.querySelector('iframe').updateFPS =
      this.updateFPS.bind(this);

    // When pressing on reload, we simply rebuild the internal DOM, which
    // will create a new iframe and restart the code.
    this.shadowRoot.querySelector('#r').addEventListener('click', () => {
      this.reRender();
    });
    this.start();
  }

  // start loads the iframe code and starts the FPS counter.
  start() {
    if (!this.visible) return;
    this.shadowRoot.querySelector("iframe").srcdoc =
      (!HTMLCanvasElement.prototype.transferControlToOffscreen ||
       globalThis.canvasPolyfill.has("OffscreenCanvas")) ?
        SAFE_SRC(this.code) : WORKER_SRC(this.code);
  }

  intersect(entries) {
    const nv = entries[0].isIntersecting;
    if (nv == this.visible) return;
    this.visible = nv;
    this.reRender();
  }

  stylesheet() {
    return `
iframe, #ph {
  border: 1px solid #000;
  width: 100%;
  aspect-ratio: 1920 / 1080;
  display: block;
  user-select: none;
}
#ph {
  background-color: rgba(0,0,0,0.1);
}
#bar {
  margin: 0;
  width: 100%;
  height: 24px;
  vertical-align: top;
  overflow: hidden;
  user-select: none;
}
#r {
  float: right;
  line-height: 16px;
  font-size: 32px;
  opacity: 0.75;
  cursor: pointer;
}
#r:hover { opacity: 1.0; }
#f {
  opacity: 0.75;
  line-height: 24px;
  float: left;
  font-size: 12px;
}
    `;
  }

  render() {
    if (!this.visible) {
      return this.html`<div id=ph></div><div id=bar></div>`;
    }

    return this.html`<iframe title="canvas demo"></iframe>
<div id=bar><div id=f>-</div><div id=r>⟳</div></div>`;
  }
}
Tonic.add(CanvasDemo);
