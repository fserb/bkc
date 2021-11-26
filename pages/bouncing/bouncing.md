---
title: Bouncing Crystal
layout: article
draft: true
---

This crystal effect with particles is inspired by the [bouncing
demo](https://github.com/faiface/pixel-examples/tree/master/community/bouncing)
of [Go's pixel library](https://github.com/faiface/pixel) and it's interesting
because it piles up a few simple techniques together into a nice effect.

The mechanics of this effect are based on bouncing balls. The trick is that we
are going to calculate the physics of bouncing balls (technically circles),
but we are not going to render them as such. Instead, we are going to use their
positions to render our bouncing crystal.

Apart from the boundary collision, we are also going to have a circle/circle
collision that will be simplified for two objects with the same mass. Finally,
we will have a simple particle system. Let's do this.


#### Boilerplate

We start by importing our common library that includes some things like
`Math.TAU` (the one true [circle constant](https://tauday.com/tau-manifesto)),
`Math.SQRT3`, `Math.clamp()`, in-place array filter and a convenience `rgba()`
function to generate color strings. You can check the commented [source
code](https://github.com/fserb/bkc/blob/master/pages/extend.js), but the
functions should be fairly obvious.

```op:
const {rgba} = await import("{{baseURL}}extend.js");
```

We will do the [usual boilerplate](fire), where we assume there's a `canvas`
variable pointing to a valid canvas element and initialize it to `1080p`.

```op:+,label:init+1+4:raf+5

const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;

function frame(ts) {
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

We are going to set up our `requestAnimationFrame` with an `update` and a
`render` function. The first one will also receive the time elapsed and total
time. The second is supposed to not change any state. Also, remember that
`requestAnimationFrame` returns the time in milliseconds.

We need to be a bit careful on the initial frames. The initial call to `frame()`
will have `ts=0` (because we called it like so), so `dt=0`, and the second call
will have `dt=ts`, which can be any number, as there's no guarantee of when
`requestAnimationFrame` starts counting, and this could lead to an arbitrarily
big number. Both of those results can lead to weird numbers, so we just skip the
initial frames until everything settles.

```op:raf:,spawn:2

let last = 0;
function frame(ts) {
  ts /= 1000;
  const dt = (ts - last);
  last = ts;
  if (dt === ts) {
    return requestAnimationFrame(frame);
  }

  update(dt, ts);
  render();

  requestAnimationFrame(frame);
}
frame(0);
```

```op:raf,label:update+1+2:render+4+2

function update(dt, t) {
}

function render() {
}
```

### bouncing balls

We start by defining the crystal object with our list of control points. We are
going to have 2 control points, that we will initialize right here.

```op:update-1,label:crystaldef+1+4:crystal+1,lens:this

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
the system will be forever, as no new energy will be introduced. We force the
initial velocity to be within $[700,1100]$ in any direction.

```op:crystal+5
  const speed = 700 + 400 * Math.random();
  const vdir = Math.TAU * Math.random();
```

We put the control in a random position inside our canvas and create the `vel`
vector to match the generated `speed` and `vdir`. Notice that we do no effort
to make sure that they don't initially overlap, as our collision system will
take care of that.

```op:crystal+8
    pos: {x: W * Math.random(), y: H * Math.random()},
    vel: {x: speed * Math.cos(vdir), y: speed * Math.sin(vdir)},
```

We also define a `radius` (we could hard code that, but if we define it
explicitly, our collision code is more generic and can be used for particles
too) and an internal state to track whether they have `bounced` at something
this frame.

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

Now let's do some movement. The first thing to do is update the position given
the velocity. Since we have no acceleration, the proper integration is the
obvious one.

```op:update+1,lens:update
  for (const c of crystal.control) {
    c.pos.x += c.vel.x * dt;
    c.pos.y += c.vel.y * dt;
  }
```

We should make sure that our balls actually bounce on the borders. For this, we
can create a generic function that bounce any circle inside the screen area.
This will be useful for us to reuse it later for particles.

```op:update-1,label:bounce+1,lens:bounce+update

function bounce(obj) {
}
```

For each dimension, we check if the circle is touching each side of the screen,
and if it is, we move it back in and invert the velocity in that axis.

```op:bounce+1,lens:bounce+update
  if (obj.pos.x <= obj.radius || obj.pos.x >= W - obj.radius) {
    obj.vel.x = -obj.vel.x;
    obj.pos.x = Math.clamp(obj.pos.x, obj.radius, W - obj.radius);
  }
```

We do this for both axis and we also return whether we have touched the side or
not.

```op:bounce:
function bounce(obj) {
  let bounced = false;
  if (obj.pos.x <= obj.radius || obj.pos.x >= W - obj.radius) {
    obj.vel.x = -obj.vel.x;
    obj.pos.x = Math.clamp(obj.pos.x, obj.radius, W - obj.radius);
    bounced = true;
  }
  if (obj.pos.y <= obj.radius || obj.pos.y >= H - obj.radius) {
    obj.vel.y = -obj.vel.y;
    obj.pos.y = Math.clamp(obj.pos.y, obj.radius, H - obj.radius);
    bounced = true;
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

Next we need to deal with the collision between them. The correct way would be
to make a $n^2$ loop that checks every control against all others. But since we
will only have two controls, we short-circuit it to just call the collision
function once.

```op:update-1,label:update_collision+1

function updateCollision(a, b) {
}
```
```op:update+8,lens:update_collision+update
  updateCollision(crystal.control[0], crystal.control[1]);
```

We calculate the `distance` between the two circles by computing a vector `col`
from one to the other. If we are farther than the sum of the radius, there's no
collision and our job here is done.

`Math.hypot()` is one of those lesser known `Math` functions that is very handy:
it returns the square root of the sum of the squares of all its arguments. In
the case of two arguments, `Math.hypot(x,y)`, calculates $\sqrt{x^2 + y^2}$
which is the magnitude of a vector, the hypotenuse of the triangle, the
euclidian norm, etc...

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

Then we do the velocity update. This is a simple [elastic
collision](https://en.wikipedia.org/wiki/Elastic_collision) (i.e., there's no
energy loss) where both objects have the same mass. If we do the math on this,
we get to two simplifications: because they have the same mass, transferring
momentum will be identical to transferring velocity. And because we want to keep
both total energy and total linear momentum unchanged, this becomes just a
matter of swapping each object's velocity, in the collision axis.




Which is what we do here. We calculate the relative velocity ($\vec{v_b} - \vec
{v_a}$) and project it on the collision vector ($\left(\vec{v_b} - \vec
{v_a}\right) \cdot \vec{col}$) on `colvel`.
We then add/subtract it from each velocity on the collision axis. In practice,
each velocity $\vec{v_a}$ is losing its component on the collision axis ($\vec
{v_a} \cdot \vec{col}$) and gaining the velocity of the other object ($\vec
{v_b} \cdot \vec{col}$).


```op:++,spawn:2

  const colvel = (b.vel.x - a.vel.x) * col.x + (b.vel.y - a.vel.y) * col.y;
  a.vel.x += colvel * col.x;
  a.vel.y += colvel * col.y;
  b.vel.x -= colvel * col.x;
  b.vel.y -= colvel * col.y;
```

Finally, we mark both circles as having been bounced. And we are done with all
the physics we will need for this effect.

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
basis for our crystal rendering. Notice that we both normalize and multiply by
the passed `size`.

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
  dir.x *= size / dirlen;
  dir.y *= size / dirlen;
  const nor = {x: -dir.y, y: dir.x};
}
```
Now we draw the crystal with a path, following the axis we created. The diagram
below marks each point in the order they are added to the path.

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

  const c = {x: 320, y: 90};
  svg.path({'stroke-width': 2, 'stroke': '#000', 'marker-end': 'url(#head)'})
    .M(c.x, c.y).l(size,0);
  svg.path({'stroke-width': 2, 'stroke': '#000', 'marker-end': 'url(#head)'})
    .M(c.x, c.y).l(0,-size);
  svg.text(c.x + 12, c.y + 12.5, "dir", {"font-family": "Open Sans", "font-size": "10px"});
  svg.text(c.x - 21, c.y - 14, "nor", {"font-family": "Open Sans", "font-size": "10px"});
{% endsvg %}

```op:renderCrystal+7,spawn:2

  ctx.beginPath();
  ctx.moveTo(a.x - dir.x, a.y - dir.y);
  ctx.lineTo(a.x + nor.x, a.y + nor.y);
  ctx.lineTo(b.x + nor.x, b.y + nor.y);
  ctx.lineTo(b.x + dir.x, b.y + dir.y);
  ctx.lineTo(b.x - nor.x, b.y - nor.y);
  ctx.lineTo(a.x - nor.x, a.y - nor.y);
  ctx.fill();
```

Finally, we create a gradient from `colorA` to `colorB` to fill the crystal,
that will go across the the path. The parameters for `createLinearGradient` are
the $0\%$ and $100\%$ position of the gradient that we are passing as out
control points. I.e., the colors at the control points will be exactly `colorA`
and `ColorB`.

```op:renderCrystal+7

  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, colorA);
  g.addColorStop(1, colorB);
  ctx.fillStyle = g;
```

@[canvas-demo]
```op:+
```

We are mostly there, but the render still looks a bit flat. We can fix that.
First, we are going to update our crystal with an extra parameter.

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

```op:render:,label:render,lens:render
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

Finally, instead of simply drawing one on top of the other, we can make the
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

And here we have our crystal render. Next up, let's add some more colors.

### colors

We start by picking some colors from the [Arne 16
Palette](https://lospec.com/palette-list/arne-16):
@[color-show]{"color":"rgb(190, 38, 51)"}
@[color-show]{"color":"rgb(224, 111, 139)"}
@[color-show]{"color":"rgb(73, 60, 43)"}
@[color-show]{"color":"rgb(164, 100, 34)"}
@[color-show]{"color":"rgb(235, 137, 49)"}
@[color-show]{"color":"rgb(247, 226, 107)"}
@[color-show]{"color":"rgb(47, 72, 78)"}
@[color-show]{"color":"rgb(68, 137, 26)"}
@[color-show]{"color":"rgb(163, 206, 39)"}
@[color-show]{"color":"rgb(0, 87, 132)"}
@[color-show]{"color":"rgb(49, 162, 242)"}
@[color-show]{"color":"rgb(178, 220, 239)"}. We are going to use them pair-wise
in sequence.

```op:init+4,label:color+1,lens:init+color
const COLORS = [
  [190, 38, 51],
  [224, 111, 139],
  [73, 60, 43],
  [164, 100, 34],
  [235, 137, 49],
  [247, 226, 107],
  [47, 72, 78],
  [68, 137, 26],
  [163, 206, 39],
  [0, 87, 132],
  [49, 162, 242],
  [178, 220, 239],
];
```

We create a simple function that returns the next color on this list and loops
back once it's over. We also start somewhere randomly. Notice that we return
the RGB array and not the final string color. This will allow us to manipulate
the values later on.

```op:++,label:color-14,lens:color
let CC = Math.floor(Math.random() * COLORS.length);
function nextColor() {
  CC = (CC + 1) % COLORS.length;
  return CC;
}
```

The first place to use this is when we construct our control points.

```op:crystal+13,lens:crystal
    color: nextColor(),
```

Now we should use the color for rendering. We use our utility `rgba()` function
to convert the RGB array into a CSS color string and pass that along to
`renderCrystal`.

```op:render+6:,lens:render
  ctx.globalAlpha = 0.5;
  const colorA = rgba(...COLORS[crystal.control[0].color]);
  const colorB = rgba(...COLORS[crystal.control[1].color]);
  const outer = 60 + 20 * (1 + crystal.pulse);
  renderCrystal(crystal.control[0].pos, crystal.control[1].pos,
    outer, colorA, colorB);
  ctx.globalAlpha = crystal.pulse;
  renderCrystal(crystal.control[0].pos, crystal.control[1].pos,
    outer * Math.abs(crystal.pulse), colorA, colorB);
}
```

One last thing. We haven't used the info that the control has bounced for
anything until now. Let's cycle the color when they do.

```op:update+11,lens:update

  for (const c of crystal.control) {
    if (!c.bounced) continue;
    c.bounced = false;
    c.color = nextColor();
  }
```

@[canvas-demo]
```op:+,lens:
```

Ouf. That was quite a bit of code. Remember that you can always play around
with the current code by pressing on the edit button on the corner.

### particles

The particle system is just a list of particles that are spawn at some time,
and eventually die off.

```op:+crystaldef+4,lens:crystaldef
const particles = [];
```

We are going to spawn particles in a similar way we spawned the control points.
The main difference is that our parameters will be somehow related to the
control point that spawned the particles.

```op:+bounce-1,label:newparticle+1,lens:newparticle

function newParticle(pos, vel, color) {
}
```

The particle's initial position is the same as the control point, and the
velocity is $[25\%,150\%]$ of the control point's velocity at a random angle.

```op:+newparticle+1
  const speed = Math.hypot(vel.x, vel.y) * (0.25 + 1.25 * Math.random());
  const vangle = Math.TAU * Math.random();

  return {
    pos: {x: pos.x, y: pos.y },
    vel: { x: speed * Math.cos(vangle), y: speed * Math.sin(vangle)},
  };
```

We want the particles to rotate, so we set an initial `angle` and a angular
velocity `rot`. We copy the color from the control point, and set its lifetime
to $[0, 1]$ seconds. Because we are going to reuse our `bounce()` function for
particle collision, we need to specify a radius. But since the particle will
change size over time, we will calculate this later.

```op:+newparticle+7
    angle: Math.TAU * Math.random(),
    rot: -4 + 8 * Math.random(),
    color: color,
    life: Math.random() * 1,
    radius: 0,
```

For the particles updates, we do the `pos` and `angle` updates with the simple
integration as we did for control points. We call `bounce()` to allow the
particles to bounce on the borders of the screen. This is surprisingly
effective to give the particles some "weight" and make them feel real.

```op:+bounce-1,label:update_particles+1,lens:this

function updateParticles(dt) {
  for (const p of particles) {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.angle += p.life * p.rot * dt;
    bounce(p);
  }
}
```

To implement the particle lifespan, we just reduce their lives and make the size
proportional to their remaining lives. This will make them fade away over time
and disappear.

```op:update_particles+6
    p.life -= dt;
    p.radius = 125 * p.life;
```

Once a particle reaches `live <= 0`, they have disappeared from the screen and
we should remove them from the particle list. We filter the array in place and
remove them.

```op:update_particles+9
  particles.filterIn(e => e.life > 0);
```

We want to spawn particles every time one of our controls bounce at something,
so we can just pig-back on the color-changing logic. We also must remember to
call our new `updateParticles()`.

```op:update+16:,lens:update

    for (let i = 0; i < 50; ++i) {
      particles.push(newParticle(c.pos, c.vel, c.color));
    }
  }

  updateParticles(dt);
}
```

Finally, we should render the particles. The particles will be rendered as
equilateral triangles.


```op:render-1,label:render_particles
function renderParticles() {
  for (const p of particles) {
  }
}
```

```op:render+5,lens:render_particles+render

  renderParticles();
```

Instead of rotating the points, we will translate, scale, and rotate the current
transformation matrix (that we usually call `CTM`) and always draw the same
triangle. This way, `canvas` will do the bulk of the work for us.


```op:render_particles+2,lens:render_particles
    ctx.fillStyle = rgba(...COLORS[p.color]);
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.scale(p.radius, p.radius);
    ctx.rotate(p.angle);
    ctx.restore();
```

It doesn't really matter in which direction we draw the triangle, so we might as
well draw the simplest way possible. We choose a triangle is perfectly
inscribed inside a circle of radius $1$.

```op:render_particles+7
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(Math.SQRT3 / 2, 0.5);
    ctx.lineTo(-Math.SQRT3 / 2, 0.5);
    ctx.closePath();
    ctx.fill();
```

@[canvas-demo]{}

### background

Now that the main effect is over, we can do small polishes to improve the demo.
The first thing we are doing for polish is updating the background. This is a
subtle effect: every time a control bounces, we will flash the background very
slightly into that color, which will give the impression the color is shining.

First things first, we are going to keep track of the background...

```op:init+3,lens:init
const BG = [16, 16, 16];
```

... and render it.

```op:render+2:1,lens:render
  ctx.fillStyle = rgba(...BG);
```

Then there's two things that will change `BG`. First, we are going to update its
value every time a control bounces to a darker version of the original color.

```op:update-1,label:update_bg,lens:update+update_bg
function updateBGWith(r, g, b) {
  BG[0] = 16 + 16 * (r / 255);
  BG[1] = 16 + 16 * (g / 255);
  BG[2] = 16 + 16 * (b / 255);
}
```

```op:update+16
    updateBGWith(...COLORS[c.color]);
```

Finally, we will dim down the background color over time. This makes the effect
instant much stronger, which helps the effect.

```op:update+24

  for (let i = 0; i < 3; ++i) {
    BG[i] = Math.max(16, BG[i] - 16 * dt);
  }
```

@[canvas-demo]
```op:+
```

There. It's a very subtle effect if you are trying to notice it, but if you
focus on the crystal, your brain will notice it and will make the crystal shine.

### shaking

Talking about subtleties, our final effect is not that. We are going to add
screen shaking when the control bounces. The process to implement it is going
to be very similar to the background.

First, we set up a state for it. There are two variables to define a shaking:
how much time we will be shaking and what's the direction of the screen
shaking.

```op:crystaldef+4,lens:crystaldef
let shaketime = 0.0;
let shakedir = {x: 0.0, y: 0.0};
```

We add shaking when there's bouncing. For the time, we want to acknowledge when
there's multiple bouncings happening, but we also don't want to make the effect
too long. The ideal direction would be normal to the contact point, but we
don't need this precision, so we simply take the opposite direction of the
current velocity, as this is a good proxy to the control's point velocity
before the collision. It's hand-wavy, but this is *shaking*, so it doesn't
matter.

```op:update+17,lens:update,spawn:2
    shaketime = Math.min(0.4, shaketime + 0.2);
    shakedir = {x: -c.vel.x / 4, y: -c.vel.y / 4};
```

```op:update+30

  shaketime = Math.max(0, shaketime - dt);
```

And finally we just apply the shaking as a simple translation before rendering
anything. The multiplication by `shaketime` is not strictly needed, but it
makes the shaking more nature, as it decays slowly its magnitude.

```op:render+5,lens:render

  if (shaketime > 0) {
    ctx.translate(
      shakedir.x * shaketime * Math.random(),
      shakedir.y * shaketime * Math.random());
  }
```

@[canvas-demo]
```op:+,lens:
```

Keeping things subtle makes them somehow more powerful, as they still add to
the scene without being strongly noticed.

And this is the final form of our bouncing crystal effect. As always, you can
open the [demo standalone]({{relativePath}}/effect.html) or click on the edit
button to play around the code at any stage of the article. Hack away.




