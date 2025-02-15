import { coerceError } from '../internal/errors'
import { compareRanges, createSingleLineRange } from '../internal/ranges'
import { findSearchQueryMatchesInLine, getFirstNonAnnotationCommentLineContents, getNonAnnotationCommentLineContents } from '../internal/text-content'
import type { AnnotatedCode, AnnotationComment, AnnotationTag } from './types'

/**
 * Attempts to find the targets of all annotations in the given annotated code.
 *
 * Returns an array of error messages that occurred during the search.
 */
export function findAnnotationTargets(annotatedCode: AnnotatedCode): string[] {
	const { annotationComments } = annotatedCode
	const matchedEndTags = new Set<AnnotationTag>()
	const errorMessages: string[] = []

	annotationComments.forEach((comment) => {
		const { tag, commentRange, targetRanges } = comment

		// We don't need to search for `ignore-tags` annotation targets
		// as ignores are handled by the annotation comment parser
		if (tag.name === 'ignore-tags') return

		const commentLineIndex = commentRange.start.line
		const commentLineContents = getNonAnnotationCommentLineContents(commentLineIndex, annotatedCode)
		const { relativeTargetRange, targetSearchQuery } = tag

		try {
			if (targetSearchQuery === undefined) {
				// Handle annotations without a target search query (they target full lines)
				findFullLineTargetRanges({ annotatedCode, comment, commentLineContents, commentLineIndex, matchedEndTags })
			} else {
				// A target search query is present, so we need to search for target ranges
				findInlineTargetRanges({ annotatedCode, comment, commentLineContents, commentLineIndex, matchedEndTags })
			}
		} catch (error) {
			const errorMessage = coerceError(error).message
			errorMessages.push(`Error while processing annotation tag ${comment.tag.rawTag} in line ${comment.tag.range.start.line + 1}: ${errorMessage}`)
		}

		// In case of a negative direction, fix the potentially mixed up order of target ranges
		if (typeof relativeTargetRange === 'number' && relativeTargetRange < 0) targetRanges.sort((a, b) => compareRanges(a, b, 'start'))
	})

	return errorMessages
}

function findFullLineTargetRanges(options: {
	annotatedCode: AnnotatedCode
	comment: AnnotationComment
	commentLineContents: ReturnType<typeof getNonAnnotationCommentLineContents>
	commentLineIndex: number
	matchedEndTags: Set<AnnotationTag>
}) {
	const {
		annotatedCode,
		comment: { tag, targetRanges },
		commentLineContents,
		commentLineIndex,
		matchedEndTags,
	} = options
	const { relativeTargetRange } = tag

	// If no relative target range was given, try to find a nearby target line
	// that is not empty and not an annotation comment
	if (relativeTargetRange === undefined) {
		// Check if the annotation comment line itself is a valid target
		if (commentLineContents.hasNonWhitespaceContent) {
			return targetRanges.push(createSingleLineRange(commentLineIndex))
		}
		// Otherwise, scan for a target line below
		const potentialTargetBelow = getFirstNonAnnotationCommentLineContents(commentLineIndex, 'below', annotatedCode)
		if (potentialTargetBelow?.hasNonWhitespaceContent) {
			return targetRanges.push(createSingleLineRange(potentialTargetBelow.lineIndex))
		}
		// Finally, scan for a target line above
		const potentialTargetAbove = getFirstNonAnnotationCommentLineContents(commentLineIndex, 'above', annotatedCode)
		if (potentialTargetAbove?.hasNonWhitespaceContent) {
			return targetRanges.push(createSingleLineRange(potentialTargetAbove.lineIndex))
		}
		// If we arrive here, there is no target range (same as the relative range `:0`),
		// so don't do anything
		return
	}

	// If a numeric relative target range was given, select the number of non-annotation lines
	// in the given direction, starting with the comment line
	if (typeof relativeTargetRange === 'number') {
		const step = relativeTargetRange > 0 ? 1 : -1
		let lineIndex = commentLineIndex
		let remainingLines = Math.abs(relativeTargetRange)
		while (lineIndex >= 0 && lineIndex < annotatedCode.codeLines.length && remainingLines > 0) {
			// Check if the line is a valid target (annotation comment lines are skipped)
			const lineContents = getNonAnnotationCommentLineContents(lineIndex, annotatedCode)
			if (lineContents.contentRanges.length) {
				targetRanges.push(createSingleLineRange(lineIndex))
				remainingLines--
			}
			lineIndex += step
		}
	}

	// Handle relative target ranges defined by matching `start` and `end` annotations
	const startEndRange = handleStartEndTargetRange({ annotatedCode, tag, commentLineIndex, matchedEndTags })
	if (startEndRange?.endAnnotation) {
		const rangeStart = commentLineContents.hasNonWhitespaceContent ? commentLineIndex : commentLineIndex + 1
		const rangeEnd = startEndRange.endAnnotation.commentRange.start.line
		for (let lineIndex = rangeStart; lineIndex <= rangeEnd; lineIndex++) {
			const lineContents = getNonAnnotationCommentLineContents(lineIndex, annotatedCode)
			if (lineContents.contentRanges.length) {
				targetRanges.push(createSingleLineRange(lineIndex))
			}
		}
	}
}

