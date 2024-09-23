import { expect } from 'vitest'
import type { AnnotationComment, AnnotationTag, SourceRange } from '../src/core/types'
import { createGlobalRegExp, findRegExpMatchColumnRanges } from '../src/internal/regexps'
import { createRange } from '../src/internal/ranges'

export function splitCodeLines(code: string) {
	return code.trim().split(/\r?\n/)
}

export type ExpectedAnnotationComment = {
	tag?: Partial<AnnotationTag> | undefined
	contents?: string[] | undefined
	commentRange?: SourceRange | undefined
	annotationRange?: SourceRange | undefined
	targetRanges?: SourceRange[] | undefined
	targetRangeRegExp?: RegExp | undefined
}

export function validateAnnotationComment(actual: AnnotationComment, codeLines: string[], expected: ExpectedAnnotationComment) {
	if (expected.tag) {
		expect(actual.tag).toMatchObject({
			relativeTargetRange: undefined,
			targetSearchQuery: undefined,
			...expected.tag,
		})
	}
	if (expected.contents) expect(actual.contents, 'Unexpected contents').toEqual(expected.contents)
	if (expected.commentRange) expect(actual.commentRange, 'Unexpected commentRange').toEqual(expected.commentRange)
	const expectedAnnotationRange = expected.annotationRange ?? expected.commentRange
	if (expectedAnnotationRange) expect(actual.annotationRange, 'Unexpected commentRange').toEqual(expectedAnnotationRange)
	const expectedTargetRanges = expected.targetRangeRegExp ? findRegExpTargetRanges(codeLines, createGlobalRegExp(expected.targetRangeRegExp)) : expected.targetRanges
	if (expectedTargetRanges) expect(actual.targetRanges, 'Unexpected targetRanges').toEqual(expectedTargetRanges)

	if (expected.contents) {
		const expectedContentRanges: SourceRange[] = []
		let expectedContentIndex = 0
		let expectedContent = expected.contents[expectedContentIndex]
		for (let lineIndex = 0; lineIndex < codeLines.length && expectedContentIndex < expected.contents.length; lineIndex++) {
			const codeLine = codeLines[lineIndex]
			let column = -1
			if (expectedContent.length) {
				column = codeLine.indexOf(expectedContent)
			} else if (!codeLine || codeLine.trim() === '*') {
				column = codeLine.length
			}
			if (column === -1) continue
			const range: SourceRange = { start: { line: lineIndex }, end: { line: lineIndex } }
			if (column > 0) range.start.column = column
			if (column + expectedContent.length < codeLine.length) range.end.column = column + expectedContent.length
			expectedContentRanges.push(range)
			expectedContentIndex++
			expectedContent = expected.contents[expectedContentIndex]
		}
		expect(actual.contentRanges, 'Unexpected contentRanges').toEqual(expectedContentRanges)
	}
}

export function findRegExpTargetRanges(codeLines: string[], regExp: RegExp) {
	const ranges: SourceRange[] = []
	codeLines.forEach((line, lineIndex) => {
		const matchRanges = findRegExpMatchColumnRanges(line, regExp)
		matchRanges.forEach((matchRange) => {
			ranges.push(
				createRange({
					codeLines,
					start: { line: lineIndex, column: matchRange.start },
					end: { line: lineIndex, column: matchRange.end },
				})
			)
		})
	})
	return ranges
}
