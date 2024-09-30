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

## Usage

The following example shows how you can use this library to parse an annotated code snippet and extract the annotation comments from it:

```ts
import { parseAnnotationComments, cleanCode } from 'annotation-comments';

const code = `
// [!note] This is a note annotation.
console.log('Some code');
`;

const codeLines = code.trim().split(/\r?\n/);

const { annotationComments, errorMessages } = parseAnnotationComments({ codeLines });

cleanCode({ annotationComments, codeLines });
```

For an explanation of the options and return values of the `parseAnnotationComments` and `cleanCode` functions, see the [API section](#api).

## API

### parseAnnotationComments()

This function parses the given array of code lines to find all annotation comments and their targets.

It expects a single object argument with the following properties:

```ts
type ParseAnnotationCommentsOptions = {
  codeLines: string[],
}
```

Its return value is an object that contains both all parsed annotation comments and any error messages that occurred during parsing:

```ts
export type ParseAnnotationCommentsResult = {
  annotationComments: AnnotationComment[]
  errorMessages: string[]
}

type AnnotationComment = {
  tag: AnnotationTag
  contents: string[]
  commentRange: SourceRange
  commentInnerRange: SourceRange
  annotationRange: SourceRange
  contentRanges: SourceRange[]
  targetRanges: SourceRange[]
}

export type AnnotationTag = {
  name: string
  targetSearchQuery?: string | RegExp | undefined
  relativeTargetRange?: number | undefined
  rawTag: string
  range: SourceRange
}

export type SourceRange = {
  start: SourceLocation
  end: SourceLocation
}

export type SourceLocation = {
  line: number
  column?: number | undefined
}
```

### cleanCode()

This function prepares annotated code lines for display or copying to the clipboard by making it look like regular (non-annotated) code again.

It will collect all necessary edits and apply them to the code in reverse order (from the last edit location to the first) to avoid having to update the locations of all remaining annotations after each edit.

The function expects a single object argument with the following properties:

```ts
type CleanCodeOptions = {
  codeLines: string[]
  annotationComments: AnnotationComment[]
  removeAnnotationContents?: boolean | ((context: RemoveAnnotationContentsContext) => boolean)
  updateTargetRanges?: boolean
  handleRemoveLine?: (context: HandleRemoveLineContext) => boolean
  handleEditLine?: (context: HandleEditLineContext) => boolean
}

type RemoveAnnotationContentsContext = {
  comment: AnnotationComment
}

type HandleRemoveLineContext = {
  lineIndex: number
  codeLines: string[]
}

type HandleEditLineContext = {
  lineIndex: number
  startColumn: number
  endColumn: number
  newText?: string | undefined
  codeLines: string[]
}
```

#### Configuration options

Without any additional options, `cleanCode()` will modify the given code lines in place to remove all given annotation tags.

To change this behavior, you can provide the following additional options:

##### removeAnnotationContents

- Type: `boolean` \| `({ comment: AnnotationComment }) => boolean`
- Default: ``false``

When encountering annotation comments that have additional contents after the annotation tag, the default cleanup logic will remove the annotation tag, but keep the content. For example, `// [!note] Call the function` will become `// Call the function` after cleaning.

Setting this option to `true` allows you to remove the content as well. Alternatively, you can provide a handler function to determine the behavior for each annotation comment individually.

In any case, if a comment becomes empty through the cleanup process, it will be removed entirely.

##### updateTargetRanges

- Type: `boolean`
- Default: ``true``

If set to `true`, any annotation target ranges will be updated while cleaning to reflect the changes made to the code lines. This is useful if you want to use the target ranges for further processing after the code has been cleaned.

##### handleRemoveLine

- Type: `({ lineIndex: number; codeLines: string[] }) => boolean`
- Default: `undefined`

If given, this handler function will be called during the cleanup process for each line that is about to be removed from `codeLines`.

The handler can return `true` to indicate that it has taken care of the change and that the default logic (which edits the `codeLines` array in place) should be skipped.

##### handleEditLine

- Type: `({ lineIndex: number; startColumn: number; endColumn: number; newText: string; codeLines: string[] }) => boolean`
- Default: `undefined`

If given, this handler function will be called during the cleanup process for each inline edit that is about to performed in `codeLines`. The edit process replaces all text inside the column range from `startColumn` to `endColumn` with `newText`.

The handler can return `true` to indicate that it has taken care of the change and that the default logic (which edits the `codeLines` array in place) should be skipped.

## Annotation comment syntax

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

## Annotation comment usage guidelines

To be recognized by the parser, annotation comments must follow a set of guidelines. These guidelines ensure that the parser can accurately detect annotations in code snippets of any common language and are designed to prevent false positives as much as possible.

### All annotations must be placed inside comments

Comments are required to ensure that annotations cannot change the logic of your code, and that it remains valid and functional both in its annotated and non-annotated form.

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

## Troubleshooting

### Fixing an annotation comment that doesn't get parsed

If an annotation comment you've added to a code snippet does not get returned by the [`parseAnnotationComments()`](#parseannotationcomments) function, you can use the following checklist for troubleshooting:

- Does your annotation comment use the [correct syntax](#annotation-comment-syntax)?
- Does its placement in the surrounding code follow the [usage guidelines](#annotation-comment-usage-guidelines)?
- If the optional `validateAnnotationName` handler is used, does it return `true` for the annotation name you've used?

### Ignoring annotation comments in certain parts of your code

You may want to prevent certain annotation comments in your code from being processed. This can be useful if you're writing a guide about using annotation comments themselves, or if the heuristic used by `annotation-comments` incorrectly recognizes parts of your code as annotation comments.

To solve this, you can place the special annotation comment `[!ignore-tags]` on its own line before the annotation comments you want to ignore. The following variations are available:

- The base syntax `[!ignore-tags]` will ignore all tags on the next line.
- You can optionally specify the tag names to ignore, e.g. `[!ignore-tags:note,ins]` will ignore the next match of each tag name.
- You can optionally add a relative target range:
  - This will ignore all tags in the given amount of lines, e.g. `[!ignore-tags:3]` will ignore all tags on the next 3 lines.
  - If tag names were also specified, it will ignore a certain amount of matches, e.g. `[!ignore-tags:note:5]` will ignore the next 5 matches of the `note` tag.

Have a look at the following example, where a sequence that starts a single-line comment is contained inside a string:

```js
❌ Problem:
const code = 'Test: // [!note] This looks like an annotation comment to the parser, but removing it would break the code';

✅ Solution:
// [!ignore-tags]
const code = 'Test: // [!note] This just remains a string now as expected';
```

When passing the "Solution" code above to the [`parseAnnotationComments()`](#parseannotationcomments) function, the returned array will only contain the `ignore-tags` annotation comment, and no incorrectly parsed `note`.

Passing this array to the [`cleanCode()`](#cleancode) function will remove the `ignore-tags` annotation comment, resulting in clean working code.
