---
title: Bouncing Crystal
layout: article
draft: true
---

This crystal effect with particles is inspired by the
[bouncing demo](https://github.com/faiface/pixel-examples/tree/master/community/bouncing)
of [Go's pixel library](https://github.com/faiface/pixel) and it's interesting
because it piles up a few simple techniques together into a nice effect.

The mechanics of this effect are based on bouncing balls. The trick is that we
are going to calculate the physics of bouncing balls (technically, circles),
but we are not going to render them as such. Instead, we are going to use their
positions to render our bouncing crystal.

Apart from the boundary collision, we are also going to have a circle/circle
collision that will be simplified for two objects with the same mass. Finally,
we will have a particle system.

The colors will be out of a palette of 12 colors that will rotate around. This
allows to match colors two-by-two instead of having a fully consistent
palette.


#### Boilerplate

We start by importing our common library that includes some things like
`Math.TAU`, `Math.SQRT3`, `Math.clamp()`, in-place array filter and a
convenience `rgba()` function to generate color strings. You can check the
commented
[source code](https://github.com/fserb/bkc/blob/master/pages/extend.js), but
the functions should be fairly obvious.

```op:,spawn:2
const {rgba} = await import("{{baseURL}}extend.js");
```

We will do our [usual boilerplate](fire), where we assume there's a `canvas`
variable pointing to a valid canvas and initialize it to `1080p`.

```op:+,label:raf+1

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

```op:raf+4:4
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

We also define a `radius` (since they are circles) and an internal state to
track whether they have bounced at something this frame.

```op:crystal+10
    radius: 64,
    bounced: false,
```

For now, we will render them as circles, so we can have some idea of what's
happening (you can press on ⟳ to restart with different values).

```op:render:,lens:crystal+render
function render() {
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
}
```

@[canvas-demo]
```op:+,lens:crystal+render
```

Cool. Now let's do some movement. The first thing to do is update the position
given the velocity. Since we have no acceleration, the proper integration is
trivial.

```op:update+1,lens:update
  for (const c of crystal.control) {
    c.pos.x += c.vel.x * dt;
    c.pos.y += c.vel.y * dt;
  }
```

We should make sure that our balls actually bounce on the borders. For this, we
can create a generic function that bounce any circle inside the screen area.
This will be useful for us to reuse it later on the particles.

```op:update-1,label:bounce+1,lens:bounce+update

function bounce(obj) {
}
```

For each dimension, we check if the circle is touching each side of the screen,
and if it is, we move it in and invert the velocity.

```op:bounce+1,lens:bounce+update
  if (obj.pos.x <= obj.radius || obj.pos.x >= W - obj.radius) {
    obj.vel.x = -obj.vel.x;
    obj.pos.x = Math.clamp(obj.pos.x, obj.radius, W - obj.radius);
  }
```

We do this for both dimensions and we also want to return whether we have
touched the side or not, as this will be useful for us later.

```op:bounce:
function bounce(obj) {
  let bounced = false;
  if (obj.pos.x <= obj.radius || obj.pos.x >= W - obj.radius) {
    obj.vel.x = -obj.vel.x;
    bounced = true;
    obj.pos.x = Math.clamp(obj.pos.x, obj.radius, W - obj.radius);
  }
  if (obj.pos.y <= obj.radius || obj.pos.y >= H - obj.radius) {
    obj.vel.y = -obj.vel.y;
    bounced = true;
    obj.pos.y = Math.clamp(obj.pos.y, obj.radius, H - obj.radius);
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

@[canvas-demo]
```op:+
```

Next we need to deal with the collision between them. In theory we should make a
$n^2$ loop over all control points. Since we only have two, we shortcirtcuit it
to just call the collision function once.

```op:update-1,label:update_collision+1

function updateCollision(a, b) {
}
```
```op:update+8,lens:update_collision+update
  updateCollision(crystal.control[0], crystal.control[1]);
```

We calculate the `distance` between the two circles by computing a vector from
one to the other. If we are farther than the sum of the radius, there's no
collision and our job here is done.

`Math.hypot()` is one of those lesser known `Math` functions that is very handy:
it returns the square root of the sum of the squares of all its arguments. In
the case of two arguments, `Math.hypot(x,y)`, calculates $\sqrt{x^2 + y^2}$
which is the magnitude of a vector.

```op:update_collision+1,spawn:2,lens:update_collision
  const col = { x: b.pos.x - a.pos.x, y: b.pos.y - a.pos.y};
  const distance = Math.hypot(col.x, col.y);
  if (distance > a.radius + b.radius) return;
```

In the case that we do have a collision, it will be useful to normalize the
collision vector. For that, we should be a bit careful to not divide by zero.
In the very unlikely case the distance is zero (i.e., both circles are at the
same point), we can choose any arbitrary direction as they will all be equally
wrong (and useful).

```op:++

  if (distance > 0) {
    col.x /= distance;
    col.y /= distance;
  } else {
    col.x = 1;
    col.y = 0;
  }
```

There will be two consequences of the collision: we will move the circles out so
they don't overlap and we will update the velocities to account for the
collision. First the overlap. We compute how big is the overlap and move each
circle half that distance `p` in the opposite direction, on the axis of the
collision.

```op:++

  const p = a.radius + b.radius - distance;
  a.pos.x -= col.x * p / 2;
  a.pos.y -= col.y * p / 2;
  b.pos.x += col.x * p / 2;
  b.pos.y += col.y * p / 2;
```

Then we do the velocity update. This is a simple
[elastic collision](https://en.wikipedia.org/wiki/Elastic_collision)
(i.e., we don't want to lose energy) where both objects have the same mass. If
you do the math on this, you will reach two conclusions: because they have the
same mass, transfering energy will be identical to transfering velocity. And
because we want to keep both total energy and total linear momentum unchanged,
this becomes just a matter of inverting each object velocity, in the collision
axis.

Which is what we do here. We calculate the relative velocity and project on the
collision vector (with dot product) on `colvel`. We then add/subtract it from
each velocity on the collision axis. In practice, each velocity $\vec{v_a}$ is
losing its component on the collision axis ($\vec{v_a} \cdot \vec{col}$) and
gaining the velocity of the other object ($\vec{v_b} \cdot \vec{col}$).


```op:++,spawn:2

  const colvel = (b.vel.x - a.vel.x) * col.x + (b.vel.y - a.vel.y) * col.y;
  a.vel.x += colvel * col.x;
  a.vel.y += colvel * col.y;
  b.vel.x -= colvel * col.x;
  b.vel.y -= colvel * col.y;
```

Finally, we mark both circles as having been bounced. And we are done with the
all the physics we will need to simulate for this effect,

```op:++

  a.bounced = true;
  b.bounced = true;
```

@[canvas-demo]
```op:++
```

### crystal

### colors

### particles

### background

### shaking


