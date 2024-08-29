import type { AnnotationComment, AnnotationTag, SourceRange } from '../core/types'

export type ParseParentCommentOptions = {
	codeLines: string[]
	tag: AnnotationTag
}

const singleLineCommentRegex = new RegExp(
	[
		// Either the beginning of the line or required whitespace (captured)
		'(^|\\s+)',
		// Any of the supported single-line comment syntaxes (captured)
		'(//|#|--)',
		// Required whitespace (captured)
		'(\\s+)',
	].join(''),
	'g'
)

/**
 * Attempts to find and parse a single-line or multi-line comment that the given annotation tag
 * is located in. Supports comment syntaxes of most popular languages.
 *
 * **Note:** As accurately detecting comments in all languages (including those embedded
 * in document languages like HTML, Markdown, MDX etc.) would be a very complex and slow task,
 * this function uses language-agnostic, pattern-based heuristics instead of full parsing.
 * See the documentation for more information on possible edge cases and their solutions.
 *
 * @returns If a comment was found, returns its source location, content ranges and text contents.
 */
export function parseParentComment(options: ParseParentCommentOptions): AnnotationComment | undefined {
	const { codeLines, tag } = options

	const tagLineIndex = tag.range.start.line
	const tagLine = codeLines[tagLineIndex]
	const tagEndColumn = tag.range.end.column ?? tagLine.length

	// Check the annotation tag line for known single-line comment syntaxes
	const singleLineCommentSyntaxMatches = [...tagLine.matchAll(singleLineCommentRegex)].map((match) => ({
		startColumn: match.index,
		endColumn: match.index + match[0].length,
		syntax: match[2],
	}))
	// If matches were found, check if any of them ends right before the annotation tag
	// (as required by the annotation comments syntax)
	const singleLineCommentSyntax = singleLineCommentSyntaxMatches.find((match) => match.endColumn === tag.range.start.column)
	if (singleLineCommentSyntax) {
		// We found a single-line annotation comment, so start collecting its details
		const comment: AnnotationComment = {
			tag,
			contents: [],
			commentRange: {
				start: { line: tagLineIndex },
				end: { line: tagLineIndex },
			},
			contentRanges: [],
			targetRanges: [],
		}
		// If there is code before the comment, remember the comment start column
		// to avoid deleting the entire line when removing the comment
		if (tagLine.slice(0, singleLineCommentSyntax.startColumn).trim() !== '') {
			comment.commentRange.start.column = singleLineCommentSyntax.startColumn
		}
		// For common Shiki transformer syntax compatibility, support chaining multiple
		// single-line annotation comments on the same line
		const chainedSingleLineCommentSyntax = singleLineCommentSyntaxMatches.find(
			(match) =>
				// The new comment must start after the current tag...
				match.startColumn >= tagEndColumn &&
				// ...it must use the same single-line comment syntax...
				match.syntax == singleLineCommentSyntax.syntax &&
				// ...and it must be followed by another annotation tag opening sequence
				tagLine.slice(match.endColumn).startsWith('[!')
		)
		if (chainedSingleLineCommentSyntax) {
			comment.commentRange.end.column = chainedSingleLineCommentSyntax.startColumn
		}
		// If there is any non-whitespace content between the end of the annotation tag
		// and the current end of the comment, add it to the contents and contentRanges arrays
		const tagLineContent = getNonWhitespaceContentInLine({ codeLines, lineIndex: tagLineIndex, startColumn: tagEndColumn, endColumn: comment.commentRange.end.column })
		if (tagLineContent) {
			comment.contents.push(tagLineContent.content)
			comment.contentRanges.push(tagLineContent.contentRange)
		}
		// If there was only whitespace before the beginning of the comment,
		// and no chaining was detected, try to expand the comment end location
		// and annotation content to subsequent comment lines
		if (tagLine.slice(0, singleLineCommentSyntax.startColumn).trim() === '' && !chainedSingleLineCommentSyntax) {
			for (let lineIndex = tagLineIndex + 1; lineIndex < codeLines.length; lineIndex++) {
				const line = codeLines[lineIndex]
				const commentStart = line.search(/\S/)
				// Stop if the line doesn't start with the same single-line comment syntax
				// plus at least one whitespace character or the end of the line
				const possibleContentStart = commentStart + singleLineCommentSyntax.syntax.length + 1
				const expectedCommentSyntaxPart = line.slice(commentStart, possibleContentStart)
				if (expectedCommentSyntaxPart.trimEnd() !== singleLineCommentSyntax.syntax) break
				// Extract the non-whitespace content of the line
				const lineContent = getNonWhitespaceContentInLine({ codeLines, lineIndex, startColumn: possibleContentStart })
				if (lineContent) {
					// Stop if the line has `---` as its only text content
					if (lineContent.content === '---') {
						// Make the line part of the comment, but don't add its content
						comment.commentRange.end = { line: lineIndex }
						break
					}
					// Stop if the line starts with an annotation tag opening sequence `[!`
					if (lineContent.content.startsWith('[!')) break
					// Otherwise, add the content and expand the comment range
					// to cover the additional full line
					comment.contents.push(lineContent.content)
					comment.contentRanges.push(lineContent.contentRange)
					comment.commentRange.end = { line: lineIndex }
				} else {
					// Comment lines without content are allowed, so an empty string to the content
					// and expand the comment range to cover the additional full line
					const column = Math.min(possibleContentStart, line.length)
					comment.contents.push('')
					comment.contentRanges.push({ start: { line: lineIndex, column }, end: { line: lineIndex, column } })
					comment.commentRange.end = { line: lineIndex }
				}
			}
		}

		return comment
	}

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

	return undefined
}

/**
 * Attempts to find non-whitespace content in the given line within the specified column range.
 *
 * If found, returns the content and its source range.
 */
function getNonWhitespaceContentInLine(options: {
	codeLines: string[]
	lineIndex: number
	startColumn?: number | undefined
	endColumn?: number | undefined
}): { content: string; contentRange: SourceRange } | undefined {
	const { codeLines, lineIndex, startColumn = 0, endColumn } = options
	const outerContent = codeLines[lineIndex].slice(startColumn, endColumn)
	const firstNonWhitespaceIndex = outerContent.search(/\S/)
	if (firstNonWhitespaceIndex > -1) {
		const content = outerContent.slice(firstNonWhitespaceIndex).trimEnd()
		const contentStartIndex = startColumn + firstNonWhitespaceIndex
		const contentRange: SourceRange = {
			start: { line: lineIndex },
			end: { line: lineIndex },
		}
		if (contentStartIndex > 0) contentRange.start.column = contentStartIndex
		if (contentStartIndex + content.length < codeLines[lineIndex].length) contentRange.end.column = contentStartIndex + content.length
		return {
			content,
			contentRange,
		}
	}
}
