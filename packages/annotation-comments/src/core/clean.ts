import { cloneRange, createSingleLineRange, excludeRangesFromOuterRange, mergeIntersectingOrAdjacentRanges, rangesAreEqual, splitRangeByLines } from '../internal/ranges'
import { excludeWhitespaceRanges } from '../internal/text-content'
import type { AnnotatedCode, AnnotationComment, SourceLocation, SourceRange } from './types'

export type CleanCodeOptions = AnnotatedCode & {
	removeAnnotationContents?: boolean | ((context: RemoveAnnotationContentsContext) => boolean)
	updateTargetRanges?: boolean
	handleRemoveLine?: (context: HandleRemoveLineContext) => boolean
	handleEditLine?: (context: HandleEditLineContext) => boolean
}

export type RemoveAnnotationContentsContext = {
	comment: AnnotationComment
}

export type HandleCodeChangeContextBase = {
	codeLines: string[]
}

export type HandleRemoveLineContext = HandleCodeChangeContextBase & RemoveLine
export type HandleEditLineContext = HandleCodeChangeContextBase & EditLine

export type RemoveLine = {
	editType: 'removeLine'
	lineIndex: number
}

export type EditLine = {
	editType: 'editLine'
	lineIndex: number
	startColumn: number
	endColumn: number
	newText?: string | undefined
}

type SourceChange = RemoveLine | EditLine

export function cleanCode(options: CleanCodeOptions) {
	const { codeLines, annotationComments, removeAnnotationContents = false, updateTargetRanges = true, handleRemoveLine, handleEditLine } = options

	// Go through all annotation comments and collect an array of ranges to be removed
	const rangesToBeRemoved: SourceRange[] = []
	annotationComments.forEach((annotationComment) => {
		const hasContents = annotationComment.contents.length > 0
		const removeEntireAnnotation =
			!hasContents || (typeof removeAnnotationContents === 'function' ? removeAnnotationContents({ comment: annotationComment }) : removeAnnotationContents)
		const rangeToBeRemoved = cloneRange(removeEntireAnnotation ? annotationComment.annotationRange : annotationComment.tag.range)

		// If we're removing an entire annotation, include up to one line of whitespace above it
		const lineAboveIndex = rangeToBeRemoved.start.line - 1
		if (removeEntireAnnotation && annotationComment.commentInnerRange.start.line < lineAboveIndex) {
			const contentInLineAbove = excludeWhitespaceRanges(codeLines, [createSingleLineRange(lineAboveIndex)])
			if (!contentInLineAbove.length) {
				rangeToBeRemoved.start = { line: lineAboveIndex }
			}
		}

		rangesToBeRemoved.push(rangeToBeRemoved)
	})

	// Remove any parent comments that would be empty after removing the annotations
	const handledRanges: SourceRange[] = []
	annotationComments.forEach(({ commentRange, commentInnerRange }) => {
		if (handledRanges.some((range) => rangesAreEqual(range, commentInnerRange))) return
		handledRanges.push(commentInnerRange)
		// If the outer range is already in the list of ranges to be removed, skip this comment
		if (rangesToBeRemoved.some((range) => rangesAreEqual(range, commentRange))) return
		const remainingParts = excludeRangesFromOuterRange({
			codeLines,
			outerRange: commentInnerRange,
			rangesToExclude: rangesToBeRemoved,
		})
		const nonWhitespaceParts = excludeWhitespaceRanges(codeLines, remainingParts)
		// If the comment's inner range only contains whitespace after all removals,
		// remove the entire comment
		if (!nonWhitespaceParts.length) rangesToBeRemoved.push(commentRange)
	})

	// Build an array of changes by line to be applied to the code
	const mergedRangesToBeRemoved = mergeIntersectingOrAdjacentRanges(rangesToBeRemoved)
	const changes = mergedRangesToBeRemoved.flatMap((range) => getRangeRemovalChanges(codeLines, range))

	// Apply the changes to the code in reverse order to avoid having to change edit locations
	changes.reverse()
	changes.forEach((change) => {
		if (change.editType === 'removeLine') {
			if (!handleRemoveLine || !handleRemoveLine({ codeLines, ...change })) {
				codeLines.splice(change.lineIndex, 1)
			}
			if (updateTargetRanges) updateTargetRangesAfterRemoveLine(annotationComments, change)
		} else {
			if (!handleEditLine || !handleEditLine({ codeLines, ...change })) {
				const line = codeLines[change.lineIndex]
				codeLines[change.lineIndex] = line.slice(0, change.startColumn) + (change.newText ?? '') + line.slice(change.endColumn)
			}
			if (updateTargetRanges) updateTargetRangesAfterEditLine(annotationComments, change)
		}
	})
}

function updateTargetRangesAfterRemoveLine(annotationComments: AnnotationComment[], change: RemoveLine) {
	annotationComments.forEach(({ targetRanges }) => {
		targetRanges.forEach((targetRange, index) => {
			if (targetRange.start.line === change.lineIndex) {
				targetRanges.splice(index, 1)
			} else if (targetRange.start.line > change.lineIndex) {
				targetRange.start.line--
				targetRange.end.line--
			}
		})
	})
}

function updateTargetRangesAfterEditLine(annotationComments: AnnotationComment[], change: EditLine) {
	annotationComments.forEach(({ targetRanges }) => {
		targetRanges.forEach((targetRange) => {
			updateLocationIfNecessary(targetRange.start, change)
			updateLocationIfNecessary(targetRange.end, change)
		})
	})
}

function updateLocationIfNecessary(location: SourceLocation, change: EditLine) {
	if (location.line !== change.lineIndex) return
	if (!location.column || change.startColumn > location.column) return
	const changeDelta = (change.newText?.length ?? 0) - (change.endColumn - change.startColumn)
	location.column += changeDelta
}

function getRangeRemovalChanges(codeLines: string[], range: SourceRange): SourceChange[] {
	const singleLineRanges = splitRangeByLines(range)

	return singleLineRanges.map((singleLineRange) => {
		const lineIndex = singleLineRange.start.line
		const lineLength = codeLines[lineIndex].length
		const {
			start: { column: startColumn = 0 },
			end: { column: endColumn = lineLength },
		} = singleLineRange

		if (startColumn > 0 || endColumn < lineLength) {
			return {
				editType: 'editLine',
				lineIndex,
				startColumn,
				endColumn,
				newText: '',
			}
		} else {
			return {
				editType: 'removeLine',
				lineIndex,
			}
		}
	})
}
