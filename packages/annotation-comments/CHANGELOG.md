# annotation-comments

## 1.0.0

### Major Changes

- a5b2179: First major release. Mainly to ensure that semver ranges work as expected, but hooray! 🎉

### Minor Changes

- a5b2179: Adds support for target ranges defined by matching `start`...`end` annotation comments. This allows you to annotate ranges of code without having to count lines or manually updating the ranges when the code changes.

  The following example shows how to define a simple target line range using the new feature:

  ```js
  // [!mark:start]
  function foo() {
    console.log('foo')
  }
  // [!mark:end]
  ```

  You can also combine `start`...`end` ranges with search queries, which limits the search to the range defined by the `start` and `end` annotation comments:

  ```js
  // [!mark:"log":start]
  function foo() {
    console.log('The words "log" will be marked both in the method call and this text.')
    console.log('Also on this line.')
  }
  // [!mark:"log":end]

  console.log('As this line is outside the range, "log" will not be marked.')
  ```

## 0.3.0

### Minor Changes

- f932f69: Adds the `cleanCode()` option `allowCleaning`.

  By default, `cleanCode()` will clean all annotation comments. If you set `allowCleaning` to a function, you can now control which annotation comments are cleaned.

  The function will be called once per annotation comment, and is expected to return a boolean to indicate whether the comment should be cleaned or not.

- f932f69: Renames the `cleanCode()` option `updateTargetRanges` to `updateCodeRanges`.

  The option was renamed because the function is now capable of updating all other code ranges referenced by the annotation comments (e.g. tag ranges, comment ranges, content ranges etc.) in addition to the target ranges.

  In combination with the `allowCleaning` and `removeAnnotationContents` options, this allows multi-step cleaning of the source code, where only a subset of annotation comments is cleaned in each step. This can be useful to create multiple versions of the source code, e.g. one for copying to the clipboard (where only the annotation tags are removed while keeping the rest of the annotation comments visible in the source code), and one for HTML output (where the entire annotation comments are removed so they can be rendered separately).

## 0.2.1

### Patch Changes

- b5267d9: Actually exports the `cleanCode()` function.

## 0.2.0

### Minor Changes

- a41c559: Adds `cleanCode()` functionality.
