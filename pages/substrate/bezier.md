---
title: Substrate Bezier
layout: article
date: 2021-12-23
subpage: true
preview: false
prevPage: substrate/prism
draft: true
---

Our next effect is a general `Substrate` variant. The idea is to build an
initial bezier path that goes across the screen, and then let the substrate
algorithm run on top of that. We also want to generate more random palettes.

### Setup

We start where we left off last time.

```
const {gridRaystep, normal, Color} =
  await import("https://dev.metaphora.co/bkc/_site/js/extend.js");

const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;

const EMPTY = Infinity;
const INVALID = null;

class Substrate {
  constructor(ctx) {
    this.ctx = ctx;
    this.angleVariance = 0.025;
    this.maxActiveCracks = 128;
    this.totalCracks = 0;
    this.maxTotalCracks = 12000;
    this.cracks = [];
    this.width = this.ctx.canvas.width;
    this.height = this.ctx.canvas.height;

    this.grid = new Array(this.width * this.height);
    for (let i = 0; i < this.width * this.height; ++i) {
      this.grid[i] = EMPTY;
    }

    this.colors = null;
    this.lineColor = '#000000';
  }

  clear(bgColor) {
    this.ctx.reset();
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  begin({random = 0, start = 0, mask = null}) {
    if (mask !== null) {
      const add = mask.applyMask(this);
      for (const a of add) {
        this.cracks.push(new Crack(this, ...a));
        this.totalCracks++;
      }
    }

    let k = 0;
    while (k < random) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      if (this.get(x, y) !== EMPTY) continue;

      this.set(x, y, Math.random() * Math.TAU);
      k++;
    }

    for (let k = 0; k < start; ++k) {
      this.newCrack();
    }
  }

  newCrack() {
    if (this.cracks.length >= this.maxActiveCracks) return;
    if (this.maxTotalCracks > 0 && this.totalCracks >= this.maxTotalCracks) {
      return;
    }

    let x = 0;
    let y = 0;

    let found = false;
    for (let i = 0; i < this.width * this.height; ++i) {
      x = Math.random() * this.width;
      y = Math.random() * this.height;
      const p = this.get(x, y);
      if (p != EMPTY && p != INVALID) {
        found = true;
        break;
      }
    }
    if (!found) return;

    const dir = Math.sign(Math.random() - 0.5);
    const variance = this.angleVariance * normal();
    const angle = this.get(x, y) + dir * ((Math.TAU / 4) + variance);

    this.cracks.push(new Crack(this, x, y, angle));
    this.totalCracks++;
  }

  update() {
    this.cracks.filterIn(c => {
      if (!c.move()) {
        this.newCrack();
        this.newCrack();
        return false;
      }
      return true;
    });
    return this.cracks.length > 0;
  }

  getColor() {
    if (this.colors === null) return null;
    return this.colors[Math.floor(Math.random() * this.colors.length)];
  }

  get(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return INVALID;
    return this.grid[x + y * this.width];
  }

  set(x, y, v) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.grid[x + y * this.width] = v;
  }
}

class Crack {
  constructor(ss, x, y, angle) {
    this.ss = ss;
    this.angle = angle;
    this.pos = gridRaystep({x, y}, this.angle);
    if (this.ss.get(this.pos.x, this.pos.y) === INVALID) {
      this.pos = null;
    }
    this.mod = 0.5 * Math.random();
    this.color = this.ss.getColor();
  }

  move() {
    if (this.pos === null) return false;
    const oldpos = this.pos;
    this.pos = gridRaystep(oldpos, this.angle);

    if (this.color !== null) {
      this.paintRegion();
    }

    for (let i = 0 ; i < 2; ++i) {
      this.ss.ctx.fillStyle = this.ss.lineColor;
      this.ss.ctx.fillRect(
        this.pos.x + 0.33 * normal(),
        this.pos.y + 0.33 * normal(),
        1, 1);
    }

    const delta = {
      x: Math.floor(this.pos.x) - Math.floor(oldpos.x),
      y: Math.floor(this.pos.y) - Math.floor(oldpos.y),
    };
    for (let dx = 0; dx <= Math.abs(delta.x); ++dx) {
      for (let dy = 0; dy <= Math.abs(delta.y); ++dy) {
        const v = this.ss.get(
          oldpos.x + Math.sign(delta.x) * dx,
          oldpos.y + Math.sign(delta.y) * dy);
        if (v === INVALID || (v !== EMPTY && v != this.angle)) return false;
      }
    }

    this.ss.set(this.pos.x, this.pos.y, this.angle);
    return true;
  }

  paintRegion() {
    let r = {...this.pos};
    while (true) {
      r = gridRaystep(r, this.angle + Math.TAU / 4);
      const v = this.ss.get(r.x, r.y);
      if (v === INVALID || v != EMPTY) break;
    }

    this.mod = Math.clamp(this.mod + 0.05 * normal(), 0, 1.0);

    const t = {
      x: this.pos.x + (r.x - this.pos.x) * this.mod,
      y: this.pos.y + (r.y - this.pos.y) * this.mod
    };

    const grad = this.ss.ctx.createLinearGradient(
      this.pos.x, this.pos.y, t.x, t.y);
    const S = 5;
    for (let i = 0; i < S; ++i) {
      const f = i / (S - 1);
      const a = 0.25 * ((1 - f) ** 0.25);
      grad.addColorStop(f, this.color.alpha(a));
    }
    this.ss.ctx.strokeStyle = grad;

    this.ss.ctx.lineWidth = 2;
    this.ss.ctx.beginPath();
    this.ss.ctx.moveTo(this.pos.x, this.pos.y);
    this.ss.ctx.lineTo(t.x, t.y);
    this.ss.ctx.stroke();
  }
}

class Mask {
  constructor(ctx) {
    this.octx = ctx;
    this.width = ctx.canvas.width;
    this.height = ctx.canvas.height;
    this.ofc = new OffscreenCanvas(this.width, this.height);
    this.ctx = this.ofc.getContext("2d");
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = "#FFF";

    this.toAdd = [];
  }

  applyMask(ss) {
    const im = this.ctx.getImageData(0, 0, this.width, this.height).data;

    for (let y = 0; y < this.height; ++y) {
      for (let x = 0; x < this.width; ++x) {
        const p = (x + y * this.width) * 4;
        const c = im[p];
        if (c <= 5) {
          ss.set(x, y, INVALID);
        } else if (c >= 250) {
          ss.set(x, y, EMPTY);
        } else if (c >= 10 && c <= 245) {
          ss.set(x, y, Math.TAU * (c - 10) / 235);
        }
      }
    }

    return this.toAdd;
  }

  line(x0, y0, x1, y1) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    this.toAdd.push([x0, y0, ang]);
  }

  poly(...points) {
    this.ctx.fillStyle = "#FFF";
    this.ctx.strokeStyle = '#FFF';
    this.ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) {
      const n = (i + 2) % points.length;
      this.ctx.lineTo(points[i], points[i+1]);
      this.line(points[i], points[i+1], points[n], points[n+1]);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
}

function basicEffect() {
  const ss = new Substrate(ctx);
  ss.clear('#FFFFFF');
  const colors = Color('#000000').steps(256, '#FFFF00');
  for (let i = 0; i < colors.length; ++i) {
    const f = i / (colors.length - 1);
    colors[i] = colors[i].luminance(f ** 1.2)
      .saturate(2 * Math.abs(Math.sin(f * 7)))
      .rotate(-40 + 50 * (Math.cos(f * 5)))
      .multiply(Color('#FFFF0050'))
  }
  ss.colors = colors;
  ss.lineColor = '#3B2618';

  ss.begin();
  return () => ss.update();
}

function prism() {
  const ss = new Substrate(ctx);
  const colors = Color('#000000').steps(16, '#00AAFF');
  for (let i = 0; i < colors.length; ++i) {
    const f = i / (colors.length - 1);
    colors[i] = colors[i]
      .luminance((f * 0.9) ** 1.2)
      .saturate(4 * Math.abs(Math.sin(f * 7)))
      .multiply(Color('#FF00FF40'))
  }
  ss.colors = colors;
  ss.clear('#FFFFFF');
  ss.lineColor = '#323E51AA';
  ss.maxTotalCracks = 4000;
  ss.maxActiveCracks = 64;

  ctx.strokeStyle = '#323E51';
  ctx.lineCap = "round";
  ctx.lineWidth = 4;

  const m = new Mask(ctx);
  m.poly(960, 88, 1177, 273, 1177, 549, 1177, 825,
    960, 993, 742, 825, 742, 549, 742, 273);
  ss.begin({mask: m});

  return () => ss.update();
}

const update = prism();

function frame() {
  if (update()) {
    requestAnimationFrame(frame);
  }
}
frame();
```





