/*
This is a collection of JS library extensions and help functions.
Some of them are injected into external objects (like Math, Array).
Others are just exported.
*/

/*
Tau is the correct circle constant.
https://tauday.com/tau-manifesto
*/
if (Math.TAU === undefined) {
  Math.TAU = Math.PI * 2;
}

if (Math.SQRT3 === undefined) {
  Math.SQRT3 = Math.sqrt(3);
}

/*
Limits the value of @x to be in the [@lower, @upper] interval.
*/
if (Math.clamp === undefined) {
  Math.clamp = function(x, lower, upper) {
    return x <= lower ? lower : (x >= upper ? upper : x);
  };
}

/*
In-place array filter.

The algorithm is: keep a index `j` of the position after the last valid element.
When we find a valid element, we copy it to the `j`th position and increment
`j`. In the end, resize the array to only contain `j` elements.
*/
if (Array.prototype.filterIn === undefined) {
  Array.prototype.filterIn = function(cond) {
    let j = 0;
    this.forEach((e, i) => {
      if (cond(e)) {
        if (i !== j) this[j] = e;
        j++;
      }
    });
    this.length = j;
    return this;
  };
}

/*
color manipulation library.
*/
import color from "./lib/color.js";
export {color};

/*
Convenient way to generate RGBA strings, while we wait for TypedOM Colors.
*/
export function rgba(r, g, b, a = 1.0) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/*
Return a random variable from a normal distribution with average 0 and stddev 1.
*/
export function normal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(Math.TAU * v);
}

export function gridRaystep(pos, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const dtX =
    cos != 0 ? (Math.floor(pos.x) + Math.sign(cos) - pos.x) / cos : Infinity;
  const dtY =
    sin != 0 ? (Math.floor(pos.y) + Math.sign(sin) - pos.y) / sin : Infinity;
  const t = Math.min(dtX, dtY);

  return {
    x: pos.x + t * cos,
    y: pos.y + t * sin
  };
}
