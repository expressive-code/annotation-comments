/*
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
*/

export function findAnnotationTargets() {
	// TODO: Implement findAnnotationTargets()
}
