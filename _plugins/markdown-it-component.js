// From https://github.com/ccorcos/markdown-it-component

// Process [component]{a:1, b:2}

// valid component name character
const componentNameRe = /[a-zA-Z]+-[a-zA-Z-]+/;

function component(state, silent) {
  const max = state.posMax;
  const start = state.pos;

  // Search for [
  if (state.src[start] !== "@" ||
      state.src[start + 1] !== '[') {
    return false;
  }

  // Search for ]
  state.pos += 2;
  while (state.pos < max && state.src[state.pos++] != ']');

  // Parse the component name
  const name = state.src.slice(start + 2, state.pos - 1);

  if (!componentNameRe.test(name)) {
    state.pos = start;
    return false;
  }

  let content = "{}";
  if (state.src[state.pos] === "{") {
    // Search for }
    const jsonStart = state.pos;
    state.pos++;

    let nest = 1;
    while (state.pos < max && nest > 0) {
      const char = state.src[state.pos++];
      if (char == '{') nest++;
      else if (char == '}') nest--;
    }

    // Parse JSON props.
    content = state.src.slice(jsonStart, state.pos);
  }

  let json = null;
  try {
    json = JSON.parse(content);
  } catch (e) {
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 1;

  if (!silent) {
    const token = state.push("component", name, 0);
    token.markup = "@[" + name + "]{" + content + "}";
    token.props = json;
  }

  state.pos = state.posMax;
  state.posMax = max;
  return true;
}

function attrValue(value) {
  let str = JSON.stringify(value);
  if (str[0] === '"') {
    str = str.slice(1);
  }
  if (str[str.length - 1] === '"') {
    str = str.slice(0, str.length - 1);
  }
  return str;
}

function render(options) {
  return function(tokens, idx, _options, env, self) {
    const token = tokens[idx];

    for (const k of Object.keys(token.props)) {
      const str = JSON.stringify(token.props[k]).replace(/^"(.*)"$/, '$1');
      token.attrPush([k, str]);
    }

    return self.renderToken(tokens, idx, _options, env, self) +
      `</${token.tag}>`;
  };
}

export default function(options) {
  return function(md) {
    md.inline.ruler.after("image", "component", component);
    md.renderer.rules["component"] = render(options || {});
  };
}
