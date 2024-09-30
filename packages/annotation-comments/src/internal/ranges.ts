import type { SourceLocation, SourceRange } from '../core/types'

/**
 * Creates a new source range object from the given start and end locations.
 */
export function createRange(options: { codeLines: string[]; start: SourceLocation; end: SourceLocation }): SourceRange {
	const { codeLines, start, end } = options
	const range: SourceRange = {
		start: { line: start.line },
		end: { line: end.line },
	}
	if (start.column ?? 0 > 0) range.start.column = start.column
	if (end.column && end.column < (codeLines[end.line] ?? '').length) range.end.column = end.column
	return range
}

/**
 * Returns a copy of the given source range.
 */
export function cloneRange(range: SourceRange): SourceRange {
	return { start: { ...range.start }, end: { ...range.end } }
}

export function createSingleLineRange(lineIndex: number): SourceRange {
	return { start: { line: lineIndex }, end: { line: lineIndex } }
}

export function createSingleLineRanges(...lineIndices: number[]): SourceRange[] {
	return lineIndices.map((lineIndex) => ({ start: { line: lineIndex }, end: { line: lineIndex } }))
}

/**
 * Compares two source ranges by their start or end locations.
 *
 * Returns:
 * - `> 0` if the first location is **greater than** (comes after) the second,
 * - `< 0` if the first location is **smaller than** (comes before) the second, or
 * - `0` if they are equal.
 */
export function compareRanges(a: SourceRange, b: SourceRange, propA: 'start' | 'end', propB: 'start' | 'end' = propA): number {
	// Compare line numbers first
	const lineResult = a[propA].line - b[propB].line
	if (lineResult !== 0) return lineResult

	// Line numbers are equal, so compare columns
	const aCol = a[propA].column
	const bCol = b[propB].column

	// If both columns are undefined, the ranges are equal
	if (aCol === undefined && bCol === undefined) return 0

	// If only one column is undefined (= covers the full line),
	// the other column starts after and ends before it
	if (aCol === undefined) return propA === 'start' ? -1 : 1
	if (bCol === undefined) return propB === 'start' ? 1 : -1

	return aCol - bCol
}

export function rangesAreEqual(a: SourceRange, b: SourceRange): boolean {
	return compareRanges(a, b, 'start') === 0 && compareRanges(a, b, 'end') === 0
}

export function secondRangeIsInFirst(potentialOuterRange: SourceRange, rangeToTest: SourceRange): boolean {
	return (
		// To be in range, rangeToTest must start at or after potentialOuterRange...
		compareRanges(rangeToTest, potentialOuterRange, 'start') >= 0 &&
		// ...and end at or before potentialOuterRange
		compareRanges(rangeToTest, potentialOuterRange, 'end') <= 0
	)
}

/**
 * Splits the given range that may span multiple lines into an array of single-line ranges.
 */
export function splitRangeByLines(range: SourceRange): SourceRange[] {
	// For single-line ranges, just return a copy of the range
	if (range.start.line === range.end.line) return [cloneRange(range)]

	// For multi-line ranges, create a mix of column ranges and full line ranges as needed
	const ranges: SourceRange[] = []
	const isPartialStartLine = range.start.column ? range.start.column > 0 : false
	const isPartialEndLine = range.end.column !== undefined

	// If the range starts in the middle of a line, add an inline range
	if (isPartialStartLine) {
		ranges.push({
			start: { line: range.start.line, column: range.start.column },
			end: { line: range.start.line },
		})
	}
	// Add all full line ranges
	for (let lineIndex = range.start.line + (isPartialStartLine ? 1 : 0); lineIndex < range.end.line + (isPartialEndLine ? 0 : 1); lineIndex++) {
		ranges.push(createSingleLineRange(lineIndex))
	}
	// If the range ends in the middle of a line, add an inline range
	if (isPartialEndLine) {
		ranges.push({
			start: { line: range.end.line },
			end: { line: range.end.line, column: range.end.column },
		})
	}
	return ranges
}

