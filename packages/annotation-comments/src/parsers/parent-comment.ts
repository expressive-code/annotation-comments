import type { AnnotationComment, AnnotationTag } from '../core/types'
import { parseSingleLineParentComment } from './comment-types/single-line'
import { parseMultiLineParentComment } from './comment-types/multi-line'

export type ParseParentCommentOptions = {
	codeLines: string[]
	tag: AnnotationTag
}

/**
 * Attempts to find and parse a single-line or multi-line comment that the given annotation tag
 * is located in. Supports comment syntaxes of most popular languages.
 *
 * **Note:** As accurately detecting comments in all languages (including those embedded
 * in document languages like HTML, Markdown, MDX etc.) would be a very complex and slow task,
 * this function uses language-agnostic, pattern-based heuristics instead of full parsing.
 * See the documentation for more information on possible edge cases and their solutions.
 *
 * @returns If a comment was found, returns its source location, content ranges and text contents.
 */
export function parseParentComment(options: ParseParentCommentOptions): AnnotationComment | undefined {
	// First, check if the annotation tag is inside a single-line comment
	const singleLineComment = parseSingleLineParentComment(options)
	if (singleLineComment) return singleLineComment

	// We didn't find a single-line comment, so try to find a multi-line comment now
	return parseMultiLineParentComment(options)
}
