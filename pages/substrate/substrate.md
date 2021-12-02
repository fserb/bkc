---
title: substrate
layout: article
date: 2021-12-02
draft: true
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

The core algorithm of Substrate is: we keep track of a moving line, that, as it
draws a line on the screen, also registers its angle on a separate array. This
array, that we call the `grid`, is the core of Substrate algorithm.

Each line moves forward, writing down its angle, until it reaches the end of the
screen or if touches another line on the `grid`. When it stops, we spawn two
other moving lines. The only rule is that a new moving line must start
perpendicular to an existing line. That's it.

After that we will add a paint effect on top of the lines. Finally we will build
some color palettes and create different effects with the core Substrate
algorithm.


### the grid

We start, as always, assuming there's a `canvas` element available and doing a
simple `requestAnimationFrame`. Our animation will not be time-based, but
frame-based.

```add:
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
`update()` whether we want to continue the RAF or not.

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

When you have an abstract data structure, it's usually better to map it to the
operations you care about. In our case, we care about setting and getting
values from `x, y` positions. On both of them, we make sure we get the integer
positions and check for boundaries condition.

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


