import type { AnnotationComment, SourceRange } from './types'
import { compareRanges, createSingleLineRange } from '../internal/ranges'

export type FindAnnotationTargetsOptions = {
	codeLines: string[]
	annotationComments: AnnotationComment[]
}

export function findAnnotationTargets(options: FindAnnotationTargetsOptions) {
	const { codeLines, annotationComments } = options

	// TODO: Finish implementation
	annotationComments.forEach((comment) => {
		const annotationLineIndex = comment.annotationRange.start.line
		const annotationLineContents = getNonAnnotationCommentLineContents(annotationLineIndex, options)

		// If the annotation has no relative target range and no target search query,
		// try to find a nearby target line that is not empty and not an annotation comment
		if (comment.tag.relativeTargetRange === undefined && comment.tag.targetSearchQuery === undefined) {
			// Check if the annotation line itself is a valid target
			if (annotationLineContents.hasNonWhitespaceContent) {
				return comment.targetRanges.push(createSingleLineRange(annotationLineIndex))
			}
			// Otherwise, scan for a target line below
			const potentialTargetBelow = getFirstNonAnnotationCommentLineContents(annotationLineIndex, 'below', options)
			if (potentialTargetBelow?.hasNonWhitespaceContent) {
				return comment.targetRanges.push(createSingleLineRange(potentialTargetBelow.lineIndex))
			}
			// Finally, scan for a target line above
			const potentialTargetAbove = getFirstNonAnnotationCommentLineContents(annotationLineIndex, 'above', options)
			if (potentialTargetAbove?.hasNonWhitespaceContent) {
				return comment.targetRanges.push(createSingleLineRange(potentialTargetAbove.lineIndex))
			}
			// If we arrive here, there is no target range (same as the relative range `:0`),
			// so don't do anything
			return
		}

		// If a target search query is present, perform the search to determine the target range(s)
		if (comment.tag.targetSearchQuery) {
			// Read the direction and number of matches to find from the tag,
			// or auto-detect this in case no relative target range was given
			let relativeTargetRange = comment.tag.relativeTargetRange
			if (relativeTargetRange === undefined) {
				if (annotationLineContents.hasNonWhitespaceContent) {
					// The annotation comment is on the same line as content, so the direction
					// depends on where the content is in relation to the comment
					const hasContentBeforeAnnotation = annotationLineContents.nonWhitespaceContentRanges.some(
						(contentRange) => compareRanges(comment.annotationRange, contentRange, 'start') < 0
					)
					relativeTargetRange = hasContentBeforeAnnotation ? -1 : 1
				} else {
					// Otherwise, the direction defaults to downwards, unless the annotation comment
					// is visually grouped with content above it (= there no content directly below
					// the annotation comment(s), but there is content directly above)
					const isGroupedWithContentAbove =
						!getFirstNonAnnotationCommentLineContents(annotationLineIndex, 'below', options)?.hasNonWhitespaceContent &&
						getFirstNonAnnotationCommentLineContents(annotationLineIndex, 'above', options)?.hasNonWhitespaceContent
					relativeTargetRange = isGroupedWithContentAbove ? -1 : 1
				}
			}

			// - Perform the search:
			//   - The target search query can be a simple string, a single-quoted string, a double-quoted
			//     string, or a regular expression. Regular expressions can optionally contain capture groups,
			//     which will then be used to determine the target range(s) instead of the full match.
			//   - The search is performed line by line, starting at the start or end of the annotation comment
			//     and going in the direction determined by the relative target range that was either given or
			//     automatically determined as described above.
			//   - Before searching a line for matches, all characters that lie within the `outerRange` of any
			//     annotation comment are removed from the line. If matches are found, the matched ranges are
			//     adjusted to include the removed characters.
			//   - Each match is added to the `targetRanges` until the number of matches equals the absolute
			//     value of the relative target range, or the end of the code is reached.
			//   - In the case of regular expressions with capture groups, a single match can result in multiple
			//     target ranges, one for each capture group.
		}
	})
}

/**
 * Examines the given code line and annotation comments, and returns information about
 * the contents of this line that do NOT belong to annotation comments (if any).
 */
function getNonAnnotationCommentLineContents(lineIndex: number, options: FindAnnotationTargetsOptions) {
	const { codeLines, annotationComments } = options
	const lineLength = codeLines[lineIndex].length
	const contentRanges: SourceRange[] = [{ start: { line: lineIndex, column: 0 }, end: { line: lineIndex, column: lineLength } }]

	annotationComments.forEach((comment) => {
		const { commentRange } = comment
		// Ignore the current comment if it's outside the current line
		if (commentRange.start.line > lineIndex || commentRange.end.line < lineIndex) return
		// Otherwise, go through all non-annotation ranges to remove, cut, or split them
		// if they intersect with with the current comment
		const commentStartColumn = commentRange.start.line === lineIndex ? (commentRange.start.column ?? 0) : 0
		const commentEndColumn = commentRange.end.line === lineIndex ? (commentRange.end.column ?? lineLength) : lineLength
		for (let i = contentRanges.length - 1; i >= 0; i--) {
			const nonAnnotationRange = contentRanges[i]
			const rangeStartColumn = nonAnnotationRange.start.column ?? 0
			const rangeEndColumn = nonAnnotationRange.end.column ?? lineLength
			if (commentStartColumn <= rangeStartColumn && commentEndColumn >= rangeEndColumn) {
				// The comment completely covers the range, so remove it
				contentRanges.splice(i, 1)
			} else if (commentStartColumn <= rangeStartColumn && commentEndColumn < rangeEndColumn) {
				// The comment overlaps with the start of the range, so adjust the range start
				nonAnnotationRange.start.column = commentEndColumn
			} else if (commentStartColumn > rangeStartColumn && commentEndColumn >= rangeEndColumn) {
				// The comment overlaps with the end of the range, so adjust the range end
				nonAnnotationRange.end.column = commentStartColumn
			} else if (commentStartColumn > rangeStartColumn && commentEndColumn < rangeEndColumn) {
				// The comment is inside the range, so split the range into two
				// ...by making the current range end before the comment
				nonAnnotationRange.end.column = commentStartColumn
				// ...and inserting a new range that starts after the comment
				contentRanges.splice(i + 1, 0, { start: { line: lineIndex, column: commentEndColumn }, end: { line: lineIndex, column: rangeEndColumn } })
			}
		}
	})

	const nonWhitespaceContentRanges = contentRanges.filter((range) => codeLines[lineIndex].slice(range.start.column, range.end.column).search(/\S/) > -1)

	return {
		lineIndex,
		contentRanges,
		nonWhitespaceContentRanges,
		hasNonWhitespaceContent: nonWhitespaceContentRanges.length > 0,
	}
}

/**
 * Returns information about the contents of the first non-annotation comment line
 * above or below the given start line index.
 *
 * If no such line is found, returns `undefined`.
 */
function getFirstNonAnnotationCommentLineContents(startLineIndex: number, searchDirection: 'above' | 'below', options: FindAnnotationTargetsOptions) {
	const { codeLines } = options
	const lineCount = codeLines.length
	const step = searchDirection === 'above' ? -1 : 1
	let lineIndex = startLineIndex + step
	while (lineIndex >= 0 && lineIndex < lineCount) {
		const contents = getNonAnnotationCommentLineContents(lineIndex, options)
		if (contents.contentRanges.length) return contents
		lineIndex += step
	}
}
