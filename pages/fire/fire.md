---
title: Fire Filter
layout: article
---

A simple fire effect, inspired by this [dwitter](https://www.dwitter.net/d/21204).

### boilerplate

The code always assume that we have a `canvas` variable pointing to a HTML
Canvas element. This usually comes from a `getElementById("myCanvas")` or from
`document.createElement("canvas")` that is inserted into the DOM.

Start by creating the 2D context and setting the canvas size. Remember that the
`canvas` size (width and height) refers to the internal canvas texture size. We
are still allowed to layout the CSS of the canvas independently. For our
effect, we are going to use `1080p`.

```
const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;
```

Create a `requestAnimationFrame` loop. The callback function will be called once
every frame (usually 60 times per second) with one parameter, which is a
monotonically increasing time in milliseconds.

```op:+

function frame(t) {
  requestAnimationFrame(frame);
}
frame(0);
```

### rectangular fire


So what we do each frame? First, we reset the canvas and clear it black. To
reset, we can use the new `reset()` function of Canvas 2D.

```op:6
  ctx.reset();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

```

To simulate our fire effect, we are going to render rectangular particles. The
rectangles will end up forming the flame that we will see. They are a better
choice than circles or squares, because they will add some verticality that
will make the fire more believable.

```op:10
  ctx.fillStyle = `rgb(255, 0, 0)`;
  ctx.fillRect(960, 1030, 30, 50);

```

We should have a bunch of them distributed on the canvas.

```op:10:2
  for (let i = 0; i < 2000; ++i) {
    ctx.fillStyle = `rgb(255, 0, 0)`;
    ctx.fillRect(960, 1030, 30, 50);
  }
```

We don't want to use a random function, because we want the fire to be
continuous over time. Random would make things jump all over the place and
that's probably not very fire-like. Alternatively, we could keep track of
individual particles, but let's try to avoid that for now.

On the `x axis`, we want the flame concentrated on the center of the canvas. We
can use a `sin()` function around the center and make the amplitude also vary.

```op:12:1
    ctx.fillRect(
      960 + Math.sin(i / 8) * i / 2,
      1030,
      30, 50);
```

On the `y axis` we want the flame to concentrate on the bottom, and then go up.
For a fire effect, we probably want something that goes faster the closer
it is to the top. A `tan()` function will do that.

```op:12:4
    ctx.fillRect(
      960 + Math.sin(i / 8) * i / 2,
      1030 - i * Math.tan(i ** 4),
      30, 50);
```

We can see what we got so far, and decide if the distribution looks reasonable.

```op:+
```
@[canvas-demo]

It does. There's a concentration of particles on the center bottom (i.e., the
source of the fire), and it goes up still a bit concentrated in the middle.

Let's add some fire color to it. We should vary the color from red (`rgb(255, 0,
0)`) to some tone of bright yellow (a lot of red, a lot of green and the blue
channel controlling the brightness).

We can also use the opportunity to make the yellow tones farther away, which will
add to the effect, as "bright red" flames will appear closer. We can do both
those things by parametrizing the color with the index.

```op:11:1,spawn:2
    ctx.fillStyle = `rgba(255, ${255 - i/8}, ${255 - i})`;
```

@[canvas-demo]

Finally, we need to animate the fire. For this, we are going to make the
position of each rectangle dependent of time. In general, we'd have to find a
way for the particles to come back, but since our `y` function has a periodic
part (`tan`), we are probably fine without any further modification.

Remember also that `requestAnimationFrame` passes the time in milliseconds. This
means, we need to divide by a big factor (in this case, going back to seconds)
for the number to be in the same order of magnitude as the index.

```op:14:1,spawn:2
      1030 - i * Math.tan(i ** 4 + t / 1000),