function findInlineTargetRanges(options: {
	annotatedCode: AnnotatedCode
	comment: AnnotationComment
	commentLineContents: ReturnType<typeof getNonAnnotationCommentLineContents>
	commentLineIndex: number
	matchedEndTags: Set<AnnotationTag>
}) {
	const {
		annotatedCode,
		comment: { tag, targetRanges },
		commentLineContents,
		commentLineIndex,
		matchedEndTags,
	} = options
	const { targetSearchQuery } = tag
	let { relativeTargetRange } = tag

	if (!targetSearchQuery) return

	// If no relative target range was given, determine the direction and number of matches to find
	if (relativeTargetRange === undefined) {
		if (commentLineContents.hasNonWhitespaceContent) {
			// The annotation comment is on the same line as content,
			// so it starts searching at this line and goes downwards
			relativeTargetRange = 1
		} else {
			// Otherwise, the direction defaults to downwards, unless the annotation comment
			// is visually grouped with content above it (= there no content directly below
			// the annotation comment(s), but there is content directly above)
			const isGroupedWithContentAbove =
				!getFirstNonAnnotationCommentLineContents(commentLineIndex, 'below', annotatedCode)?.hasNonWhitespaceContent &&
				getFirstNonAnnotationCommentLineContents(commentLineIndex, 'above', annotatedCode)?.hasNonWhitespaceContent
			relativeTargetRange = isGroupedWithContentAbove ? -1 : 1
		}
	}

	// If a numeric relative target range was given, search in the specified direction
	// until the required number of matches is found
	if (typeof relativeTargetRange === 'number') {
		const step = relativeTargetRange > 0 ? 1 : -1
		let lineIndex = commentLineIndex
		let remainingMatches = Math.abs(relativeTargetRange)
		while (lineIndex >= 0 && lineIndex < annotatedCode.codeLines.length && remainingMatches > 0) {
			// Search all ranges of the line that are not part of an annotation comment
			// for matches of the target search query
			const matches = findSearchQueryMatchesInLine(lineIndex, targetSearchQuery, annotatedCode)
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

	// Handle relative target ranges defined by matching `start` and `end` annotations
	const startEndRange = handleStartEndTargetRange({ annotatedCode, tag, commentLineIndex, matchedEndTags })
	if (startEndRange?.endAnnotation) {
		const rangeStart = commentLineContents.hasNonWhitespaceContent ? commentLineIndex : commentLineIndex + 1
		const rangeEnd = startEndRange.endAnnotation.commentRange.start.line
		for (let lineIndex = rangeStart; lineIndex <= rangeEnd; lineIndex++) {
			// Search all ranges of the line that are not part of an annotation comment
			// for matches of the target search query
			const matches = findSearchQueryMatchesInLine(lineIndex, targetSearchQuery, annotatedCode)
			matches.forEach((match) => targetRanges.push(match))
		}
	}
}

/**
 * Handles relative target ranges defined by a matching `start`...`end` tag pair.
 *
 * Returns an object if the tag is part of a pair, or `undefined` otherwise.
 * If the tag is the start of a pair, the object also contains the matching end annotation.
 *
 * Throws an error when encountering unmatched `start` or `end` tags on their own.
 */
function handleStartEndTargetRange(options: {
	annotatedCode: AnnotatedCode
	tag: AnnotationTag
	commentLineIndex: number
	matchedEndTags: Set<AnnotationTag>
}): { endAnnotation?: AnnotationComment | undefined } | undefined {
	const { tag, matchedEndTags } = options
	if (tag.relativeTargetRange === 'start') {
		const endAnnotation = findTargetRangeEndAnnotation(options)
		if (!endAnnotation) throw new Error(`Failed to find a matching end tag, expected "${tag.rawTag.replace(/:\w+\]$/, ':end]')}".`)
		matchedEndTags.add(endAnnotation.tag)
		return { endAnnotation }
	}
	if (tag.relativeTargetRange === 'end') {
		if (!matchedEndTags.has(tag)) throw new Error('This end tag does not have a matching start tag.')
		return {}
	}
}

function findTargetRangeEndAnnotation(options: {
	annotatedCode: AnnotatedCode
	tag: AnnotationTag
	commentLineIndex: number
	matchedEndTags: Set<AnnotationTag>
}) {
	const { annotatedCode, tag, commentLineIndex, matchedEndTags } = options

	// Determine all matching range annotations below the start tag
	// (both start and end are allowed to support nested ranges)
	const matchFn = (input: AnnotationComment) => !matchedEndTags.has(input.tag) && input.commentRange.start.line > commentLineIndex && isMatchingRangeTag(tag, input.tag)
	const matchingAnnotationsBelow = annotatedCode.annotationComments.filter(matchFn)
	if (matchingAnnotationsBelow.length === 0) return

	// Go through the matching annotations in order of appearance, keep track of the nesting level,
	// and return the first end tag on the same level as the start tag
	matchingAnnotationsBelow.sort((a, b) => compareRanges(a.commentRange, b.commentRange, 'start'))
	let nestingLevel = 0
	for (const annotation of matchingAnnotationsBelow) {
		if (annotation.tag.relativeTargetRange === 'start') {
			nestingLevel++
			continue
		}
		if (nestingLevel === 0) return annotation
		nestingLevel--
	}
}

function isMatchingRangeTag(a: AnnotationTag, b: AnnotationTag) {
	if (b.name !== a.name) return false
	if (!isRangeTag(a) || !isRangeTag(b)) return false
	const getRawQuery = (query: AnnotationTag['targetSearchQuery']) => (query instanceof RegExp ? query.source : query)
	return getRawQuery(b.targetSearchQuery) === getRawQuery(a.targetSearchQuery)
}

function isRangeTag(tag: AnnotationTag) {
	return tag.relativeTargetRange === 'start' || tag.relativeTargetRange === 'end'
}
