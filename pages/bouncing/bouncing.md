---
title: Bouncing Crystal
layout: article
draft: true
---

This crystal effect with particles is inspired by
[pixel's bouncing demo](https://github.com/faiface/pixel-examples/tree/master/community/bouncing)
and it's simpler than it looks.

The mechanics of this effect are based on bouncing balls. The trick is that we
are going to calculate the physics of balls, but we are not going to render
them as such. Instead, we are going to use their positions to render our
crystal.

Apart from the boundary collision, we are also going to have a circle/circle
collision that will be simplified for two objects with the same mass. Finally,
we will have a particle system.

The colors will be out of a palette of 12 colors that will rotate around. This
allows to match colors two-by-two instead of having a fully consistent
palette.


### as good as your tools

Before we start, let's spend some time writing support functions, mostly for
`Math` and `Array`.

We use of `Math.TAU`, which is
[the correct circle constant](https://tauday.com/tau-manifesto) and defined as
$\tau = 2\pi$. And since we are at it, let's add another useful constant for
$\sqrt{3}$.

```op:1
Math.TAU = Math.PI * 2;
Math.SQRT3 = Math.sqrt(3);
```

It will be convenient to have a simple `clamp` function that limits an input `x`
to stay inside the `[lower, upper]` range.

```op:+

function clamp(x, lower, upper) {
  return x <= lower ? lower : (x >= upper ? upper : x);
}
```

And a convenient way to convert `RGB` values into a string, while we can't use
`TypedOM` for colors.

```op:+

function rgb(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}
```

Finally, we will need a method to filter an `Array` in place. The algorithm is:
keep a index `j` of the position after the last valid element. When we find a
valid element, we copy it to the `j`th position and increment `j`. In the end,
resize the array to only contain `j` elements.

```op:+

function infilter(arr, cond) {
  let j = 0;
  arr.forEach((e, i) => {
    if (cond(e)) {
      if (i !== j) arr[j] = e;
      j++;
    }
  });
  arr.length = j;
  return arr;
}
```

#### Boilerplate

We will do our [usual boilerplate](fire), where we assume there's a `canvas`
variable pointing to a valid canvas and initialize it to `1080p`.

```op:+,label:raf+1,lens:raf

const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;

function frame(ts) {
  requestAnimationFrame(frame);
}
frame(0);
```

We are going to set up our `requestAnimationFrame` with an `update` and a
`render` function. The first one will also receive the time elapsed and total
time. The second is supposed to not change any state. Also, remember that
`requestAnimationFrame` returns the time in milliseconds.

```op:raf+4:5,spawn:2
let last = 0;
function frame(ts) {
  ts /= 1000;
  const dt = (ts - last);
  last = ts;

  update(dt, ts);
  render();

  requestAnimationFrame(frame);
}
frame(0);
```

Finally, we just need to define our two main loop functions. They are going to
be a bit empty for now.

```op:raf+3,label:update+1+2:render+4+2

function update(dt, t) {
}

function render() {
}
```

### bouncing balls

We start by defining the crystal object with our list of control points. We are
going to have 2 control points, that we will initialize right here.

```op:raf+3,label:crystal+1,lens:this

const crystal = {
  control: [],
};

for (let i = 0; i < 2; ++i) {
  crystal.control.push({
  });
}
```

Each of our control points will start with a velocity. Because we have a
physical system that will conserve energy, this will end up defining how fast
the system will be, as no new energy will be introduced. We force the initial
velocity to be within $[600,1000]$ in any direction.

```op:crystal+5
  const speed = 600 + 400 * Math.random();
  const vdir = Math.TAU * Math.random();
```
We put the control in a random position inside our canvas and create the `vel`
vector to match the generated `speed` and `vdir`.

```op:crystal+8
    pos: {x: W * Math.random(), y: H * Math.random()},
    vel: {x: speed * Math.cos(vdir), y: speed * Math.sin(vdir)},
```

We also define a `radius` (since our controls are circles) and an internal
state to track whether they have bounced at something this frame.

```op:crystal+10
    radius: 64,
    bounced: false,
```

For now, we will render them as circles, so we can have some idea of what's
happening.

```op:render+1,lens:render
  ctx.reset();
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, W, H);
  for (const c of crystal.control) {
    ctx.strokeStyle = '#F00';
    ctx.fillStyle = '#700';
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.TAU);
    ctx.fill();
    ctx.stroke();
  }
```

```op:+,lens:crystal+render
```
@[canvas-demo]

Cool. Now let's do some moving. The first obvious thing to do is to update the
position given the velocity. Given that we have no acceleration, the proper
integration is trivial.

```op:update+1
  for (const c of crystal.control) {
    c.pos.x += c.vel.x * dt;
    c.pos.y += c.vel.y * dt;
  }
```

We should make sure that our balls actually bounce on the borders. For this, we
can create a generic function that bounce any circle inside the screen area.

```op:update-1,label:bounce+1

function bounce(obj) {
}
```

For each dimension, we check if the circle is touching each side of the screen,
and if it is, we move it in and invert the velocity.

```op:bounce+1,lens:bounce+update
  if (obj.pos.x <= obj.radius || obj.pos.x >= W - obj.radius) {
    obj.vel.x = -obj.vel.x;
    obj.pos.x = clamp(obj.pos.x, obj.radius, W - obj.radius);
  }
```

We do this for both dimensions and we also want to return whether we have
touched the side or not, as this will be useful for us later.

```op:bounce:6
function bounce(obj) {
  let bounced = false;
  if (obj.pos.x <= obj.radius || obj.pos.x >= W - obj.radius) {
    obj.vel.x = -obj.vel.x;
    bounced = true;
    obj.pos.x = clamp(obj.pos.x, obj.radius, W - obj.radius);
  }
  if (obj.pos.y <= obj.radius || obj.pos.y >= H - obj.radius) {
    obj.vel.y = -obj.vel.y;
    bounced = true;
    obj.pos.y = clamp(obj.pos.y, obj.radius, H - obj.radius);
  }
  return bounced;
}
```

Finally, we just need to use our new `bounce()` function on update, propagating
the result value into the control object.

```op:update+4,lens:bounce+update
    if (bounce(c)) {
      c.bounced = true;
    }
```

```op:+
```
@[canvas-demo]

Next we need to deal with the collision between them.

```op:update-1

function updateCollision(a, b) {

}
```
```op:update+8
  updateCollision(crystal.control[0], crystal.control[1]);
```


### crystal

### colors

### particles

### background

### shaking


