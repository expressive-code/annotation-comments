import { expect } from 'vitest'
import type { AnnotationComment, AnnotationTag, SourceRange } from '../src/core/types'

export function splitCodeLines(code: string) {
	return code.trim().split(/\r?\n/)
}

export type ExpectedAnnotationComment = {
	tag?: Partial<AnnotationTag> | undefined
	contents?: string[] | undefined
	commentRange?: SourceRange | undefined
	annotationRange?: SourceRange | undefined
	targetRanges?: SourceRange[] | undefined
}

export function validateAnnotationComment(actual: AnnotationComment, codeLines: string[], expected: ExpectedAnnotationComment) {
	if (expected.tag) {
		expect(actual.tag).toMatchObject({
			relativeTargetRange: undefined,
			targetSearchQuery: undefined,
			...expected.tag,
		})
	}
	const expectedContents = expected.contents ?? []
	expect(actual.contents).toEqual(expectedContents)
	if (expected.commentRange) expect(actual.commentRange).toEqual(expected.commentRange)
	const expectedAnnotationRange = expected.annotationRange ?? expected.commentRange
	if (expectedAnnotationRange) expect(actual.annotationRange).toEqual(expectedAnnotationRange)
	if (expected.targetRanges) expect(actual.targetRanges).toEqual(expected.targetRanges)

	const expectedContentRanges: SourceRange[] = []
	let expectedContentIndex = 0
	let expectedContent = expectedContents[expectedContentIndex]
	for (let lineIndex = 0; lineIndex < codeLines.length && expectedContentIndex < expectedContents.length; lineIndex++) {
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
		expectedContent = expectedContents[expectedContentIndex]
	}
	expect(actual.contentRanges).toEqual(expectedContentRanges)
}
