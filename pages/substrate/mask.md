---
title: Substrate Mask
layout: article
date: 2021-12-22
subpage: true
preview: false
prevPage: substrate/
---

On this second part we will create a `Mask` class that will allow us to set
different initial states for substrate and we will use it to create a few new effects.

### Cleanup

We start with the previous code.

```add:,lens:#basicEffect>#frame-2
const {gridRaystep, normal, Color} =
  await import("https://dev.metaphora.co/bkc/_site/js/extend.js");

const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;

const EMPTY = Infinity;
const INVALID = null;

class Substrate {
  constructor() {
    this.cracks = [];
    this.angleVariance = 0.025;
    this.maxActiveCracks = 128;
    this.totalCracks = 0;
    this.maxTotalCracks = 12000;

    this.grid = new Array(W * H);
    for (let i = 0; i < W * H; ++i) {
      this.grid[i] = EMPTY;
    }

    this.colors = null;
    this.lineColor = '#000000';
  }

  clear(bgColor) {
    ctx.reset();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
  }

  begin() {
    let k = 0;
    while (k < 16) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (this.get(x, y) !== EMPTY) continue;
      this.set(x, y, Math.random() * Math.TAU);
      k++;
    }

    for (let k = 0; k < 3; ++k) {
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
    for (let i = 0; i < W * H; ++i) {
      x = Math.random() * W;
      y = Math.random() * H;
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
    if (x < 0 || x >= W || y < 0 || y >= H) return INVALID;
    return this.grid[x + y * W];
  }

  set(x, y, v) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    this.grid[x + y * W] = v;
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
      ctx.fillStyle = this.ss.lineColor;
      ctx.fillRect(
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

    const grad = ctx.createLinearGradient(this.pos.x, this.pos.y, t.x, t.y);
    const S = 5;
    for (let i = 0; i < S; ++i) {
      const f = i / (S - 1);
      const a = 0.25 * ((1 - f) ** 0.25);
      grad.addColorStop(f, this.color.alpha(a));
    }
    ctx.strokeStyle = grad;

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }
}

function basicEffect(ss) {
  ss.clear('#FFFFFF');
  ss.lineColor = '#3B2618';
  const colors = Color('#000000').steps(256, '#FFFF00');
  for (let i = 0; i < colors.length; ++i) {
    const f = i / (colors.length - 1);
    colors[i] = colors[i].luminance(f ** 1.2)
      .saturate(2 * Math.abs(Math.sin(f * 7)))
      .rotate(-40 + 50 * (Math.cos(f * 5)))
      .multiply(Color('#FFFF0050'))
  }
  ss.colors = colors;

  ss.begin();
}

const ss = new Substrate();
basicEffect(ss);

function frame() {
  if (ss.update()) {
    requestAnimationFrame(frame);
  }
}
frame();
```

We remove the `basicEffect()` code, since this is the code we are going to
replace.

```sub:#basicEffect,lens:#frame-2
```

```sub:frame-2+1,spawn:4
```

We allow `begin()` to be parametrized, so we can choose how many starting points
and many initial lines to demo has.

```sub:#Sub#begin,lens:this
  begin({random = 0, start = 0}) {
    let k = 0;
    while (k < random) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (this.get(x, y) !== EMPTY) continue;

      this.set(x, y, Math.random() * Math.TAU);
      k++;
    }

    for (let k = 0; k < start; ++k) {
      this.newCrack();
    }
  }
```

### Mask

We are going to create a helper `Mask` class, that is going to have a separate
`canvas` element where we will draw shapes that will eventually be moved into
Substrate's `grid`. There are two things we may want to represent on the image:
areas where the effect should not run (`INVALID` parts) and areas where there's
a particular line/angle.

```add:#Crack.,lens:#Mask

class Mask {
}
```

We create a canvas the same size as the original canvas. We will also keep a
list of initial cracks that we may want to add to `Substrate`.

```add:#Mask+1
  constructor() {
    this.ofc = new OffscreenCanvas(W, H);
    this.ctx = this.ofc.getContext("2d");
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.fillStyle = "#FFF";

    this.toAdd = [];
  }
```

The mask will be applied during begin, where we will invoke it and create the
cracks.

```sub:#Sub#begin+0+1,lens:#Sub#begin
  begin({random = 0, start = 0, mask = null}) {
    if (mask !== null) {
      const add = mask.applyMask(this);
      for (const a of add) {
        this.cracks.push(new Crack(this, ...a));
        this.totalCracks++;
      }
    }

```

The core of the mask is `applyMask()`,

```add:#Mask#cons.,lens:#Mask#applyMask

  applyMask(ss) {
  }
```

where we use the internal `ofc` canvas to update Substrate's `grid` by grabbing
each pixel and reading the red channel.

```add:#Mask#apply+1,spawn:3
    const im = this.ctx.getImageData(0, 0, W, H).data;

    for (let y = 0; y < H; ++y) {
      for (let x = 0; x < W; ++x) {
        const p = (x + y * W) * 4;
        const c = im[p];
      }
    }

    return this.toAdd;
```

There are multiple ways we could have decided to do this translation. One thing
to keep in mind is that canvas rendering uses antialiasing, which mean that
whatever we trry to draw, we will have "border" pixels that won't be the same
value that we used to fill in.

To solve this, it's good to leave a bit of room for each value range. The
encoding we decide on is: $[0,5]$ @[color-show]{"color":"#000"} is invalid
(i.e., no crack can pass there), $[250,255]$ @[color-show]{"color":"#F00"} is a
valid empty space (i.e., cracks can pass there).

```add:last.-4,spawn:2
        if (c <= 5) {
          ss.set(x, y, INVALID);
        } else if (c >= 250) {
          ss.set(x, y, EMPTY);
        }
```

And then everything in the middle

```sub:last.-1
        } else if (c >= 10 && c <= 245) {
          ss.set(x, y, Math.TAU * (c - 10) / 235);
        }
```

line

```add:
```

poly

### The Cube





@[canvas-demo]
