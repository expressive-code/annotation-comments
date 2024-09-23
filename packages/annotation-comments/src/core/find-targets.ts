import type { AnnotatedCode } from './types'
import { findSearchQueryMatchesInLine, getFirstNonAnnotationCommentLineContents, getNonAnnotationCommentLineContents } from '../internal/text-content'
import { compareRanges, createSingleLineRange } from '../internal/ranges'

export function findAnnotationTargets(annotatedCode: AnnotatedCode) {
	const { codeLines, annotationComments } = annotatedCode

	annotationComments.forEach((comment) => {
		const { tag, commentRange, targetRanges } = comment

		// We don't need to search for `ignore-tags` annotation targets
		// as ignores are handled by the annotation comment parser
		if (tag.name === 'ignore-tags') return

		const commentLineIndex = commentRange.start.line
		const commentLineContents = getNonAnnotationCommentLineContents(commentLineIndex, annotatedCode)
		let { relativeTargetRange } = tag
		const { targetSearchQuery } = tag

		// Handle annotations without a target search query (they target full lines)
		if (targetSearchQuery === undefined) {
			// If the annotation has no relative target range, try to find a nearby target line
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
			// It has a relative target range, so select the number of non-annotation lines
			// in the given direction, starting with the comment line
			const step = relativeTargetRange > 0 ? 1 : -1
			let lineIndex = commentLineIndex
			let remainingLines = Math.abs(relativeTargetRange)
			while (lineIndex >= 0 && lineIndex < codeLines.length && remainingLines > 0) {
				// Check if the line is a valid target (annotation comment lines are skipped)
				const lineContents = getNonAnnotationCommentLineContents(lineIndex, annotatedCode)
				if (lineContents.contentRanges.length) {
					targetRanges.push(createSingleLineRange(lineIndex))
					remainingLines--
				}
				lineIndex += step
			}
		} else {
			// A target search query is present, so we need to search for target ranges,
			// but first we need to ensure we know the direction and number of matches to find
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

			// Perform the search
			const step = relativeTargetRange > 0 ? 1 : -1
			let lineIndex = commentLineIndex
			let remainingMatches = Math.abs(relativeTargetRange)
			while (lineIndex >= 0 && lineIndex < codeLines.length && remainingMatches > 0) {
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
		// In case of a negative direction, fix the potentially mixed up order of target ranges
		if (relativeTargetRange < 0) targetRanges.sort((a, b) => compareRanges(b, a, 'start'))
	})
}
