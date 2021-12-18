/*
Simple fuzzy string matcher.

It's a recursive gap length scorer. For each gap between letters, gap(len) is
called to compute the score. Gaps in the end of word are weighted by half.

It doesn't try to correct for letter swap, mistype, etc.
*/

/*
We cache each [string, abbr] pair score. Technically, we should use a LRU cache.
But in practice we delete the cache after using it, so no need to do anything
special.
*/
const cache = new Map();

export default function fuzzy(string, abbr) {
  if (abbr.length == 0) {
    return 1 - gap(string.length) * 0.5;
  }

  // we use \x1E as a separator.
  const key = `${string}\x1E${abbr}`;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const c = abbr[0];
  let idx = string.indexOf(c);
  let highScore = 0;

  while (idx >= 0) {
    const score = fuzzy(string.slice(idx + 1), abbr.slice(1)) - gap(idx);
    if (score > highScore) {
      highScore = score;
    }
    idx = string.indexOf(c, idx + 1);
  }

  cache.set(key, highScore);
  return highScore;
}

function gap(len) {
  return len == 0 ? 0 : 0.1 + 0.02 * len;
}

fuzzy._cache = cache;
