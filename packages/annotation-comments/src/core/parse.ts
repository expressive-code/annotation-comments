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

	let previousCommentRanges: SourceRange[] = []
	annotationTags.forEach((tag) => {
		// Ignore the current tag if it is located inside the content ranges
		// of the previously processed annotation comment
		if (previousCommentRanges.some((range) => secondRangeIsInFirst(range, tag.range))) return

		// TODO: Handle `[!ignore-tags]` logic

		// Attempt to find a comment that the current annotation tag is located in
		const comment = parseParentComment({ codeLines, tag })
		if (!comment) return

		// If a comment was found, add the tag and comment to the list of annotation comments
		annotationComments.push(comment)
		previousCommentRanges = comment.contentRanges
	})

	return annotationComments
}
