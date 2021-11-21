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

```op:
const {rgba} = await import("{{baseURL}}extend.js");
```

We will do our [usual boilerplate](fire), where we assume there's a `canvas`
variable pointing to a valid canvas and initialize it to `1080p`.

```op:+,label:raf+5

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

```op:raf:
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

```op:raf-1,label:update+1+2:render+4+2

function update(dt, t) {
}

function render() {
}
```

### bouncing balls

We start by defining the crystal object with our list of control points. We are
going to have 2 control points, that we will initialize right here.

```op:update-1,label:crystal+1:crystaldef+1+3,lens:this

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
velocity to be within $[700,1100]$ in any direction.

```op:crystal+5
  const speed = 700 + 400 * Math.random();
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

Next we need to deal with the collision between them. We should make a $n^2$
loop that checks every control against each other. But since we will only have
two controls, we shortcirtcuit it to just call the collision function once.

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

When there's a collision we need to update the objects position and velocity.
For the position, we want to remove any overlap between them. We compute how
big the overlap is and move each circle half that distance `overlap` in the
opposite direction, on the axis of the collision.

```op:++

  const overlap = a.radius + b.radius - distance;
  a.pos.x -= col.x * overlap / 2;
  a.pos.y -= col.y * overlap / 2;
  b.pos.x += col.x * overlap / 2;
  b.pos.y += col.y * overlap / 2;
```

