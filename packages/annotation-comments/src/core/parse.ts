import type { AnnotationComment, SourceRange } from './types'
import { parseAnnotationTags } from '../parsers/annotation-tags'
import { parseParentComment } from '../parsers/parent-comment'
import { secondRangeIsInFirst } from '../internal/ranges'

export type ParseAnnotationCommentsOptions = {
	codeLines: string[]
}

export function parseAnnotationComments(options: ParseAnnotationCommentsOptions): AnnotationComment[] {
	const { codeLines } = options
	const annotationComments: AnnotationComment[] = []

	// Find annotation tags in the code
	const annotationTags = parseAnnotationTags({ codeLines })

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
		// Allow creating new ignores
		if (tag.name === 'ignore-tags') {
			// By definition, `ignore-tags` must be on its own line
			if (comment.annotationRange.start.column || comment.annotationRange.end.column) return
			const ignoreRange = tag.relativeTargetRange ?? 1
			if (typeof tag.targetSearchQuery === 'string') {
				const targetTagNames = tag.targetSearchQuery.split(',').map((name) => name.trim())
				targetTagNames.forEach((name) => {
					ignoreCountPerTagName.set(name, ignoreRange)
				})
			} else if (ignoreRange > 0) {
				tagsIgnoredUntilLineIndex = tag.range.end.line + ignoreRange
			}
			return
		}

		// If we arrive here, add the tag and comment to the list of annotation comments
		annotationComments.push(comment)
		previousContentRanges = comment.contentRanges
	})

	// TODO: Call findAnnotationTargets() here

	return annotationComments
}
