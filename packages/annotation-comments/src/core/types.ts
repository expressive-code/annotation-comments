export type AnnotationComment = {
	tag: AnnotationTag
	contents: string[]
	/**
	 * The outer range of the parent comment that contains the annotation,
	 * including the comment's opening and closing syntax.
	 *
	 * Note that multi-line comments can contain multiple annotations and non-annotation content.
	 * In such cases, the comment range is larger than {@link AnnotationComment.annotationRange}.
	 */
	commentRange: SourceRange
	/**
	 * The outer range of the annotation, covering both the annotation tag and
	 * any optional content.
	 *
	 * If the parent comment only contains this annotation and nothing else,
	 * this range is equal to {@link AnnotationComment.commentRange}, which includes
	 * the comment's opening and closing syntax. This allows removing the annotation
	 * from the code without leaving an empty comment behind.
	 *
	 * In all other cases, this range covers only the parts inside the parent comment
	 * that belong to this annotation. This allows removing the annotation without
	 * affecting other annotations or non-annotation content inside the parent comment.
	 */
	annotationRange: SourceRange
	contentRanges: SourceRange[]
	targetRanges: SourceRange[]
}

export type AnnotationTag = {
	/**
	 * The name of the annotation, located inside the annotation tag.
	 *
	 * Example: The tag `[!ins:3]` has the name `ins`.
	 */
	name: string
	/**
	 * The optional target search query of the annotation,
	 * located inside the annotation tag.
	 *
	 * This query can be used to search for the target of the annotation.
	 * It can be a string or a regular expression.
	 *
	 * Example: The tag `[!ins:Astro.props]` targets the next occurrence
	 * of the plaintext search term `Astro.props`.
	 */
	targetSearchQuery?: string | RegExp | undefined
	/**
	 * The optional relative target range of the annotation,
	 * located inside the annotation tag.
	 *
	 * This can be used to define the amount of lines or search query matches
	 * targeted by the annotation, as well as the direction of targeting
	 * (positive numbers target code after the annotation, negative numbers
	 * target code before it).
	 *
	 * If the annotation shares a line with code, targeting starts on the same line.
	 * Otherwise, it starts on the next line in the given direction.
	 *
	 * Example: The annotation `// [!ins:3]` on its own line marks the next 3 lines
	 * as inserted.
	 */
	relativeTargetRange?: number | undefined
	rawTag: string
	/**
	 * The tag's range within the parsed source code.
	 */
	range: SourceRange
}

export type SourceLocation = {
	/** Zero-based line index. */
	line: number
	/**
	 * Zero-based column index inside the line.
	 *
	 * If not provided, the location references the full line.
	 */
	column?: number | undefined
}

export type SourceRange = {
	/** The beginning (line & optional column) of the range. */
	start: SourceLocation
	/** The end (line & optional column) of the range. */
	end: SourceLocation
}
