import type { AnnotationComment } from './types'
import { parseAnnotationTags } from '../parsers/annotation-tags'
import { parseParentComment } from '../parsers/parent-comment'

export type ParseAnnotationCommentsOptions = {
	codeLines: string[]
	validateAnnotationName?: (name: string) => boolean
}

export function parseAnnotationComments(options: ParseAnnotationCommentsOptions): AnnotationComment[] {
	const { codeLines, validateAnnotationName } = options
	const annotationComments: AnnotationComment[] = []

	// Find annotation tags
	const annotationTags = parseAnnotationTags({ codeLines })
	annotationTags.forEach((tag) => {
		// Ensure that the current annotation tag has not been ignored by an ´ignore-tags` directive. If it has, it will skip the tag and continue searching
		// If given, call the `validateAnnotationName` handler function to check if the annotation name is valid. If this function returns `false`, skip the tag and continue searching

		// Attempt to find a comment that the current annotation tag is located in
		const comment = parseParentComment({ codeLines, tag })
		if (!comment) return

		// If a comment was found, add the tag and comment to the list of annotation comments
	})

	return annotationComments
}
