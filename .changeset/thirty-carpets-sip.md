---
'annotation-comments': minor
---

Renames the `cleanCode()` option `updateTargetRanges` to `updateCodeRanges`.

The option was renamed because the function is now capable of updating all other code ranges referenced by the annotation comments (e.g. tag ranges, comment ranges, content ranges etc.) in addition to the target ranges.

In combination with the `allowCleaning` and `removeAnnotationContents` options, this allows multi-step cleaning of the source code, where only a subset of annotation comments is cleaned in each step. This can be useful to create multiple versions of the source code, e.g. one for copying to the clipboard (where only the annotation tags are removed while keeping the rest of the annotation comments visible in the source code), and one for HTML output (where the entire annotation comments are removed so they can be rendered separately).
