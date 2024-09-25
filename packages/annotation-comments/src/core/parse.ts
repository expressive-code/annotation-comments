import type { AnnotationComment, SourceRange } from './types'
import { parseAnnotationTags } from '../parsers/annotation-tags'
import { parseParentComment } from '../parsers/parent-comment'
import { secondRangeIsInFirst } from '../internal/ranges'
import { findAnnotationTargets } from './find-targets'
import { coerceError } from '../internal/errors'

export type ParseAnnotationCommentsOptions = {
	codeLines: string[]
}

export type ParseAnnotationCommentsResult = {
	annotationComments: AnnotationComment[]
	errorMessages: string[]
}

export function parseAnnotationComments(options: ParseAnnotationCommentsOptions): ParseAnnotationCommentsResult {
	const { codeLines } = options
	const annotationComments: AnnotationComment[] = []

	// Find annotation tags in the code
	const { annotationTags, errorMessages } = parseAnnotationTags({ codeLines })

	const ignoreCountPerTagName = new Map<string, number>()
	let tagsIgnoredUntilLineIndex = -1

	let previousContentRanges: SourceRange[] = []
	annotationTags.forEach((tag) => {
		// Ignore the current tag if it is located inside the content ranges
		// of the previously processed annotation comment
		if (previousContentRanges.some((range) => secondRangeIsInFirst(range, tag.range))) return

		// Attempt to find a comment that the current annotation tag is located in
		const comment = parseParentComment({ codeLines, tag })
		if (!comment) return

		// Handle ignored tags based on lines
		if (tagsIgnoredUntilLineIndex >= tag.range.start.line) return
		// Handle ignored tags based on tag names
		const ignoreCount = ignoreCountPerTagName.get(tag.name) ?? 0
		if (ignoreCount > 0) {
			ignoreCountPerTagName.set(tag.name, ignoreCount - 1)
			return
		}
		// Allow creating new ignores through an `ignore-tags` annotation comment
		if (tag.name === 'ignore-tags') {
			try {
				// Require ignore-tags to be on its own line
				if (comment.annotationRange.start.column || comment.annotationRange.end.column) {
					throw new Error('It must be on its own line.')
				}
				if (tag.relativeTargetRange !== undefined && !(tag.relativeTargetRange > 0)) {
					throw new Error('If given, the target range must be a positive number.')
				}
				const ignoreRange = tag.relativeTargetRange ?? 1
				if (typeof tag.targetSearchQuery === 'string') {
					const targetTagNames = tag.targetSearchQuery.split(',').map((name) => name.trim())
					targetTagNames.forEach((name) => {
						ignoreCountPerTagName.set(name, ignoreRange)
					})
				} else if (ignoreRange > 0) {
					tagsIgnoredUntilLineIndex = tag.range.end.line + ignoreRange
				}
				// We still want to add this valid ignore-tags comment to the result array
				// to allow it to be removed by `cleanCode()` later, so we don't return here
			} catch (error) {
				const errorMessage = coerceError(error).message
				errorMessages.push(`Invalid "ignore-tags" annotation in line ${comment.annotationRange.start.line + 1}: ${errorMessage}`)
			}
		}

		// If we arrive here, add the tag and comment to the list of annotation comments
		annotationComments.push(comment)
		previousContentRanges = comment.contentRanges
	})

	// Find the target ranges for all annotations
	findAnnotationTargets({ codeLines, annotationComments })

	return {
		annotationComments,
		errorMessages,
	}
}