```

```op:+
```
@[canvas-demo]

Okey. This looks like a nice low poly fire. We could improve it by making the
top particles approach the middle as they go up, but let's leave at this for
now and move on to make it look a bit nicer.

### Through the right lens

We need to apply some filters to make our rectangles look more like proper fire.
But because we want to apply the filter on the whole image, we still need to do
some work.

In the near future, Canvas2D will support
[layers](https://github.com/fserb/canvas2D/blob/master/spec/layers.md) which
would make this super simple.

For now, we must create a temporary canvas to render this. There's nothing much
here: we create an `OffscreenCanvas` identical to the original canvas, and move
all our operations to it.

```
const ctx = canvas.getContext("2d");
const W = canvas.width = 1920;
const H = canvas.height = 1080;

const ofc = new OffscreenCanvas(W, H);
const octx = ofc.getContext("2d");

function frame(t) {
  octx.reset();
  octx.fillStyle = '#000';
  octx.fillRect(0, 0, W, H);

  for (let i = 0; i < 2000; ++i) {
    octx.fillStyle = `rgba(255, ${255 - i/8}, ${255 - i})`;
    octx.fillRect(
      960 + Math.sin(i / 8) * i / 2,
      1030 - i * Math.tan(i ** 4 + t / 1000),
      30, 50);
  }

  requestAnimationFrame(frame);
}
frame(0);
```

We then need to draw the temporary canvas back into the main one. Because we will
be using some filters that may create transparent areas, we should also clear
the canvas to black before drawing.

With this, we should get the exact same effect we had before.

```op:21,spawn:2
  ctx.reset();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(ofc, 0, 0);

```

```op:+
```
@[canvas-demo]

Now we are ready to add some filters to the final image. We are going to use the
new [CanvasFilter](https://github.com/fserb/canvas2D/blob/master/spec/filters.md)
API for that.

```op:24
  ctx.filter = new CanvasFilter([
  ]);
```

The first thing we will do is to blur the image. This will have the effect of
merging particles that are nearby and create little "fire areas".

```op:25
    {filter: "gaussianBlur", stdDeviation: 24},
```

@[canvas-demo]

This already looks much better, in spite of being very, well, blurry. To address
this we can apply a color matrix correction to increase the contrast, i.e.,
force areas to be either background or fire.

Technically, the `colorMatrix` is a $5x4$ matrix that gets applied as:

$$
\begin{bmatrix} r_1 \\ g_1 \\ b_1 \\ a_1 \end{bmatrix}
 =
\begin{bmatrix}
m_{rr} & m_{gr} & m_{br} & m_{ar} &m_{pr} \\
m_{rg} & m_{gg} & m_{bg} & m_{ag} &m_{pg} \\
m_{rb} & m_{gb} & m_{bb} & m_{ab} &m_{pb} \\
m_{ra} & m_{ga} & m_{ba} & m_{aa} &m_{pa} \\
\end{bmatrix}
\times
\begin{bmatrix} r_0 \\ g_0 \\ b_0 \\ a_0 \\ 1 \end{bmatrix}
$$

where $r_0g_0b_0a_0$ is the original color and $r_1g_1b_1a_1$ is the final
transformed color, all in the range $[0, 1]$ (instead of the more usual CSS
representation of $[0, 255]$).

For our purposes, we only need to focus on two things: the diagonal ($m_
{rr} \space m_{gg} \space m_{bb}$) will multiply each color component, while
the right column ($m_{pr} \space m_{pg} \space m_{pb}$) will add a constant to
each component.

So how can we use this to get our desired effect? We want to increase contrast
by saturating both ends of the spectrum. If we multiple the components by `4`
and subtract `1.5`, all values that are below $0.375$ (from $4x - 1.5 = 0$),
will end up as $0$ and all values above $0.625$ (from $4x - 1.5 = 1$), will end
up as $1$. This will fix the bluriness and make the fire pop out.

```op:26,spawn:5
    {filter:"colorMatrix", values: [
      4, 0, 0, 0, -1.5,
      0, 4, 0, 0, -1.5,
      0, 0, 4, 0, -1.5,
      0, 0, 0, 1, 0,
    ]},
```

```op:+
```
@[canvas-demo]

And here it is. The final fire effect with filters. You can see it [here in a standalone page with all the source code]({{relativePath}}/effect.html).

