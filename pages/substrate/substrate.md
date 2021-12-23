---
title: Substrate
layout: article
date: 2021-12-21
nextPage: substrate/mask
---

In 2001, I learned about [Processing](https://processing.org/) and was amazed by
this new community of creative coders and generative programs. Shortly after,
[Jared Tarbell](https://www.infinite.center/) blew my mind with
[Substrate](http://www.complexification.net/gallery/machines/substrate/).

I remember seeing Substrate running and being overwhelmed by the movement and
complexity of it. I couldn't understand the code. I couldn't come to terms with
how a small piece of code could generate so much organized information. When I
started [Better Know Canvas](https://canvas.rocks), I knew I had to revisit
Substrate and write about it. So here it is. Let's code substrate again.


### the plan

The core algorithm of Substrate is: we keep track of a set of moving lines. Each
line, as it moves, draws a line on the screen, and also registers its angle on
a separate `grid`. Each line moves forward until it reaches the end of the
screen or until it touches another line on the `grid`. When it stops, it spawn
two other moving lines. The only rule is that a new moving line must start
perpendicular to a previous line in the `grid`. On top of that, each line paints a watercolor effect on one of its sides. And that's it.

After we implement the original effect, we are going to expand it by adding masks and create different types of images with it.


### the grid

We start, as always, assuming there's a `canvas` element available and doing a
simple `requestAnimationFrame`. Our animation will not be time-based, but
frame-based. I.e., we won't take time into account and therefore we will be frame rate dependent.


```add:,lens:edit
const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;

function frame() {
  requestAnimationFrame(frame);
}
frame();
```

We are going to hold the state of this effect in a class. Even though it won't
be a perfect encapsulation (as we will use the global `ctx` for rendering), this
will still allow us to experiment with the effect later on.

Since our effect builds up and then stops rendering, we will return from
`update()` whether we want to continue the RAF or not. This also means that we
will only end up cleaning the canvas once, and after that making each draw on
top of the previous one.

```sub:all+4,label:instance+6+1,spawn:2
class Substrate {
  update() {
    return false;
  }
}

const ss = new Substrate();

function frame() {
  if (ss.update()) {
    requestAnimationFrame(frame);
  }
}
frame();
```

We create our grid as a linear array that maps `1:1` to the canvas pixels. Each
value will eventually contain the angle of the passing line. We also need a
couple special values to identify empty values and invalid positions.


```add:#Substrate-1

const EMPTY = Infinity;
const INVALID = null;
```

```add:#Substrate+1,lens:#Substrate-3
  constructor() {
    this.grid = new Array(W * H);
    for (let i = 0; i < W * H; ++i) {
      this.grid[i] = EMPTY;
    }
  }

```

When you have an abstract data structure, it's often useful to hide it behind
operations you actually care about. In our case, we care about setting and
getting values from the `x, y` position. On both of them, we make sure we get
the integer positions and check for boundaries condition.

```add:#Substrate#update+3

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
```

We don't have anything to show yet, but this is all there's to the grid.


### the crack

We now build our moving line, called a `Crack`. A `Crack` has a starting
position and an angle. We also keep a reference to our main class (`ss`), as we
need access to the `grid`.

```add:#Substrate,lens:#Crack

class Crack {
  constructor(ss, x, y, angle) {
    this.ss = ss;
    this.angle = angle;
  }
}
```

Since we will be moving in a random direction on a grid, it will be useful to
have a function that marches in a given direction for square grids. It's simple
to move a position in a certain direction, but by how much should you move each
time? In the case you want to walk on a grid, if you move by too little, you
will end up doing a lot of unnecessary extra work (as multiple steps will be
redundant and fall on the same position). If you move by too much, you will end
up skipping certain positions and your path will be full of holes.

This can be solved by a generic function that returns the next optimal position
in a given direction. We are also going to need a function that returns a
normal distribution random value. Both of those functions are super
interesting, but we won't go in detail on how they work right now. Stay tuned
for a separate set of articles on them. For now let's just import them both.

```add:all+0,lens:all+0+5,spawn:2
const {gridRaystep, normal} =
  await import("{{baseURL}}/js/extend.js");

```

Back to our `Crack`. The first thing we do is come up with our next position, as
the current position will be occupied by the line that we originated from. In
the off-chance that we end up on top of another line, let's mark it, so we can
kill this crack on the next update.

```add:#Crack#const+3,lens:#Crack
    this.pos = gridRaystep({x, y}, this.angle);
    if (this.ss.get(this.pos.x, this.pos.y) === INVALID) {
      this.pos = null;
    }
```

The core of this class is a `move()` function that moves the `Crack` to the next
position, renders the line, and checks and updates the grid. It returns whether
this line is still alive or not.

```add:#Crack#const

  move() {
    if (this.pos === null) return false;
    const oldpos = this.pos;
    this.pos = gridRaystep(oldpos, this.angle);
  }
```

To render, instead of just adding the proper point on canvas, we are going to
render a couple of them, but nudging them a bit. This will make the line look a
bit more natural, like a pen writing.

```add:#Crack#move+4

    for (let i = 0 ; i < 2; ++i) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(
        this.pos.x + 0.33 * normal(),
        this.pos.y + 0.33 * normal(),
        1, 1);
    }
```

Finally, we need to check if we hit another line and update the `grid`. If we
hit an invalid position (i.e., out of bounds), or another line we stop.
Otherwise, update the grid with the line's angle and move on.

We need to be a bit careful here on which position to check on the grid. It
could be the case that our line is moving diagonally to the grid and jump from
position `(x, y)` to `(x + 1, y + 1)`. In this case, there's a chance it can
miss a collision and goes across another line. It's not the end of
the world, and we could just ignore the problem. But to avoid this, we will
check all positions from the old value to the new in a square, instead of just jumping to the final position.

We compute the delta in grid positions, and for each position in the square,
check if that position is either empty or part of our line. Finally, we update the `grid`.

```add:,spawn:3

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
```


### dynamics

The last part missing is the dynamics of the effect: how to create cracks, how
to set up the initial ones, how to update them over time, and when to stop.

```add:#Substrate#constructor+1,lens:#Substrate#constructor-1>#Substrate#constructor
    this.cracks = [];

```

Every time we need to create a new crack, we find a random place in the grid
that a lane has already passed on. The proper way to do this would be to keep a
list of all valid points. We could do that. Instead, we are going for the hacky
solution: try a random point in the grid and see if it's a valid part of a
line. If it's isn't, keep trying until you find one. In theory, this could lead
to an infinite loop, never finding a valid point. In practice, life is short.

```add:#Substrate#const,lens:#Substrate#constructor-1>#Substrate#newCrack

  newCrack() {
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
  }
```

Once we find a place, we need to choose an angle for it. We want to be
perpendicular to the original line, on either direction.

```add:last.-1

    const dir = Math.sign(Math.random() - 0.5);
    const angle = this.get(x, y) + dir * (Math.TAU / 4);
```

We can also add a bit of variety by wiggling the angle a bit.

```sub:last.-1
    const variance = this.angleVariance * normal();
    const angle = this.get(x, y) + dir * ((Math.TAU / 4) + variance);
```

```add:#Sub#const+2,spawn:4
    this.angleVariance = 0.025;
```

Once we have a position and an angle, we create the `Crack`.

```add:#Sub#newCrack.-1

    this.cracks.push(new Crack(this, x, y, angle));
```

Now it would be a good time to figure out the main loop, i.e., how the
`move()` function will be called and how `Cracks` are going to be stopped. We
are going to use the `cracks` array filter as our main loop.

```sub:#Sub#update,lens:#Sub#update
  update() {
    this.cracks.filterIn(c => {
    });
  }
```

For each crack, we call `move()`. If it returns `false`, it means the line
should stop, so we remove it from the array and pop up two new cracks.
Otherwise we keep it.

```add:last+2
      if (!c.move()) {
        this.newCrack();
        this.newCrack();
        return false;
      }
      return true;
```

In the end, we want to signal to `frame` that we want to keep on RAF while there
are still cracks left.

```add:last.+1
    return this.cracks.length > 0;
```

There's one more thing left before we can see the results: we need to set up an
initial condition. We can have a `begin()` function of the effect.

```add:instance+1,lens:instance+0+2
ss.begin();
```
We can start by cleaning the canvas.

```add:#Sub#const.,lens:this,spawn:3

  begin() {
    ctx.reset();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
  }
```

We are going to leave some random points on the grid with angles, to be caught
by the initial crack creation (remember that it randomly samples the grid until
it finds a point that is part of a line).

```add:#Sub#begin.-1,lens:#Sub#begin

    let k = 0;
    while (k < 16) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (this.get(x, y) !== EMPTY) continue;

      this.set(x, y, Math.random() * Math.TAU);
      k++;
    }
```

And then we are going to create a few cracks to start things up.

```add:last.,spawn:3

    for (let k = 0; k < 3; ++k) {
      this.newCrack();
    }
```

If we ran the code now, it would work mostly fine, except it would eventually
explode, as every crack creates two more cracks forever. To tackle this, we are
going to apply two limits to the system.

```add:,lens:#Sub#update
```

First, we are going to have a maximum number of simultaneous cracks allowed.

```add:#Sub#constr+3
    this.maxActiveCracks = 128;
```

```add:#Sub#newCrack+1,spawn:2,lens:#Sub#constr-1>#Sub#newCrack+0+4
    if (this.cracks.length >= this.maxActiveCracks) return;

```

And then we set a maximum number of total cracks that can ever be created.

```add:#Sub#constr+4
    this.totalCracks = 0;
    this.maxTotalCracks = 12000;
```

Once we reach this threshold, no new cracks are ever created. This allows the
whole effect to eventually stop.

```add:#Sub#newCrack+2
    if (this.maxTotalCracks > 0 && this.totalCracks >= this.maxTotalCracks) {
      return;
    }
```

```add:#Sub#newCrack.-1,spawn:7,lens:ctx
    this.totalCracks++;
```

@[canvas-demo]

```add:,lens:
```

### colors

We already have the core algorithm of Substrate down. Now it's time to add some
colors to it. There are three ways we can introduce color to the effect:
setting the background and line color, and also creating a watercolor-like
effect near the lines.

The first thing is to allow for line colors and an array for
potential paint colors.

```add:#Sub#constructor+11,lens:#Sub#constructor-1>#Sub#begin-1+0

    this.colors = null;
    this.lineColor = '#000000';
```

We will allow different background colors, so we can extract this from our
`begin()`.

```add:#Sub#constructor.

  clear(bgColor) {
    ctx.reset();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
  }
```

```sub:#Sub#begin+1+4,lens:#Sub#constr-1>#Sub#begin
```

We will also be random sampling from the available colors for each crack.

```add:#Substrate#get-1

  getColor() {
    if (this.colors === null) return null;
    return this.colors[Math.floor(Math.random() * this.colors.length)];
  }
```

```add:#Crack#constr.-1,lens:#Sub#getColor>#Crack#constr-1,spawn:7
    this.color = this.ss.getColor();
```

And how are using those colors? Well there are two ways: we are going to use the
new `lineColor` for lines and we are going to paint the region by the side of
the crack.

```sub:#Crack#move+5+2,lens:#Crack#move
    if (this.color !== null) {
      this.paintRegion();
    }

    for (let i = 0 ; i < 2; ++i) {
      ctx.fillStyle = this.ss.lineColor;
```

So how `paintRegion()` does the watercolor effect?

```add:#Crack#move.,lens:this

  paintRegion() {
  }
```

We want to draw a perpendicular line to the crack, that fades away and has
varying sizes, but that never passes through other cracks. This gives a very
paint-y feeling, as each color never passes the visual "box" that the lines
create.

We are going to draw this region as one line for each position of the crack
(i.e. each time this function is called). Our first step is to find, for the
current position, how far the paint can go (i.e., how much space we have until
we hit another crack.

To do this, we do a ray-tracing: we walk (with `gridRaystep()`) in a direction
perpendicular to the current crack ($\tau / 4 = 90\degree$) until we hit a
non-empty or invalid position. This will be our "maximum position", i.e., we now we have from our current `this.pos` all the way to `r` to draw, if we want to.

```add:#Crack#paintRegion+1
    let r = {...this.pos};
    while (true) {
      r = gridRaystep(r, this.angle + Math.TAU / 4);
      const v = this.ss.get(r.x, r.y);
      if (v === INVALID || v != EMPTY) break;
    }
```

We want to vary how far we will go on this max position, but instead of having
just a random value, we want this distance to smoothly vary over time. This
contributes to the watercolor effect, as different parts of the paint will
end in different places, but in a continuous way.

We keep track of how far to go on the maximum position

```add:#Crack#const.-2,lens:#Crack#const
    this.mod = 0.5 * Math.random();
```

and update it slightly every step.

```add:#Crack#paintRegion+7,lens:ctx,spawn:3

    this.mod = Math.clamp(this.mod + 0.05 * normal(), 0, 1.0);
```

We then find our final paint position (`t`) by moving into `r` direction by
`mod`.

```add:

    const t = {
      x: this.pos.x + (r.x - this.pos.x) * this.mod,
      y: this.pos.y + (r.y - this.pos.y) * this.mod
    };
```

This means we will draw a line from the current position `pos` to `t`.

```add:,spawn:5

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
```

The final piece missing is the color. We want to make the color to fade away
near the end of the stroke. For this, we can create a linear gradient with
alpha changing in power function ($a = 0.25(1 - f)^{0.25}$, where $f$ is the
fraction of the total line). @[color-show]{"grad":"#ffffff,#fbfbfb,#f6f6f6,#f1f1f1,#ececec,#e6e6e6,#e0e0e0,#dadada,#d3d3d3,#cbcbcb,#c2c2c2,#b7b7b7,#ababab,#9a9a9a,#828282,#000000"}.


```add:last-0

    const grad = ctx.createLinearGradient(this.pos.x, this.pos.y, t.x, t.y);
    const S = 5;
    for (let i = 0; i < S; ++i) {
      const f = i / (S - 1);
      const a = 0.25 * ((1 - f) ** 0.25);
      grad.addColorStop(f, this.color.alpha(a));
    }
    ctx.strokeStyle = grad;
```

You may notice the `color.alpha()`. This is part of the Color API we will be
using. It returns, as expected, the current color with alpha changed. We won't go in detail on how it works, but you can check its [source code](https://github.com/fserb/bkc/blob/master/js/lib/color.js) for now.

```sub:all+0+2,lens:this
const {gridRaystep, normal, Color} =
  await import("{{baseURL}}/js/extend.js");
```

We are almost ready to see the final result. The last thing we need to do
is to pick some initial color values.

```sub:instance+0+2,label:instance+3,lens:this
function basicEffect(ss) {
  ss.clear('#FFFFFF');
  ss.lineColor = '#3B2618';

  ss.begin();
}

const ss = new Substrate();
basicEffect(ss);
```

Apart from the background @[color-show]{"color":"#FFFFFF"} and line color @[color-show]{"color":"#3B2618"}, we want to have a distribution of
colors to draw the paint effect. The original Substrate effect used to sample
colors from an image. Instead of that, we are going to craft a range of colors.

We start with a basic yellow gradient @[color-show]{"grad":"#000000,#FFFF00"},
on which we will apply a series of transforms.

```add:#basicEffect+3
  const colors = Color('#000000').steps(256, '#FFFF00');
  for (let i = 0; i < colors.length; ++i) {
    const f = i / (colors.length - 1);
  }
  ss.colors = colors;
```

First we brighten the whole range to @[color-show]{"grad":"#000000, #58594D, #82836D, #A3A484, #BEC098, #D7D9A9, #ECEFBB, #FFFFFF"}.


```add:last+3
    colors[i] = colors[i].luminance(f ** 1.2)
```

We then crank up the saturation, using a `sin()` to make it non-uniform. @[color-show]{"grad": "#000000, #38382D, #565738, #6D6E39, #80813D, #90924E, #9EA06C, #ABAD82, #BABC65, #C9CA3F, #D6D615, #E0E130, #E8EA6A, #EFF2A6, #F9FBB2, #FFFFFF"}.

```add:
      .saturate(2 * Math.abs(Math.sin(f * 7)))
```

We rotate the hue with `cos()` to include some oranges, @[color-show]{"grad":"#000000, #37392E, #51583A, #6E6D39, #867F3A, #A08B48, #B8946B, #C6A184, #ECA36F, #FFA25B, #FFA25E, #FFB450, #FFCA72, #FFE3A3, #FFF5AD, #FFFFFF"}

```add:
      .rotate(-40 + 50 * (Math.cos(f * 5)))
```

and finally, we tint it with @[color-show]{"color":"#FFFF50"} to make the colors a bit more uniform @[color-show]{"grad":"#000000, #373925, #515830, #6E6D2E, #867F30, #A08B3C, #B89459, #C6A16E, #ECA35D, #FFA24C, #FFA24E, #FFB442, #FFCA60, #FFE38A, #FFF592, #FFFFD8"}.

```add:,spawn:7
      .multiply(Color('#FFFF0050'))
```

This builds up a reasonable palette, that gives this dirty ground look.

```add:,lens:
```

@[canvas-demo]

And there you have it. This was a bit long, but I hope it was still okey to
follow.

There is still some extra cool stuff that can be explored with this algorithm.
What if we play with masks or with the initial condition? In the next part, we
will do just that. For now, hack away.

