/*
The simplest diff algorithm I can think of.
*/

export default function diff(a, b) {
  const frontier = {1: [0, []]};

  for (let d = 0; d <= a.length + b.length; ++d) {
    for (let k = -d; k <= d; k += 2) {
      let x, y, oldX, history;
      const goDown = (k == -d ||
        (k != d && frontier[k - 1][0] < frontier[k + 1][0]));
      if (goDown) {
        [oldX, history] = frontier[k + 1];
        x = oldX;
      } else {
        [oldX, history] = frontier[k - 1];
        x = oldX + 1;
      }
      history = [...history];
      y = x - k;

      if (1 <= y && y <= b.length && goDown) {
        history.push(["+", y - 1]);
      } else if (1 <= x && x <= a.length) {
        history.push(["-", x - 1]);
      }

      while (x < a.length && y < b.length && a[x] == b[y]) {
        x++;
        y++;
        history.push(["=", x - 1]);
      }

      if (x >= a.length && y >= b.length) {
        return history;
      }

      frontier[k] = [x, history];
    }
  }

  return null;
}
