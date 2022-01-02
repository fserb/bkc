---
title: Substrate Prism
layout: article
date: 2021-12-22
subpage: true
preview: false
prevPage: substrate/
nextPage: substrate/bezier
---

On this second part we will create a `Mask` class that will allow us to set
different initial states for substrate and we will use it to create a new
effect.

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

  begin() {
    let k = 0;
    while (k < 16) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
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

const update = basicEffect();

function frame() {
  if (update()) {
    requestAnimationFrame(frame);
  }
}
frame();
```

We remove the `basicEffect()` call, since this is the code we are going to
replace.

```sub:frame-2+1,spawn:3
```

We allow `begin()` to be parametrized, so we can choose how many starting points
and many initial lines to demo has.

```sub:#Sub#begin,lens:this
  begin({random = 0, start = 0}) {
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
    const im = this.ctx.getImageData(0, 0, this.width, this.height).data;

    for (let y = 0; y < this.height; ++y) {
      for (let x = 0; x < this.width; ++x) {
        const p = (x + y * this.width) * 4;
        const c = im[p];
      }
    }

    return this.toAdd;
```

There are multiple ways we could have decided to do this translation. One thing
to keep in mind is that canvas rendering uses antialiasing, which mean that
whatever we trry to draw, we will have "border" pixels that won't be the same
value that we used to fill in.

```add:
```

To solve this, it's good to leave a bit of room for each value range. The
encoding we decide on is: $[0,5]$ @[color-show]{"color":"#000"} is invalid
(i.e., no crack can pass there), $[250,255]$ @[color-show]{"color":"#F00"} is a
valid empty space (i.e., cracks can pass there).

```add:last.-4
        if (c <= 5) {
          ss.set(x, y, INVALID);
        } else if (c >= 250) {
          ss.set(x, y, EMPTY);
        }
```

And then everything in the middle $[10, 245]$ will be mapped to an angle (i.e., a fraction of $\tau$).

```sub:last.-1,spawn:3
        } else if (c >= 10 && c <= 245) {
          ss.set(x, y, Math.TAU * (c - 10) / 235);
        }
```

This is all. Now, as long as we build a proper mask canvas, the effect will work
as expected. Before we delve into examples, we can add a couple helper
functions to render lines and polygons to the canvas.

```add:
```

One other thing to keep in mind, is that sometimes we may want to update the final `ctx` as well as the mask. This is just to guarantee the shapes we have
in mind are already rendered in the screen.

For `line()`, we want a line from `(x0, y0)` to `(x1, y1)`, render it on the main canvas and set up a new line on `(x0, y0)` with the right angle.

```add:#Mask#apply.,lens:#Mask#line

  line(x0, y0, x1, y1) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    this.toAdd.push([x0, y0, ang]);
  }
```

For rendering a polygon, we want to `line()` all edges but also make sure that
the inside of the polygon is marked as `EMPTY`.

```add:,lens:#Mask#poly

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
```

Now we are ready to use our effect.


### The Prism

Our first extra effect is simply exercising our new `Mask`. It's a prism-shaped
mask, with a new palette. We start setting up the basic `Substrate` effect.

```add:#frame-2,lens:#prism>#frame.+0+1

function prism() {
  const ss = new Substrate(ctx);

  return () => ss.update();
}
```

```add:#frame-1
const update = prism();
```

We start by building a color palette from @[color-show]{"grad":"#000000,#00AAFF"},
similarly to what we did on the basic effect.

```add:#prism+2
  const colors = Color('#000000').steps(16, '#00AAFF');
  for (let i = 0; i < colors.length; ++i) {
    const f = i / (colors.length - 1);
    colors[i] = colors[i]
  }
  ss.colors = colors;
```

We brighten the range to @[color-show]{"grad":"#000000, #4B545A, #6E7C88, #889CAC, #9EB6C9, #B4CDE1, #CAE2F5, #E3F4FF"}.

```add:#prism+6
      .luminance((f * 0.9) ** 1.2)
```

Then saturate using a `sin()` to @[color-show]{"grad":"#000000, #2A353E, #30536D, #296A96, #277CB4, #418CC1, #6A99BD, #84A5BE, #62B5F1, #2EC2FF, #00CDFF, #3AD8FF, #7EE0FF, #B9E6FF, #C4EEFF, #BDF9FF"}

```add:
      .saturate(4 * Math.abs(Math.sin(f * 7)))
```

Finally we multiply everything by @[color-show]{"color": "#FF00FF40"}, tainting the whole range a bit to @[color-show]{"grad":"#000000, #2A2E3E, #30486D, #295C96, #276DB4, #417BC1, #6A86BD, #8490BE, #629FF1, #2EAAFF, #00B4FF, #3ABEFF, #7EC5FF, #B9CAFF, #C4D2FF, #BDDBFF"}.

```add:,spawn:5
      .multiply(Color('#FF00FF40'))
```

We set the background to @[color-show]{"color":"#FFF"} and the line to @[color-show]{"color": "#323E51AA"}. We also reduce a bit the number of cracks, as the prism area is much
smaller than the screen.

```add:last+3
  ss.clear('#FFFFFF');
  ss.lineColor = '#323E51AA';
  ss.maxTotalCracks = 4000;
  ss.maxActiveCracks = 64;

```

Now we need to actually draw the prism. On the main `ctx`, we will render the
outline.

```add:
  ctx.strokeStyle = '#323E51';
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
```

For our `Mask`, we will pass the points (sequence of `x, y`) of a polygon that
forms the shape. The actual numbers came from a vector rendering that I
manually created and copied the points over.

```add:

  const m = new Mask(ctx);
  m.poly(960, 88, 1177, 273, 1177, 549, 1177, 825,
    960, 993, 742, 825, 742, 549, 742, 273);
  ss.begin({mask: m});
```

@[canvas-demo]

Next, we are going for a `Substrate` variant with bezier curves.


