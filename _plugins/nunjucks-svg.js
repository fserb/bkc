import { Base64 } from "https://deno.land/x/bb64@1.1.0/mod.ts";
import SVG from "./lib/SVG.js";

export default class NunjucksSVG {
  tags = ["svg"]

  constructor(dev) {
    this.dev = dev;
  }

  parse(parser, nodes, lexer) {
    // get the tag token
    const tok = parser.nextToken();

    // parse the args and move after the block end. passing true
    // as the second arg is required if there are no parentheses
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    // parse the body and possibly the error block, which is optional
    const body = parser.parseUntilBlocks('error', 'endsvg');
    const errorBody = null;

    if(parser.skipSymbol('error')) {
      parser.skip(lexer.TOKEN_BLOCK_END);
      errorBody = parser.parseUntilBlocks('endsvg');
    }

    parser.advanceAfterBlockEnd();

    // See above for notes about CallExtension
    return new nodes.CallExtension(this, 'run', args, [body, errorBody]);
  }

  run(context, width, height, body) {
    const svg = new SVG({width, height, viewBox: `0 0 ${width} ${height}`});
    Function("svg", '"use strict";' + body())(svg);
    let v;
    if (this.dev) {
      v = svg.render();
    } else {
      v = svg.renderOpt();
    }
    const b = Base64.fromString(v).toString();
    return `<img class="svg" src="data:image/svg+xml;base64,${b}">`;
  }
}