/**
 * Merges any intersecting or adjacent ranges in the given array of source ranges.
 */
export function mergeIntersectingOrAdjacentRanges(ranges: SourceRange[]): SourceRange[] {
	const sortedRanges = ranges.slice().sort((a, b) => compareRanges(a, b, 'start'))
	const mergedRanges: SourceRange[] = []
	let currentRange: SourceRange | undefined
	for (const newRange of sortedRanges) {
		if (!currentRange) {
			currentRange = cloneRange(newRange)
			continue
		}
		// If the new range starts inside or right at the end of the current one,
		// extend the current range if needed
		if (compareRanges(newRange, currentRange, 'start', 'end') <= 0) {
			if (compareRanges(newRange, currentRange, 'end') > 0) currentRange.end = newRange.end
			continue
		}
		// Otherwise, we're done with the current range and can switch to the new one
		mergedRanges.push(currentRange)
		currentRange = cloneRange(newRange)
	}
	if (currentRange) mergedRanges.push(currentRange)
	return mergedRanges
}

/**
 * Excludes the given exclusion ranges from the outer range by splitting the outer range into
 * multiple parts that do not overlap with the exclusions.
 *
 * The resulting array of source ranges is split by lines and can be a combination of partial
 * and full line ranges. The array can also be empty if the outer range is completely covered
 * by the exclusions.
 */
export function excludeRangesFromOuterRange(options: { codeLines: string[]; outerRange: SourceRange; rangesToExclude: SourceRange[] }): SourceRange[] {
	const { codeLines, outerRange, rangesToExclude } = options

	const remainingRanges: SourceRange[] = splitRangeByLines(outerRange)
	const exclusionsSplitByLine = rangesToExclude.flatMap((exclusion) => splitRangeByLines(exclusion))

	exclusionsSplitByLine.forEach((exclusion) => {
		const lineIndex = exclusion.start.line
		const lineLength = codeLines[lineIndex].length
		const exclusionStartColumn = exclusion.start.column ?? 0
		const exclusionEndColumn = exclusion.end.column ?? lineLength
		for (let i = remainingRanges.length - 1; i >= 0; i--) {
			const range = remainingRanges[i]
			// If the range is on a different line, it cannot be affected by the exclusion
			if (range.start.line !== lineIndex) continue
			const rangeStartColumn = range.start.column ?? 0
			const rangeEndColumn = range.end.column ?? lineLength
			if (exclusionStartColumn <= rangeStartColumn && exclusionEndColumn >= rangeEndColumn) {
				// The exclusion completely covers the range, so remove it
				remainingRanges.splice(i, 1)
			} else if (exclusionStartColumn <= rangeStartColumn && exclusionEndColumn < rangeEndColumn) {
				// The exclusion overlaps with the start of the range, so adjust the range start
				range.start.column = exclusionEndColumn
			} else if (exclusionStartColumn > rangeStartColumn && exclusionEndColumn >= rangeEndColumn) {
				// The exclusion overlaps with the end of the range, so adjust the range end
				range.end.column = exclusionStartColumn
			} else if (exclusionStartColumn > rangeStartColumn && exclusionEndColumn < rangeEndColumn) {
				// The exclusion is inside the range, so split the range into two
				// ...by making the current range end before the exclusion
				range.end.column = exclusionStartColumn
				// ...and inserting a new range that starts after the exclusion
				//    and ends at the end of the current range
				const rangeAfterExclusion = createSingleLineRange(lineIndex)
				if (exclusionEndColumn > 0) rangeAfterExclusion.start.column = exclusionEndColumn
				if (rangeEndColumn < lineLength) rangeAfterExclusion.end.column = rangeEndColumn
				remainingRanges.splice(i + 1, 0, rangeAfterExclusion)
			}
		}
	})

	return remainingRanges
}
