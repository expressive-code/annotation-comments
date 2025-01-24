# annotation-comments

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
