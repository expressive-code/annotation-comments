import type { AnnotationComment } from './types'

export type RemoveAnnotationCommentsOptions = {
	annotationComments: AnnotationComment[]
	codeLines: string[]
	updateTargetRanges?: boolean
	handleRemoveLine?: (context: HandleRemoveLineContext) => boolean
	handleRemoveInlineRange?: (context: HandleRemoveInlineRangeContext) => boolean
}

export type HandleRemoveLineContext = {
	commentBeingRemoved: AnnotationComment
	codeLines: string[]
	lineIndex: number
}

export type HandleRemoveInlineRangeContext = {
	commentBeingRemoved: AnnotationComment
	codeLines: string[]
	lineIndex: number
	startColumn: number
	endColumn: number
}

export function removeAnnotationComments(options: RemoveAnnotationCommentsOptions) {
	const { annotationComments, codeLines, updateTargetRanges, handleRemoveLine, handleRemoveInlineRange } = options
	// ...
}
