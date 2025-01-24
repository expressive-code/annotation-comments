---
'annotation-comments': minor
---

Adds the `cleanCode()` option `allowCleaning`.

By default, `cleanCode()` will clean all annotation comments. If you set `allowCleaning` to a function, you can now control which annotation comments are cleaned.

The function will be called once per annotation comment, and is expected to return a boolean to indicate whether the comment should be cleaned or not.
