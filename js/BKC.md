BKC commands
============

Those commands control how BKC applies the `pre code` code into the current
state. In HTML they are passed by setting attributes on the `code` element,
like: `<code op="+" lens="this">`. In Markdown, they are defined as:

    ```op:+,spawn:2
    your code.
    ```

Those are the available commands, described on the markdown format, for HTML
everything before the first `:` is a attribute and everything after is data.

Those commands are currently not great. They grew organically as I needed to
describe certain operations. They are not consistent. They are not intuitive.

* `op` defines the operation on how to insert content into code. If not defined,
  behaves as empty.

  * `op:` replaces code with content.

  * `op:+` appends content at the end of the code.

  * `op:++` appends content after the last appended code.

  * `op:a` inserts content at location `a` where a can be one of:

    * a line number (`op:3`)
    * a line relative to the end of the code (`op:-4`)
    * a label (`op:ref`)
    * a label with a delta (`op:ref+4` or `op:ref-2`)

  * `op:a:b` replaces interval that starts at `a` with length `b` with content.
    Where `a` is as above and `b` is a number length.

  * `op:a:` replaces the whole location `a` with content.

* `spawn` defines how many block before the `pre code` this content refers to.
  Default is `spawn:1`.

  * `spawn:n` declares this code block as relevant to the previous `n`
    paragraphs.

* `label` defines one more location references. If ommited, nothing happens.

  * `label:a` defines the current content as label `a`.

  * `label:a+3` defines the label `a` as the current content starting at the 3rd
    line.

  * `label:a+2+4` defines `a` as start at the 2nd line of the current code, with
    length 4.

  * `label:a+0+1:b+4+2` defines `a` as the first line of current code and `b` as
    the lines 4-6.

* `lens` declares the range of lines that should be focused on. If ommited,
  repeat the last lens.

  * `lens:` resets the lens to the whole code.

  * `lens:this` sets the lens to the current snippet.

  * `lens:a` sets the lens to the label `a`.

  * `lens:a+b` sets the lens to the smallest continuous range that includes `a`
    and `b`.
