---
title: Bouncing Crystal
layout: article
draft: true
---

This crystal effect with particles is inspired by [pixel's bouncing demo](https://github.com/faiface/pixel-examples/tree/master/community/bouncing) and it's actually pretty simple.

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


### as good as your tool

Before we start, let's spend some time writing support functions, mostly for
`Math` and `Array`.

One very useful thing to have around is a random function that follows a
[normal distribution](https://en.wikipedia.org/wiki/Normal_distribution). To
make things simple, we are going to use a normal distribution with mean $\mu =
0$ and variance $\sigma^2 = 1$.

The thing to remember about this function are the properties of the normal
distribution: it can return any value between $(-\infty,\infty)$. It's
symmetrical around $0$, there's $68.2\%$ of change of returning a value between
$[-1, 1]$, and only $0.2\%$ of chance of returning a value outside of $
[-3, 3]$.

To generate this, we are going to use the
[Box-Muller transform](https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform).
The details about how it works are not necessary, but since it uses a funny
idea, we are going to do a small detour to explain it. Feel free to skip it, as
it's not necessary for the rest of the article.

#### the Box-Muller transform

Image that we *have* a normal distribution available and used that to plot
points in a 2D graph (grabbing $x$ and $y$ from two independent normal
distributions). If we transform those points into polar coordinates
$(R, \Theta)$, then there's a way to produce uniformly distributed variables
based on those polar coordinates. Mathematically:

$$
\begin{aligned}
Z_0 = x = R\cos(\Theta) && Z_1 = y = R\sin(\Theta)
\end{aligned}
$$

where $Z_0$ and $Z_1$ are our independent normal distribution that we are
using as $(x, y)$ coordinates. We can then build:

$$
\begin{aligned}
R^2&= -2 \ln U_1 \\
\Theta&= 2\pi U_2
\end{aligned}
$$

where $U_1$ and $U_2$ will be uniformly distributed variables. Proving this will
be even more beyond the scope here, so I'll skip.

The importance of the transform for us is that it must also works in reverse:
given two uniform distributions of $U_1$ and $U_2$ we can grab two normal
distributions for $Z_0$ and $Z_1$. Mind. Blown:

$$
\begin{aligned}
&Z_0 = \sqrt{-2\ln U_1}\cos(2\pi U_2) \\
&Z_1 = \sqrt{-2\ln U_1}\sin(2\pi U_2)
\end{aligned}
$$

One thing we must be careful of is that the point $(0, 0)$ doesn't really have
an angle. As a convention, people use $\Theta = 0$, but that won't work for us,
so we need to change our uniform distribution to not include the zero.

Detour gone. Back to code.

#### Back to code

We will start with 2 variables ($U_1$ and $U_2$ above, `u` and `v` in the code).
that will contain uniform random values between $(0, 1)$. We need to take care of the
zero case. In theory, we shouldn't do it this way. In practice, life is short.

```
function normal() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
}
```

Now we simply calculate the normal as above. Since we only care about one
result, we will ignore the other variable.

```op:5
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(Math.TAU * v);
```

You might have noticed the use of `Math.TAU`, which is
[the correct circle constant](https://tauday.com/tau-manifesto) and defined as
$\tau = 2\pi$. And since we are at it, let's add another useful constant.

```op:1
Math.TAU = Math.PI * 2;
Math.SQRT3 = Math.sqrt(3);

```

It will be convenient to have a `clamp` function.

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
keep a index `j` that is the position after the last valid element. When we
find a valid element, we copy it the `j`position and increment `j`. In the end,
resize the array to only contain `j` elements.

```op:+,label:infilter+1

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

We will do our [usual boilerplate](fire), where we assume there's a `canvas` variable pointing to a valid canvas and.

```op:+

const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;

function frame(ts) {

  requestAnimationFrame(frame);
}
frame(0);
```

```op:infilter+1
  // ADDED!
```
