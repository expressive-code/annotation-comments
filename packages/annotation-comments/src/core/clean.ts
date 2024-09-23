import type { AnnotatedCode, AnnotationComment } from './types'

export type CleanCodeOptions = AnnotatedCode & {
	removeAnnotationContents?: boolean | ((context: RemoveAnnotationContentsContext) => boolean)
	updateTargetRanges?: boolean
	handleRemoveLine?: (context: HandleRemoveLineContext) => boolean
	handleEditLine?: (context: HandleEditLineContext) => boolean
}

export type RemoveAnnotationContentsContext = {
	comment: AnnotationComment
}

export type HandleRemoveLineContext = {
	lineIndex: number
	codeLines: string[]
}

export type HandleEditLineContext = {
	lineIndex: number
	startColumn: number
	endColumn: number
	codeLines: string[]
}

export function cleanCode(options: CleanCodeOptions) {
	const { annotationComments, codeLines, updateTargetRanges, handleRemoveLine, handleEditLine: handleRemoveInlineRange } = options
	// TODO: Implement cleanCode()
}
