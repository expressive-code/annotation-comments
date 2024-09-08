import type { SourceRange } from '../core/types'

export function createRange(options: { line: string; lineIndex: number; startColumn: number; endColumn: number }) {
	const { line, lineIndex, startColumn, endColumn } = options
	const range: SourceRange = {
		start: { line: lineIndex },
		end: { line: lineIndex },
	}
	if (startColumn > 0) range.start.column = startColumn
	if (endColumn < line.length) range.end.column = endColumn
	return range
}

/**
 * Compares two source ranges by their start or end locations.
 *
 * Returns:
 * - `> 0` if the second location is **greater than** (comes after) the first,
 * - `< 0` if the second location is **smaller than** (comes before) the first, or
 * - `0` if they are equal.
 */
export function compareRanges(a: SourceRange, b: SourceRange, prop: 'start' | 'end'): number {
	// Compare line numbers first
	const lineResult = b[prop].line - a[prop].line
	if (lineResult !== 0) return lineResult

	// Line numbers are equal, so compare columns
	const aCol = a[prop].column
	const bCol = b[prop].column

	// If both columns are undefined, the ranges are equal
	if (aCol === undefined && bCol === undefined) return 0

	// If only one column is undefined (= covers the full line),
	// the other column starts after and ends before it
	if (aCol === undefined) return prop === 'start' ? 1 : -1
	if (bCol === undefined) return prop === 'start' ? -1 : 1

	return bCol - aCol
}

export function secondRangeIsInFirst(potentialOuterRange: SourceRange, rangeToTest: SourceRange): boolean {
	return (
		// To be in range, rangeToTest must start at or after potentialOuterRange...
		compareRanges(potentialOuterRange, rangeToTest, 'start') >= 0 &&
		// ...and end at or before potentialOuterRange
		compareRanges(potentialOuterRange, rangeToTest, 'end') <= 0
	)
}
