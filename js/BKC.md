BKC commands
============

Those commands control how BKC applies the `pre code` code into the current
state. In HTML they are passed by setting attributes on the `code` element,
like: `<code add="" lens="this">`. In Markdown, they are defined as:

    ```add:,lens:this
    your code.
    ```

Those are the available commands, described how they are specified in Markdown.
When translating, everything before the first `:` is an attribute and
everything after is the value.

* a `<range>` describes a continuous group of lines.

  * a range can be specified by `<label>` or `<label><delta>` or
    `<label><delta>+<len>`. Assuming a label `a` that goes from line 2 to 4.
      Examples:

    * `a` lines `[2, 3, 4]`.
    * `a+2` lines `[4]`.
    * `a-1` lines `[1, 2, 3, 4]`.
    * `a+1+1` lines `[3]`.

  * There are special labels:

    * `edit` the range of the current edited text
    * `last` the range of the last edited text
    * `this` the last created label (if any) or the same as `edit`
    * `all` the whole code content

  * you can reference the end of a range by appending `.` to the end label.

    * `last.-1` one line before the last edit.

* `add:<range>` appends the current code to the end of `<range>`. If no range
  is specified, it defaults to the last code.

* `sub:<range>` replaces `<range>` with the curreent code. If no range is
  specified, it defaults to the whole document.

* `label:<range>` defines one more location references, separated by `:`. If
  ommited, nothing happens.

  * Valid names are: `[a-zA-Z_][a-zA-Z0-9#_]*`. Names starting with `#` are
    reserved for auto-generated names. You can't use any of the special labels
    as names.

  * `label:a` defines the current edit as label `a`.
  * `label:a+2` defines label `a` as the current edit starting at the 2nd line.
  * `label:a+0+4` defines label `a` as the first 4 lines of the current edit.

* `spawn` defines how many block before the `pre code` this content refers to.
  Default is `spawn:1`.

  * `spawn:n` declares this code block as relevant to the previous `n`
    paragraphs.

* `lens:<range>` declares the range of lines that should be focused on. If
  ommited, repeat the last lens.

  * `lens:` resets the lens to the whole code.

  * `lens:this` sets the lens to the current edit.

  * `lens:a` sets the lens to the range `a`.

  * `lens:a>b` sets the lens to the smallest continuous range that includes `a`
    and `b`.

  * `lens:a&b` sets the lens to the (possible disjoint) range of `a` and `b`.
