---
'annotation-comments': minor
---

Adds support for target ranges defined by matching `start`...`end` annotation comments. This allows you to annotate ranges of code without having to count lines or manually updating the ranges when the code changes.

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
