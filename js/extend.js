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
  }
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
  }
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
