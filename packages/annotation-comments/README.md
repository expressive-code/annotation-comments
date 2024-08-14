# annotation-comments

This library provides functionality to parse and extract annotation comments from code snippets.

Annotation comments allow authors to annotate pieces of source code with additional information (e.g. marking important lines, highlighting changes, adding notes, and more) while keeping it readable and functional:

````mdx ignore-tags
```js
// [!note] The note explains the `console.log(...)` line
console.log('Some code');
// The next line will be marked as inserted
newCode(); // [!ins]
```
````

While this library was originally developed for the documentation tool [Expressive Code](https://expressive-code.com), the annotation comment syntax is designed to be compatible with Shiki's common transformer syntax and extend its functionality. It was intentionally decoupled from Expressive Code to allow other tools to use it as well.

## When should I use this?

Using this package directly is only recommended if you are building a custom documentation tool or want to integrate annotation comments into your own workflow.

If you are looking for a ready-to-use solution that uses this package to support annotation comments in code snippets, check out [Expressive Code](https://expressive-code.com) instead.

## Installation

```bash
npm install annotation-comments
```

## Parts of an annotation comment

Annotation comments consist of the following parts:

- The surrounding [comment syntax](#a-supported-comment-syntax-must-be-used) that ensures your code remains valid and functional both with and without the annotation comment.
- An [annotation tag](#annotation-tags) that defines the type of annotation and, optionally, the target of the annotation.
- Optional [annotation content](#annotation-content) to explain the targeted code to the reader, or to provide additional context. This content can span multiple lines.
- Optionally, the next annotation tag or special separator line `---` to [end multi-line content](#ending-multi-line-content), allowing multiple annotations and even regular comments to share the same comment block.

### Annotation tags

Annotation tags are the core of an annotation comment. They are used to define the type of annotation and, optionally, the target of the annotation.

Here are some example tags: `[!mark]`, `[!del:3]`, `[!ins:Astro.props]`

Annotation tags consist of the following parts:

- The **opening sequence** `[!`
- An **annotation name** registered by the installed plugins, e.g. `note`, `mark`, `ins`, etc.
  - For compatibility with the Shiki transformer syntax, the annotation name can optionally be prefixed by the word `code` and a space, e.g. `code note`, `code mark`, `code ins`, etc.
- An **optional target search query** preceded by a colon, with the following query types being available:
  - `:simple strings without quotes`
  - `:'single-quoted strings'` (useful to search for numbers that would otherwise be interpreted as target ranges, or terms that include special characters like `:` or `]`)
    - to escape the same type of quotes inside the string, use a backslash, e.g. `:'single-quoted strings with \'escaped quotes\''`
  - `:"double-quoted strings"` (see above)
  - `:/regex|regular expressions?/` (for complex search patterns)
- An **optional relative target range**, e.g. `:3`, `:-1`, `:0`, etc.
  - If present, it determines how many lines or target search query matches before or after the annotation are targeted
  - If omitted, the annotation targets only 1 line or target search query match. Depending on the location of the annotation, this may be above, below, or on the line containing the annotation itself
- The **closing sequence** `]`

### Annotation content

Annotation content allows you to add context, explanations, or other information to the annotation.

How this content is processed depends on the renderer provided by the plugin that registered the annotation. For example, the `note` annotation outputs the provided content in a "handwritten note" style alongside the targeted code to explain its purpose:

```js
// [!note] This is a note annotation.
console.log('Some code');

doTheThing(); // [!note] This does the thing!
```

#### Multi-line content

Annotation content can span multiple lines. To achieve this, you can either use a multi-line comment syntax for the annotation, or repeat the same single-line opening comment syntax on each new line:

```js ignore-tags
/*
  [!note] Annotation content inside multi-line comments
  can span multiple lines.

  It can also contain empty lines.
*/
console.log('Test');

// [!note] The same is true for single-line comments
// if they start on their own line and the opening
// comment syntax is repeated on each line like this.
console.log('Test');
```

Note that single-line comments must start on their own line to allow multi-line content. If the comment starts at the end of a line of code, it will be considered a single-line comment, and the annotation content will be limited to that line only.

This allows the following code to be rendered as expected, leaving the `// Output the result` comment intact in the rendered output:

```js ignore-tags
// Initialize the variable
let a = 1;
a++; // [!note] Note how we increment the variable
// Output the result
console.log(a);
```

#### Ending multi-line content

By default, multi-line content ends at the end of its parent comment block. However, it can end earlier in the following cases:

- A new annotation tag is encountered at the beginning of a new line

  This allows you to add multiple annotations in a natural way:

  ```js ignore-tags
  /*
    [!note] The log line below has a note and is inserted.
    [!ins]
  */
  console.log('Test');

  // [!note] This also works with single-line comments.
  // [!ins]
  console.log('Test');
  ```

- The special separator line `---` is encountered on a line by itself

  This allows regular comments to follow the annotation content:

  ```js ignore-tags
  /*
    [!ins]
    [!note] The log line below has a note and is inserted.
    ---
    This is a regular comment that will not get removed
    from the rendered output.
  */
  console.log('Test');

  /*
    Alternative:
    If you don't want to use the separator line, you can
    move your annotations to the end instead.
    [!ins]
    [!note] The log line below has a note and is inserted.
  */
  console.log('Test');
  ```

## Adding annotations to your code

To add annotations to your code, follow these guidelines:

### All annotations must be placed inside comments

This ensures that your code remains valid and functional, even if the annotation comments are removed during rendering.

### A supported comment syntax must be used

The `annotation-comments` library supports most popular programming languages, so you can use the comment syntax that feels best to you and matches your codebase.

Single-line comment syntaxes:

- `// ...` (JS, TS, Java, C, C++, C#, F#, Rust, Go, etc.)
- `# ...` (Python, Perl, Bash, PowerShell, etc.)
- `-- ...` (SQL, Lua, etc.)

Multi-line comment syntaxes:

- `/* ... */` (JS, TS, CSS, Java, C, C++, C#, Rust, Go, SQL, etc.)
- `/** ... */` (JSDoc, JavaDoc - the leading `*` of each new line gets stripped)
- `<!-- ... -->` (HTML, XML)
- `{/* ... */}` or `{ /* ... */ }` (JSX, TSX)
- `(* ... *)` (Pascal, ML, F#, etc.)
- `--[[ ... ]]` (Lua)

Tip: Although `annotation-comments` allows you to use any of the supported comment syntaxes regardless of the actual language of your code snippet, it is still recommended to use the proper syntax to ensure that your plaintext code remains valid.

Note: Accurately detecting single-line and multi-line comments in all supported programming languages is hard. Using full-blown language parsers would significantly slow down processing and increase the bundle size. To avoid this, `annotation-comments` uses a simpler heuristic to check for a surrounding comment whenever a valid annotation tag is found.

### Annotation tags must be placed at the beginning

- In comments on a single line, the [annotation tag](#annotation-tags) must be placed at the beginning of the comment:

  ```js
  ✅ Recognized:
  // [!note] A note in a single-line comment
  /* [!note] Using multi-line syntax on a single line */

  ❌ Unrecognized:
  // Here, the tag is not at the beginning [!note]
  // - [!note] This also doesn't work due to the dash
  ```

- In multi-line comments, the annotation tag can also be placed at the beginning of any new line inside the comment:

  ```js
  ✅ Recognized:
  /*
    ...some comment contents that are not part of the annotation...
    [!ins]
    [!note] This is a note annotation.
  */
  
  ✅ Recognized:
  /**
   * JSDoc-style comments are also supported.
   * [!note] This is a note annotation.
   */

  ❌ Unrecognized:
  /*
    ...some other text... [!note] This does not work.
  */
  ```

### Annotation tags must be surrounded by whitespace

- Both before and after the annotation tag, there must either be whitespace or the beginning or end of the line:

  ```js
  ✅ Recognized:
  // [!note] One whitespace before and after the tag is great
  //   [!note] You can also use more, either before...
  // [!note]   ...or after the tag

  ❌ Unrecognized:
  //[!note] The tag must not touch the comment delimiter
  // [!note]The content must not touch the tag either
  ```

### Comments and code on the same line must be separated by whitespace

- If a line contains both an annotation comment and code, there must be at least one whitespace character between them:

  ```js
  ✅ Recognized:
  console.log('Some code'); // [!note] At the end of a code line
  console.log('More code'); /* [!note] Multi-line syntax also works */

  ✅ Recognized:
  /* [!ins] */ console.log('This line will be marked as inserted');

  ❌ Unrecognized:
  console.log('Some code');// [!note] Too close, it touches the code
  /* [!note] This also touches the code -> */console.log('More code');
  ```

### Single-line comments can be chained on the same line

- Although discouraged, it is possible to add multiple annotations on the same line by repeating the opening comment syntax. This feature is only present for compatibility with Shiki's common transformer syntax:

  ```js
  🤔 Discouraged:
  console.log('Hello'); // [!ins] // [!note] This works, but is hard to read

  🤔 Discouraged:
  // [!note] This also works, but is hard to read // [!ins]
  console.log('Hello');

  ✅ Recommended:
  // [!ins]
  // [!note] We recommend placing annotations on their own lines above the code
  console.log('Hello');

  ✅ Recommended:
  // [!note] You can also put one annotation above and one after the code,
  // which is still more readable than chaining them on the same line
  console.log('Hello'); // [!ins]

  ❌ Incorrect:
  console.log('Hello'); // [!note] [!ins] This is all part of the note content
  // [!ins] [!note] And this will be ignored as `ins` does not render content
  console.log('Hello');
  ```

  **Warning:** Using this syntax is discouraged as it can be hard to read and does not look syntactically correct. We recommend placing each annotation on its own line instead.

### Comments must not be placed between code on the same line

- If annotation comments share their line with code, they must either be placed at the beginning or end of the line, but not in the middle:

  ```js
  ✅ Recognized:
  console.log('Some code'); // [!note] At the end of a code line
  console.log('More code'); /* [!note] Multi-line syntax also works */

  ✅ Recognized:
  /* [!ins] */ console.log('This line will be marked as inserted');

  ❌ Unrecognized:
  thisDoes( /* [!note] Code on both sides is not allowed */ ).notWork();
  ```

  This rule improves the heuristic comment detection and prevents false positives, especially in combination with strings.

### Comments spanning multiple lines must not share any lines with code

- When writing comments that use a multi-line comment syntax and actually span multiple lines, the comment must start and end on a line that does not contain any code:

  ```js
  ✅ Recognized:
  /*
    [!note] This is a multi-line comment
    that actually spans multiple lines
  */
  console.log('Some code');

  ✅ Recognized:
  /* [!note] Another multi-line comment
  that actually spans multiple lines */
  console.log('More code');

  ❌ Unrecognized:
  console.log('Nope'); /* [!note] This is not supported
  because the first comment line also contains code */

  ❌ Unrecognized:
  /* [!note] The last comment line must not contain
  any code either */ console.log('Also nope');
  ```

  This rule also improves the heuristic comment detection and prevents false positives.

## Processing logic

```ts
import { parseAnnotationComments } from 'annotation-comments';

const code = `
// [!note] This is a note annotation.
console.log('Some code');
`;

const codeLines = code.trim().split(/\r?\n/);

const annotationComments = parseAnnotationComments({
  codeLines,
  validateAnnotationName: (name) => name === 'note',
});

removeAnnotationComments({
  annotationComments,
  codeLines,
  updateTargetRanges: true,
});
```

### parseAnnotationComments()

This function is the main entry point for processing annotation comments in code snippets.

It takes the following parameters:

```ts
type ParseAnnotationCommentsOptions = {
  codeLines: string[],
  validateAnnotationName?: (name: string) => boolean,
}
```

Its return value is an array of `AnnotationComment` objects:

```ts
type AnnotationComment = {
  name: string,
  targetSearchQuery?: string,
  relativeTargetRange?: number,
  rawTag: string,
  contents: string[],
  commentRange: SourceRange,
  tagRange: SourceRange,
  contentRanges: SourceRange[],
  targetRanges: SourceRange[],
}

type SourceRange = {
  startLine: number,
  endLine: number,
  // For inline ranges, startCol and endCol are also set
  startCol?: number,
  endCol?: number,
}
```

The function follows these steps to process the code:

#### Step 1: Parsing the code to find all annotation comments

- The function goes through the given code line by line, looking for strings that match the annotation comment syntax. If a match is found, it will:
  - Extract the annotation name, optional target search query, and optional relative target range from the annotation tag
  - Ensure that the current annotation tag has not been ignored by an ´ignore-tags` directive. If it has, it will skip the tag and continue searching
  - If given, call the `validateAnnotationName` handler function to check if the annotation name is valid. If this function returns `false`, skip the tag and continue searching
  - **Handle the current annotation tag if it's inside a single-line comment:** Try to find the beginning sequence of a single-line comment directly before the annotation tag, with no non-whitespace character before and after the beginning sequence. If found, it will:
    - Mark the location of the beginning sequence as beginning of the comment
    - Support chaining of single-line comments on the same line
      - After the current annotation tag, look for a repetition of the same comment beginning sequence + annotation tag syntax. If found, this is a case of chaining, so mark the location of the next beginning sequence as the end of the current comment.
      - If no chaining is found, mark the end of the line as the current end of the comment (this may change later)
    - Add any text after the annotation tag until the current end of the comment to the annotation's **contents**
    - If there was only whitespace before the beginning of the comment (= the comment was on its own line), and no chaining was detected (= end of comment matches end of line), try to expand the comment end location and annotation content to all subsequent lines until a line is found that either doesn't start with the same single-line comment beginning sequence (only preceded by optional whitespace characters), that starts with another valid annotation tag, or that has `---` as its only text content.
    - End processing the current annotation tag and continue searching for the next one
  - **Handle the current annotation tag if it's inside a multi-line comment:** No single-line comment was found, so now try to find a matching pair of beginning and ending sequence of a supported multi-line comment syntax around the match:
    - Walk backwards, passing each character into an array of parser functions that are each responsible for one supported comment syntax. If a parser function returns a definite result, which can either be a match or a failure, stop calling this parser.
      - In the JSDoc parser, on the first processed line, allow whitespace and require either a single `*` character or the opening sequence `/**` surrounded by whitespace to be present before the tag. If not, return a failure. If the opening is found, return a match. Otherwise, keep going with all previous lines and expect the same, except that there now can be arbitrary other content between the mandatory `*` and the beginning of the line.
      - In all other parsers, on the first processed line, allow only whitespace or the opening sequence surrounded by whitespace to be present before the tag. If not, return a failure. If the opening is found, return a match. Otherwise, keep going with all previous lines, but now also allow other arbitrary content. If the beginning of the code is reached, return a failure.
    - If none of the parsers returned a match, skip processing the current annotation tag and continue searching for the next one
    - Otherwise, walk forwards, passing each character into a new array of parser functions that are each responsible for one supported multi-line comment syntax. If a parser function returns a definite result, which can either be a match or a failure, stop calling this parser.
      - In the JSDoc parser, on the first processed line, allow arbitrary content or the closing sequence `*/` surrounded by whitespace. If the closing is found, return a match. Otherwise, keep going with all subsequent lines, and either expect whitespace followed by a mantatory `*` and then arbitrary content. If the closing sequence surrounded by whitespace is encountered at any point, return a match. If the end of the code is reached, return a failure.
      - In all other parsers, just accept any content while looking for the closing sequence surrounded by whitespace on all lines. If it is found, return a match. If the end of the code is reached, return a failure.
    - Now filter the backwards and forwards results, removing any non-pairs. If the opening and closing sequences of multiple pairs overlap, only keep the longest sequence (this ensures that we're capturing `{ /* */ }` instead of just the inner `/* */`). Finally, keep only the innermost pair.
    - If no pair was found, skip processing the current annotation tag and continue searching for the next one
    - Otherwise:
      - Check rule "Comments must not be placed between code on the same line"
        - If the comment starts and ends on the same line, and there is non-whitespace content both before and after the comment, skip processing the current annotation tag and continue searching for the next one
      - Check rule "Comments spanning multiple lines must not share any lines with code"
        - If the comment starts and ends on different lines, and there is non-whitespace content either before the start or after the end of the comment, skip processing the current annotation tag and continue searching for the next one
      - Finish processing the current annotation tag and continue searching for the next one

#### Step 2: Finding the targets of all annotations

- Now, the function goes through all identified annotation comments and does the following:
  - If the annotation has **no relative target range** given, automatically determine it:
    - If the annotation has **no target search query**, it attempts to target full lines:
      - If the **annotation comment is on the same line as content** (= annotation start line contains content other than whitespace or other annotation comments), the target range is the annotation comment line.
      - Otherwise, find the first line above and first line below that don't fully consist of annotation comments
        - If the **line below has content**, it is the target range.
        - Otherwise, if the **line above has content**, it is the target range.
        - Otherwise (**both lines are empty**), there is no target range (same as the relative range `:0`).
    - Otherwise, the annotation **has a target search query**, so determine the search direction:
      - If the **annotation comment is on the same line as content** (= annotation start line contains content other than whitespace or other annotation comments), the direction depends on where the content is in relation to the comment.
      - Otherwise, find the first line above and first line below that don't fully consist of annotation comments
        - If the **line above has content** and the **line below is empty**, the relative range is `:-1`.
        - Otherwise, the relative range is `:1`.
  - If a target search query is present, **perform the search** to determine the target range(s):
    - The target search query can be a simple string, a single-quoted string, a double-quoted string, or a regular expression. Regular expressions can optionally contain capture groups, which will then be used to determine the target range(s) instead of the full match.
    - The search is performed line by line, starting at the start or end of the annotation comment and going in the direction determined by the relative target range that was either given or automatically determined as described above.
    - Before searching a line for matches, all characters that lie within the `outerRange` of any annotation comment are removed from the line. If matches are found, the matched ranges are adjusted to include the removed characters.
    - Each match is added to the `targetRanges` until the number of matches equals the absolute value of the relative target range, or the end of the code is reached.
    - In the case of regular expressions with capture groups, a single match can result in multiple target ranges, one for each capture group.

### removeAnnotationComments()

This function can be used to remove the parsed annotation comments from the code lines. You can either let it perform the edits in the given code lines array, or provide custom handlers to control the removal process.

It takes the following parameters:

```ts
type RemoveAnnotationCommentsOptions = {
  annotationComments: AnnotationComment[],
  codeLines: string[],
  updateTargetRanges?: boolean,
  handleRemoveLine?: ({
    commentBeingRemoved: AnnotationComment
    codeLines: string[]
    lineIndex: number
  }) => boolean,
  handleRemoveInlineRange?: ({
    commentBeingRemoved: AnnotationComment
    codeLines: string[]
    lineIndex: number
    startCol: number
    endCol: number
  }) => boolean,
}
```

All edits will be carried out in reverse order (from the last annotation comment to the first) to avoid having to update the locations of all remaining annotations after each edit.

If the optional property `updateTargetRanges` is set to `true`, the target ranges of the annotations will be updated to reflect the changes made to the code lines. This is useful if you want to use the target ranges for further processing after the annotations have been removed.

If given, the optional handlers `handleRemoveLine` and `handleRemoveInlineRange` will be called during the removal process. They can return `true` to indicate that the default removal logic (which edits the given `codeLines` array in place) should be skipped for the current line or inline range.

The logic used to determine the edits is as follows:

- If the comment was ended by the special `---` terminator line, include it in the outer range to be removed
- Remove the entire outer range of the comment from the source code
- Remove any now trailing whitespace from the line where the comment started
- If removal of the comment caused the starting line to be empty, remove it as well
- If the comment ended on a different line, and its removal caused the ending line to be empty, remove it as well

## Troubleshooting

### Fixing an annotation that doesn't get processed

If an annotation you've added to your code does not get processed by `annotation-comments`, check if the following conditions are met:

- Does your annotation tag use the [correct syntax](#annotation-tags)?
- Is your annotation tag placed inside a comment that [follows the guidelines](#adding-annotations-to-your-code)?
- If the optional `validateAnnotationName` handler is used, does it return `true` for the annotation name you've used?

### Opting out of annotation processing

You may want to prevent `annotation-comments` from processing annotation comments in certain parts of your code. This can be useful if you're writing a guide about using annotation comments themselves, or if the heuristic used by `annotation-comments` incorrectly recognizes parts of your code as annotation comments.

To opt out, insert a new line in your code that only contains the special tag `[!ignore-tags]` in a comment:

- The base syntax `[!ignore-tags]` will ignore all tags on the next line.
- You can optionally specify the tag names to ignore, e.g. `[!ignore-tags:note,ins]` will ignore the next match of each tag name.
- You can optionally add a relative target range:
  - This will ignore all tags in the given amount of lines, e.g. `[!ignore-tags:3]` will ignore all tags on the next 3 lines.
  - If tag names were also specified, it will ignore a certain amount of matches, e.g. `[!ignore-tags:note:5]` will ignore the next 5 matches of the `note` tag.

Have a look at the following example, where a sequence that starts a single-line comment is contained inside a string:

```js
❌ Problem:
const code = 'Test: // [!note] Looks like a comment, gets removed and breaks the code';

✅ Solution:
// [!ignore-tags]
const code = 'Test: // [!note] This just remains a string now as expected';
```
