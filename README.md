# annotation-comments

> **Warning**: ⚠ This repository has just been made public and is still a work in progress. The documentation and code quality will be improved in the near future.
>
> As the API has not been finalized yet, we recommend waiting until this notice has been removed before attempting to use this package or contributing to it.

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

## Installation, Usage & API

For installation instructions, usage examples, and the full API documentation of the main library package, please refer to the [package's README](packages/annotation-comments/README.md).
