import type { AnnotatedCode, SourceRange } from '../core/types'
import { createRange, createSingleLineRange, excludeRangesFromOuterRange } from './ranges'
import { findRegExpMatchColumnRanges } from './regexps'

/**
 * Attempts to find non-whitespace content in the given line within the specified column range.
 *
 * If found, returns the content and its source range.
 * If not found, returns an empty string as content and an empty range inside the given line.
 */
export function getTextContentInLine(options: {
	codeLines: string[]
	lineIndex: number
	startColumn?: number | undefined
	endColumn?: number | undefined
	/**
	 * Optional comment syntax to remove from the beginning of continuation lines
	 * before extracting the content.
	 */
	continuationLineStart?: RegExp | undefined
}): { content: string; contentRange: SourceRange } {
	const { codeLines, lineIndex, startColumn = 0, endColumn, continuationLineStart: continuationLineSyntax } = options
	const outerContent = codeLines[lineIndex].slice(startColumn, endColumn)
	const innerContentIndex = (startColumn === 0 && continuationLineSyntax && outerContent.match(continuationLineSyntax)?.[0].length) || 0
	const innerContent = outerContent.slice(innerContentIndex)
	const firstNonWhitespaceIndex = innerContent.search(/\S/)
	const contentRange: SourceRange = {
		start: { line: lineIndex },
		end: { line: lineIndex },
	}
	const content = firstNonWhitespaceIndex > -1 ? innerContent.slice(firstNonWhitespaceIndex).trimEnd() : ''
	const contentStartIndex = startColumn + innerContentIndex + (firstNonWhitespaceIndex > -1 ? firstNonWhitespaceIndex : 0)
	if (contentStartIndex > 0) contentRange.start.column = contentStartIndex
	if (contentStartIndex + content.length < codeLines[lineIndex].length) contentRange.end.column = contentStartIndex + content.length
	return {
		content,
		contentRange,
	}
}

/**
 * Examines the given code line and annotation comments, and returns information about
 * the contents of this line that do NOT belong to annotation comments (if any).
 */
export function getNonAnnotationCommentLineContents(lineIndex: number, annotatedCode: AnnotatedCode) {
	const { codeLines, annotationComments } = annotatedCode

	const contentRanges = excludeRangesFromOuterRange({
		codeLines,
		outerRange: createSingleLineRange(lineIndex),
		rangesToExclude: annotationComments.map((comment) => comment.commentRange),
	})

	const nonWhitespaceContentRanges = excludeWhitespaceRanges(codeLines, contentRanges)

	return {
		lineIndex,
		contentRanges,
		nonWhitespaceContentRanges,
		hasNonWhitespaceContent: nonWhitespaceContentRanges.length > 0,
	}
}

/**
 * Returns a copy of the given array of ranges, excluding any ranges that only contain whitespace.
 */
export function excludeWhitespaceRanges(codeLines: string[], ranges: SourceRange[]) {
	return ranges.filter((range) => codeLines[range.start.line].slice(range.start.column, range.end.column).search(/\S/) > -1)
}

/**
 * Returns information about the contents of the first non-annotation comment line
 * above or below the given start line index.
 *
 * If no such line is found, returns `undefined`.
 */
export function getFirstNonAnnotationCommentLineContents(startLineIndex: number, searchDirection: 'above' | 'below', annotatedCode: AnnotatedCode) {
	const lineCount = annotatedCode.codeLines.length
	const step = searchDirection === 'above' ? -1 : 1
	let lineIndex = startLineIndex + step
	while (lineIndex >= 0 && lineIndex < lineCount) {
		const contents = getNonAnnotationCommentLineContents(lineIndex, annotatedCode)
		if (contents.contentRanges.length) return contents
		lineIndex += step
	}
}

/**
 * Searches the given line for matches of the given search query,
 * and returns an array of source ranges that represent the matches.
 */
export function findSearchQueryMatchesInLine(lineIndex: number, searchQuery: string | RegExp, annotatedCode: AnnotatedCode) {
	const { codeLines } = annotatedCode
	const ranges: SourceRange[] = []

	// Determine all column ranges within the line which are NOT covered by annotation comments
	const lineContents = getNonAnnotationCommentLineContents(lineIndex, annotatedCode)

	// Now search for the query in each of these ranges
	lineContents.contentRanges.forEach((contentRange) => {
		const startColumn = contentRange.start.column ?? 0
		const content = codeLines[lineIndex].slice(startColumn, contentRange.end.column)

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
			const matchRanges = findRegExpMatchColumnRanges(content, searchQuery)
			matchRanges.forEach((matchRange) => {
				ranges.push(
					createRange({
						codeLines,
						start: { line: lineIndex, column: startColumn + matchRange.start },
						end: { line: lineIndex, column: startColumn + matchRange.end },
					})
				)
			})
		}
	})

	return ranges
}
