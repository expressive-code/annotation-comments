import type { AnnotationComment, SourceRange } from './types'
import { compareRanges, createRange, createSingleLineRange } from '../internal/ranges'
import { getGroupIndicesFromRegExpMatch } from '../internal/regexps'

export type FindAnnotationTargetsOptions = {
	codeLines: string[]
	annotationComments: AnnotationComment[]
}

export function findAnnotationTargets(options: FindAnnotationTargetsOptions) {
	const { codeLines, annotationComments } = options

	annotationComments.forEach((comment) => {
		const { tag, commentRange, annotationRange, targetRanges } = comment

		// We don't need to search for `ignore-tags` annotation targets
		// as ignores are handled by the annotation comment parser
		if (tag.name === 'ignore-tags') return

		const commentLineIndex = commentRange.start.line
		const commentLineContents = getNonAnnotationCommentLineContents(commentLineIndex, options)
		let { relativeTargetRange } = tag
		const { targetSearchQuery } = tag

		// Handle annotations without a target search query (they target full lines)
		if (targetSearchQuery === undefined) {
			// If the annotation has no relative target range, try to find a nearby target line
			// that is not empty and not an annotation comment
			if (relativeTargetRange === undefined) {
				// Check if the annotation comment line itself is a valid target
				if (commentLineContents.hasNonWhitespaceContent) {
					return targetRanges.push(createSingleLineRange(commentLineIndex))
				}
				// Otherwise, scan for a target line below
				const potentialTargetBelow = getFirstNonAnnotationCommentLineContents(commentLineIndex, 'below', options)
				if (potentialTargetBelow?.hasNonWhitespaceContent) {
					return targetRanges.push(createSingleLineRange(potentialTargetBelow.lineIndex))
				}
				// Finally, scan for a target line above
				const potentialTargetAbove = getFirstNonAnnotationCommentLineContents(commentLineIndex, 'above', options)
				if (potentialTargetAbove?.hasNonWhitespaceContent) {
					return targetRanges.push(createSingleLineRange(potentialTargetAbove.lineIndex))
				}
				// If we arrive here, there is no target range (same as the relative range `:0`),
				// so don't do anything
				return
			}
			// It has a relative target range, so select the number of non-annotation lines
			// in the given direction, starting with the comment line
			const step = relativeTargetRange > 0 ? 1 : -1
			let lineIndex = commentLineIndex
			let remainingLines = Math.abs(relativeTargetRange)
			while (lineIndex >= 0 && lineIndex < codeLines.length && remainingLines > 0) {
				// Check if the line is a valid target
				const lineContents = getNonAnnotationCommentLineContents(lineIndex, options)
				if (lineContents.contentRanges.length) {
					targetRanges.push(createSingleLineRange(lineIndex))
					remainingLines--
				}
				lineIndex += step
			}
		}

		// If a target search query is present, perform the search to determine the target range(s)
		if (targetSearchQuery) {
			// Read the direction and number of matches to find from the tag,
			// or auto-detect this in case no relative target range was given
			if (relativeTargetRange === undefined) {
				if (commentLineContents.hasNonWhitespaceContent) {
					// The annotation comment is on the same line as content, so the direction
					// depends on where the content is in relation to the annotation
					const hasContentBeforeAnnotation = commentLineContents.nonWhitespaceContentRanges.some(
						// Check for non-whitespace content that starts before the annotation
						(contentRange) => compareRanges(annotationRange, contentRange, 'start') < 0
					)
					relativeTargetRange = hasContentBeforeAnnotation ? -1 : 1
				} else {
					// Otherwise, the direction defaults to downwards, unless the annotation comment
					// is visually grouped with content above it (= there no content directly below
					// the annotation comment(s), but there is content directly above)
					const isGroupedWithContentAbove =
						!getFirstNonAnnotationCommentLineContents(commentLineIndex, 'below', options)?.hasNonWhitespaceContent &&
						getFirstNonAnnotationCommentLineContents(commentLineIndex, 'above', options)?.hasNonWhitespaceContent
					relativeTargetRange = isGroupedWithContentAbove ? -1 : 1
				}
			}

			// Perform the search
			const step = relativeTargetRange > 0 ? 1 : -1
			let lineIndex = commentLineIndex
			let remainingMatches = Math.abs(relativeTargetRange)
			while (lineIndex >= 0 && lineIndex < codeLines.length && remainingMatches > 0) {
				// Search all ranges of the line that are not part of an annotation comment
				// for matches of the target search query
				const lineContents = getNonAnnotationCommentLineContents(lineIndex, options)
				const matches = lineContents.contentRanges.flatMap((contentRange) => findSearchQueryMatchesInLine(targetSearchQuery, contentRange, options))
				if (matches.length) {
					// Go through the matches in the direction of the relative target range
					// until we have found the required number of matches
					let matchIndex = relativeTargetRange > 0 ? 0 : matches.length - 1
					while (matchIndex >= 0 && matchIndex < matches.length && remainingMatches > 0) {
						targetRanges.push(matches[matchIndex])
						remainingMatches--
						matchIndex += step
					}
				}
				lineIndex += step
			}
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

/**
 * Searches the given column range on a single line for matches of the given search query,
 * and returns an array of source ranges that represent the matches.
 */
function findSearchQueryMatchesInLine(searchQuery: string | RegExp, rangeToSearch: SourceRange, options: FindAnnotationTargetsOptions) {
	const { codeLines } = options
	const lineIndex = rangeToSearch.start.line
	const startColumn = rangeToSearch.start.column ?? 0
	const content = codeLines[lineIndex].slice(startColumn, rangeToSearch.end.column)

	const ranges: SourceRange[] = []

	// Handle plaintext string search terms
	if (typeof searchQuery === 'string') {
		let idx = content.indexOf(searchQuery, 0)
		while (idx > -1) {
			ranges.push(
				createRange({
					codeLines,
					start: { line: lineIndex, column: startColumn + idx },
					end: { line: lineIndex, column: startColumn + idx + searchQuery.length },
				})
			)
			idx = content.indexOf(searchQuery, idx + searchQuery.length)
		}
	}

	// Handle regular expression search terms
	if (searchQuery instanceof RegExp) {
		const matches = content.matchAll(searchQuery)
		for (const match of matches) {
			const rawGroupIndices = getGroupIndicesFromRegExpMatch(match)
			// Remove null group indices
			let groupIndices = rawGroupIndices.flatMap((range) => (range ? [range] : []))
			// If there are no non-null indices, use the full match instead
			// (capture group feature fallback, impossible to cover in tests)
			/* c8 ignore start */
			if (!groupIndices.length) {
				groupIndices = [[match.index, match.index + match[0].length]]
			}
			/* c8 ignore end */
			// If there are multiple non-null indices, remove the first one
			// as it is the full match and we only want to mark capture groups
			if (groupIndices.length > 1) {
				groupIndices.shift()
			}
			// Create marked ranges from all remaining group indices
			groupIndices.forEach((range) => {
				ranges.push(
					createRange({
						codeLines,
						start: { line: lineIndex, column: startColumn + range[0] },
						end: { line: lineIndex, column: startColumn + range[1] },
					})
				)
			})
		}
	}

	return ranges
}
