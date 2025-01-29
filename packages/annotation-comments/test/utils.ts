import { expect } from 'vitest'
import type { AnnotationComment, AnnotationTag, SourceLocation, SourceRange } from '../src/core/types'
import { createRange, isEmptyRange } from '../src/internal/ranges'
import { createGlobalRegExp, findRegExpMatchColumnRanges } from '../src/internal/regexps'

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
	if (expected.contents) expect(actual.contents, `Unexpected contents of tag ${actual.tag.rawTag}`).toEqual(expected.contents)
	if (expected.commentRange) expect(actual.commentRange, `Unexpected commentRange of tag ${actual.tag.rawTag}`).toEqual(expected.commentRange)
	const expectedAnnotationRange = expected.annotationRange ?? expected.commentRange
	if (expectedAnnotationRange) expect(actual.annotationRange, `Unexpected annotationRange of tag ${actual.tag.rawTag}`).toEqual(expectedAnnotationRange)
	const expectedTargetRanges = expected.targetRangeRegExp ? findRegExpTargetRanges(codeLines, createGlobalRegExp(expected.targetRangeRegExp)) : expected.targetRanges
	if (expectedTargetRanges) expect(actual.targetRanges, `Unexpected targetRanges of tag ${actual.tag.rawTag}`).toEqual(expectedTargetRanges)

	if (expected.contents) {
		const expectedContentRanges: SourceRange[] = []
		let expectedContentIndex = 0
		let expectedContent = expected.contents[expectedContentIndex]
		for (let lineIndex = 0; lineIndex < codeLines.length && expectedContentIndex < expected.contents.length; lineIndex++) {
			const codeLine = codeLines[lineIndex]
			let column = -1
			if (expectedContent.length) {
				column = codeLine.indexOf(expectedContent)
			} else if (!codeLine || codeLine.trim() === '*' || codeLine.trim() === '//') {
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

/**
 * Generates all possible permutations of an array of the given length
 * with the specified number of elements omitted. Returns arrays of indices.
 */
export function getArrayPermutations(arrayLength: number, omitCount: number): number[][] {
	if (omitCount < 0 || omitCount > arrayLength) throw new Error('Invalid omitCount value')

	const result: number[][] = []
	const generate = (start: number, currentSubset: number[]) => {
		if (currentSubset.length === arrayLength - omitCount) {
			result.push([...currentSubset])
			return
		}

		for (let i = start; i < arrayLength; i++) {
			currentSubset.push(i)
			generate(i + 1, currentSubset)
			currentSubset.pop()
		}
	}

	generate(0, [])
	return result
}

export function formatSourceLocation(location: SourceLocation) {
	return `${location.line}${location.column !== undefined ? `:${location.column}` : ''}`
}

export function formatSourceRange(range: SourceRange) {
	const rangeStr = `${formatSourceLocation(range.start)}-${formatSourceLocation(range.end)}`
	if (isEmptyRange(range)) return `empty(${rangeStr})`
	return rangeStr
}

export function formatAnnotationComment(comment: AnnotationComment) {
	const result: string[] = []
	result.push(`tag=${comment.tag.rawTag}`)
	result.push(`tagRange=${formatSourceRange(comment.tag.range)}`)
	result.push(`commentRange=${formatSourceRange(comment.commentRange)}`)
	result.push(`commentInnerRange=${formatSourceRange(comment.commentInnerRange)}`)
	result.push(`annotationRange=${formatSourceRange(comment.annotationRange)}`)
	return result.join(',')
}

export function formatAnnotationComments(comments: AnnotationComment[]) {
	return comments.map((comment) => `{${formatAnnotationComment(comment)}}`).join('\n')
}