Then we do the velocity update. This is a simple
[elastic collision](https://en.wikipedia.org/wiki/Elastic_collision)
(i.e., there's no energy loss) where both objects have the same mass. If we do
the math on this, we get to two simplifcations: because they have the same
mass, transfering momentum will be identical to transfering velocity. And
because we want to keep both total energy and total linear momentum unchanged,
this becomes just a matter of swapping each object's velocity, in the collision
axis.

Which is what we do here. We calculate the relative velocity and project it on
the collision vector (with dot product) on `colvel`. We then add/subtract it
from each velocity on the collision axis. In practice, each velocity $\vec
{v_a}$ is losing its component on the collision axis ($\vec{v_a} \cdot \vec
{col}$) and gaining the velocity of the other object ($\vec{v_b} \cdot \vec
{col}$).


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

Now comes the first part of the magic. We will replace our current rendering
with something more interesting.

```op:+,lens:render
```

We can replace our current circles with a function to render crystals. Apart
from the control points, we will take a `size` parameter (for the axis
perpendicular to the `a-b` direction) and a color for each control point.

```op:render:,label:render+3:renderCrystal+0+2
function renderCrystal(a, b, size, colorA, colorB) {
}

function render() {
  ctx.reset();
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, W, H);

  renderCrystal(crystal.control[0].pos, crystal.control[1].pos, 60,
    "#be2633", "#e06f8b");
}
```

We start by computing the normalized vector `dir` that connects `a` and `b`, we
also calculate a perpendicular vector `nor` to that. Those two will work as the
basis for our crystal rendering.

A quick note on the perpendicular vector. We do it by rotating the original
vector by $90^{\circ}$ counter-clockwise. A vector rotation by $\theta$ is a
multiplication by $\left[\begin
{smallmatrix}\cos\theta & -\sin\theta\\ \sin\theta & \cos\theta\end
{smallmatrix}\right]$. For $90^{\circ}$ it becomes $\left[\begin
{smallmatrix}0 & -1 \\ 1 & 0\end{smallmatrix}\right]$, which is simply $(-y, x)$.

```op:renderCrystal:,lens:renderCrystal,spawn:2
function renderCrystal(a, b, size, colorA, colorB) {
  const dir = {x: b.x - a.x, y: b.y - a.y};
  const dirlen = Math.hypot(dir.x, dir.y);
  if (dirlen == 0) return;
  dir.x /= dirlen;
  dir.y /= dirlen;
  const nor = {x: -dir.y, y: dir.x};
}
```
Now we draw the crystal with a path, following the axis we created. The diagram
below marks each point in order they are added to the path.

{% svg 640,150 %}
  const a = {x: 150, y: 75};
  const b = {x: 490, y: 75};
  const dir = {x: 1, y: 0};
  const nor = {x: 0, y: 1};
  const size = 35;

  svg.options.transform = "rotate(-7.5)";

  const points = [
    {x: a.x - dir.x * size, y: a.y - dir.y * size},
    {x: a.x + nor.x * size, y: a.y + nor.y * size},
    {x: b.x + nor.x * size, y: b.y + nor.y * size},
    {x: b.x + dir.x * size, y: b.y + dir.y * size},
    {x: b.x - nor.x * size, y: b.y - nor.y * size},
    {x: a.x - nor.x * size, y: a.y - nor.y * size},
  ];

  const mask = svg.mask("points");
  mask.rect(0, 0, 640, 150, {fill: "#FFF"});
  for (const p of points) {
    mask.circle(p.x, p.y, 2, {fill:'#000', stroke: '#000'});
  }

  const path = svg.path({fill: 'none', stroke: '#000', 'stroke-width': 1,
  mask: "url(#points)"});
  path.moveTo(points[0].x, points[0].y);
  for (const p of points) {
    path.lineTo(p.x, p.y);
  }
  path.close();

  svg.circle(a.x, a.y, 3, {fill: '#000'});
  svg.tex(a.x + 7.5, a.y, "a");
  svg.circle(b.x, b.y, 3, {fill: '#000'});
  svg.tex(b.x - 15, b.y, "b");

  const textPoints = [
    {x: -15, y: 5},
    {x: -4, y: 15},
    {x: -4, y: 15},
    {x: 5, y: 5},
    {x: -5, y: -5},
    {x: -5, y: -5},
  ];
  for (let i = 0; i < points.length; ++i) {
    const p = points[i];
    svg.circle(p.x, p.y, 2, {fill:'transparent', stroke: '#000'});
    svg.text(p.x + textPoints[i].x, p.y + textPoints[i].y, "" + i,
      {"font-family": "Open Sans", "font-size": "12px"});
  }

  svg.marker("head",
    {orient: "auto", markerWidth: 2, markerHeight: 4, refX: 0.1, refY: 2})
    .path({fill: '#000'}).M(0,0).V(4).L(2,2).Z();

  const c = {x: 320, y: 75};
  svg.path({'stroke-width': 2, 'stroke': '#000', 'marker-end': 'url(#head)'})
    .M(c.x, c.y).l(20,0);
  svg.path({'stroke-width': 2, 'stroke': '#000', 'marker-end': 'url(#head)'})
    .M(c.x, c.y).l(0,-20);
  svg.text(c.x + 2, c.y + 12.5, "dir", {"font-family": "Open Sans", "font-size": "10px"});
  svg.text(c.x - 21, c.y - 7.5, "nor", {"font-family": "Open Sans", "font-size": "10px"});
{% endsvg %}

```op:renderCrystal+7,spawn:2

  ctx.beginPath();
  ctx.moveTo(a.x - dir.x * size, a.y - dir.y * size);
  ctx.lineTo(a.x + nor.x * size, a.y + nor.y * size);
  ctx.lineTo(b.x + nor.x * size, b.y + nor.y * size);
  ctx.lineTo(b.x + dir.x * size, b.y + dir.y * size);
  ctx.lineTo(b.x - nor.x * size, b.y - nor.y * size);
  ctx.lineTo(a.x - nor.x * size, a.y - nor.y * size);
  ctx.fill();
```

Finally, we create a gradient from `colorA` to `colorB` to fill the crystal,
that will go across the the path. The parameters for `createLinearGradient` are
the $0\%$ and $100\%$ of the gradient (that we are passing as out control
points).


```op:renderCrystal+7

  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, colorA);
  g.addColorStop(1, colorB);
  ctx.fillStyle = g;
```

@[canvas-demo]
```op:+
```

We are already mostly there, but the render still looks a bit flat. We can fix
that. First, we are going to update our crystal with an extra parameter.

```op:crystaldef:,lens:crystaldef
const crystal = {
  control: [],
  pulse: 1.0,
};
```

And update it so it pulsates in a sine wave over time.

```op:update+1,lens:update
  crystal.pulse = Math.sin(t * 5);

```

Now are ready to use it to improve our render. First, we are going to use
`pulse` to animate the size of the crystal on the $[60, 100]$ range.

```op:render:,lens:render
function render() {
  ctx.reset();
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, W, H);

  const outer = 60 + 20 * (1 + crystal.pulse);
  renderCrystal(crystal.control[0].pos, crystal.control[1].pos,
    outer, "#be2633", "#e06f8b");
}
```

Let's draw a second crystal inside the first, where it shrinks to 0 in half the
period of the pulse (that we can get with `abs`).

```op:render+8
  renderCrystal(crystal.control[0].pos, crystal.control[1].pos,
    outer * Math.abs(crystal.pulse), "#be2633", "#e06f8b");
```

Finally, instead of simply drawing one of the top of the other, we can make the
whole rendering more interesting by using a screen composite and playing with
the opacity.

```op:render:,lens:render
function render() {
  ctx.reset();
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "screen";

  ctx.globalAlpha = 0.5;
  const outer = 60 + 20 * (1 + crystal.pulse);
  renderCrystal(crystal.control[0].pos, crystal.control[1].pos,
    outer, "#be2633", "#e06f8b");
  ctx.globalAlpha = crystal.pulse;
  renderCrystal(crystal.control[0].pos, crystal.control[1].pos,
    outer * Math.abs(crystal.pulse), "#be2633", "#e06f8b");
}
```

@[canvas-demo]
```op:+
```

### colors

### particles

### background

### shaking


