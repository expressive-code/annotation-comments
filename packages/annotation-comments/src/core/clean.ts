import { cloneRange, excludeRangesFromOuterRange, isEmptyRange, makeRangeEmpty, mergeIntersectingOrAdjacentRanges, rangesAreEqual, splitRangeByLines } from '../internal/ranges'
import { excludeWhitespaceRanges, getTextContentInLine } from '../internal/text-content'
import type { AnnotatedCode, AnnotationComment, SourceRange } from './types'

export type CleanCodeOptions = AnnotatedCode & {
	/**
	 * An optional function that is called for each annotation comment.
	 * Its return value determines whether the annotation should be cleaned from the code.
	 */
	allowCleaning?: (context: CleanAnnotationContext) => boolean
	removeAnnotationContents?: boolean | ((context: CleanAnnotationContext) => boolean)
	/**
	 * Whether to update all ranges in the annotation comments after applying the changes.
	 */
	updateCodeRanges?: boolean
	handleRemoveLine?: (context: HandleRemoveLineContext) => boolean
	handleEditLine?: (context: HandleEditLineContext) => boolean
}

export type CleanAnnotationContext = {
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
	const { codeLines, annotationComments, removeAnnotationContents = false, updateCodeRanges = true, handleRemoveLine, handleEditLine } = options

	// Create a subset of annotation comments to clean
	const commentsToClean = annotationComments.filter((comment) => typeof options.allowCleaning !== 'function' || options.allowCleaning({ comment }))

	// Go through all annotation comments to clean and collect an array of ranges to be removed
	const rangesToBeRemoved: SourceRange[] = []
	commentsToClean.forEach((annotationComment) => {
		if (isEmptyRange(annotationComment.annotationRange)) return

		// Determine whether to remove the entire annotation or just the tag
		const hasContents = annotationComment.contentRanges.length && annotationComment.contents.length
		const removeEntireAnnotation =
			!hasContents || (typeof removeAnnotationContents === 'function' ? removeAnnotationContents({ comment: annotationComment }) : removeAnnotationContents)
		const rangeToBeRemoved = cloneRange(removeEntireAnnotation ? annotationComment.annotationRange : annotationComment.tag.range)

		// If we're removing an entire annotation, include up to one line of whitespace above it
		const lineAboveIndex = rangeToBeRemoved.start.line - 1
		if (removeEntireAnnotation && annotationComment.commentInnerRange.start.line < lineAboveIndex) {
			const { content } = getTextContentInLine({
				codeLines,
				lineIndex: lineAboveIndex,
				continuationLineStart: annotationComment.commentSyntax.continuationLineStart,
			})
			if (!content) {
				rangeToBeRemoved.start = { line: lineAboveIndex }
			}
		}

		// If we're only removing the tag, also remove whitespace between the tag and content
		if (!removeEntireAnnotation && hasContents) {
			const firstContentStart = annotationComment.contentRanges[0].start
			if (!annotationComment.commentSyntax.closing && firstContentStart.line > rangeToBeRemoved.start.line) {
				// If the comment uses a single-line syntax and the first content starts on a line
				// below the tag, remove the entire tag line including the comment syntax
				rangeToBeRemoved.start = { line: rangeToBeRemoved.start.line }
			} else {
				// Otherwise (multi-line syntax or content starting at the tag line),
				// just extend the range to the start of the first content
				rangeToBeRemoved.end = { line: firstContentStart.line, column: firstContentStart.column ?? 0 }
			}
		}

		rangesToBeRemoved.push(rangeToBeRemoved)
	})

	// Remove any parent comments that would be empty after removing the annotations
	const handledRanges: SourceRange[] = []
	commentsToClean.forEach(({ commentRange, commentInnerRange }) => {
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
			if (updateCodeRanges) updateCodeRangesAfterChange(annotationComments, change)
		} else {
			if (!handleEditLine || !handleEditLine({ codeLines, ...change })) {
				const line = codeLines[change.lineIndex]
				codeLines[change.lineIndex] = line.slice(0, change.startColumn) + (change.newText ?? '') + line.slice(change.endColumn)
			}
			if (updateCodeRanges) updateCodeRangesAfterChange(annotationComments, change)
		}
	})
}

function updateCodeRangesAfterChange(annotationComments: AnnotationComment[], change: RemoveLine | EditLine) {
	annotationComments.forEach((comment) => {
		updateCodeRange(comment.tag.range, change)
		updateCodeRange(comment.annotationRange, change)
		updateCodeRange(comment.commentRange, change)
		updateCodeRange(comment.commentInnerRange, change)
		updateCodeRanges(comment.contentRanges, change)
		updateCodeRanges(comment.targetRanges, change)
	})
}

function updateCodeRanges(ranges: SourceRange[], change: RemoveLine | EditLine) {
	ranges.forEach((range) => updateCodeRange(range, change))
	for (let i = ranges.length - 1; i >= 0; i--) {
		if (isEmptyRange(ranges[i])) ranges.splice(i, 1)
	}
}

export function updateCodeRange(range: SourceRange, change: RemoveLine | EditLine) {
	const { start, end } = range
	const changeLine = change.lineIndex
	if (change.editType === 'removeLine') {
		// Range was completely inside the removed line and is now empty
		if (start.line === changeLine && end.line === changeLine) return makeRangeEmpty(range)
		// Range ended at the removed line, so it now ends at the end of the previous line
		if (end.line === changeLine) range.end = { line: changeLine - 1 }
		// Range ended after the removed line, so keep column, but move line up
		if (end.line > changeLine) end.line--
		// Range started at the removed line, so it now starts at the beginning of the new line
		if (start.line === changeLine) range.start = { line: changeLine }
		// Range started after the removed line, so keep column, but move line up
		if (start.line > changeLine) start.line--
	} else {
		// Ignore inline edits that do not affect the start or end line of the range
		if (start.line !== changeLine && end.line !== changeLine) return
		const changeDelta = change.endColumn - change.startColumn + (change.newText?.length ?? 0)
		const rangeStartColumn = start.column ?? 0
		const rangeEndColumn = end.column ?? Infinity
		// If the inline edit completely covers the range, the range is now empty
		if (start.line === end.line && change.startColumn <= rangeStartColumn && change.endColumn >= rangeEndColumn) return makeRangeEmpty(range)
		// Range started at the edited line after the edit, so adjust its start column
		if (start.line === changeLine && change.startColumn < rangeStartColumn) {
			start.column = rangeStartColumn - Math.min(changeDelta, rangeStartColumn - change.startColumn)
		}
		// Range ended at the edited line after the edit, so adjust its end column
		if (end.line === changeLine && change.startColumn < rangeEndColumn) {
			end.column = rangeEndColumn === Infinity ? undefined : rangeEndColumn - Math.min(changeDelta, rangeEndColumn - change.startColumn)
		}
	}
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
