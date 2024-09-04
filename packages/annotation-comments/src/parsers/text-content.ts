import { SourceRange } from '../core/types'

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
