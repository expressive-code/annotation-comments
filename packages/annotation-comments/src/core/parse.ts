import type { AnnotationComment } from './types'
import { parseAnnotationTags } from '../internal/tag-parser'

export type ParseAnnotationCommentsOptions = {
	codeLines: string[]
	validateAnnotationName?: (name: string) => boolean
}

export function parseAnnotationComments(options: ParseAnnotationCommentsOptions): AnnotationComment[] {
	const { codeLines, validateAnnotationName } = options
	const annotationComments: AnnotationComment[] = []

	// Parse annotation tags
	const annotationTags = parseAnnotationTags({ codeLines })

	// Go through all tags and...
	// - Ensure that the current annotation tag has not been ignored by an ´ignore-tags` directive. If it has, it will skip the tag and continue searching
	// - If given, call the `validateAnnotationName` handler function to check if the annotation name is valid. If this function returns `false`, skip the tag and continue searching
	// - **Handle the current annotation tag if it's inside a single-line comment:** Try to find the beginning sequence of a single-line comment directly before the annotation tag, with no non-whitespace character before and after the beginning sequence. If found, it will:
	// 	- Mark the location of the beginning sequence as beginning of the comment
	// 	- Support chaining of single-line comments on the same line
	// 	- After the current annotation tag, look for a repetition of the same comment beginning sequence + annotation tag syntax. If found, this is a case of chaining, so mark the location of the next beginning sequence as the end of the current comment.
	// 	- If no chaining is found, mark the end of the line as the current end of the comment (this may change later)
	// 	- Add any text after the annotation tag until the current end of the comment to the annotation's **contents**
	// 	- If there was only whitespace before the beginning of the comment (= the comment was on its own line), and no chaining was detected (= end of comment matches end of line), try to expand the comment end location and annotation content to all subsequent lines until a line is found that either doesn't start with the same single-line comment beginning sequence (only preceded by optional whitespace characters), that starts with another valid annotation tag, or that has `---` as its only text content.
	// 	- End processing the current annotation tag and continue searching for the next one
	// - **Handle the current annotation tag if it's inside a multi-line comment:** No single-line comment was found, so now try to find a matching pair of beginning and ending sequence of a supported multi-line comment syntax around the match:
	// 	- Walk backwards, passing each character into an array of parser functions that are each responsible for one supported comment syntax. If a parser function returns a definite result, which can either be a match or a failure, stop calling this parser.
	// 	- In the JSDoc parser, on the first processed line, allow whitespace and require either a single `*` character or the opening sequence `/**` surrounded by whitespace to be present before the tag. If not, return a failure. If the opening is found, return a match. Otherwise, keep going with all previous lines and expect the same, except that there now can be arbitrary other content between the mandatory `*` and the beginning of the line.
	// 	- In all other parsers, on the first processed line, allow only whitespace or the opening sequence surrounded by whitespace to be present before the tag. If not, return a failure. If the opening is found, return a match. Otherwise, keep going with all previous lines, but now also allow other arbitrary content. If the beginning of the code is reached, return a failure.
	// 	- If none of the parsers returned a match, skip processing the current annotation tag and continue searching for the next one
	// 	- Otherwise, walk forwards, passing each character into a new array of parser functions that are each responsible for one supported multi-line comment syntax. If a parser function returns a definite result, which can either be a match or a failure, stop calling this parser.
	// 	- In the JSDoc parser, on the first processed line, allow arbitrary content or the closing sequence `*/` surrounded by whitespace. If the closing is found, return a match. Otherwise, keep going with all subsequent lines, and either expect whitespace followed by a mantatory `*` and then arbitrary content. If the closing sequence surrounded by whitespace is encountered at any point, return a match. If the end of the code is reached, return a failure.
	// 	- In all other parsers, just accept any content while looking for the closing sequence surrounded by whitespace on all lines. If it is found, return a match. If the end of the code is reached, return a failure.
	// 	- Now filter the backwards and forwards results, removing any non-pairs. If the opening and closing sequences of multiple pairs overlap, only keep the longest sequence (this ensures that we're capturing `{ /* */ }` instead of just the inner `/* */`). Finally, keep only the innermost pair.
	// 	- If no pair was found, skip processing the current annotation tag and continue searching for the next one
	// 	- Otherwise:
	// 	- Check rule "Comments must not be placed between code on the same line"
	// 		- If the comment starts and ends on the same line, and there is non-whitespace content both before and after the comment, skip processing the current annotation tag and continue searching for the next one
	// 	- Check rule "Comments spanning multiple lines must not share any lines with code"
	// 		- If the comment starts and ends on different lines, and there is non-whitespace content either before the start or after the end of the comment, skip processing the current annotation tag and continue searching for the next one
	// 	- Finish processing the current annotation tag and continue searching for the next one

	return annotationComments
}
