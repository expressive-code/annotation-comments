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
	 * The inner range of the parent comment that contains the annotation,
	 * excluding the comment's opening and closing syntax.
	 */
	commentInnerRange: SourceRange
	/**
	 * The syntax used by the parent comment that contains the annotation.
	 */
	commentSyntax: {
		/**
		 * The opening syntax (e.g. `//` or `/*` for JS-style comments).
		 */
		opening: string
		/**
		 * The closing syntax (e.g. `-->` for HTML-style comments).
		 *
		 * This is `undefined` for single-line comment syntaxes.
		 */
		closing?: string | undefined
		/**
		 * The syntax used to start a new line inside the parent comment.
		 * Used by JSDoc-style comments (e.g. `*`).
		 *
		 * This is `undefined` for single-line comment syntaxes.
		 */
		continuationLineStart?: RegExp | undefined
	}
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
	 * The optional target search query of the annotation, located inside the annotation tag.
	 *
	 * This query can be used to search for the target of the annotation.
	 * It can be a string or a regular expression.
	 *
	 * Example: The tag `[!ins:Astro.props]` targets the next occurrence
	 * of the plaintext search term `Astro.props`.
	 */
	targetSearchQuery?: string | RegExp | undefined
	/**
	 * The optional relative target range of the annotation, located inside the annotation tag.
	 *
	 * If present, it determines how many lines or target search query matches before or after
	 * the annotation are targeted.
	 *
	 * If omitted, the annotation targets only 1 line or target search query match.
	 * Depending on the location of the annotation, this may be above, below, or on the line
	 * containing the annotation itself.
	 *
	 * The following range types are supported:
	 * - A **numeric range** defined by positive or negative numbers.
	 *   Positive ranges extend downwards, negative ranges extend upwards from the location
	 *   of the annotation. If the annotation shares a line with code, the range starts at this
	 *   line. Otherwise, it starts at the first non-annotation line in the direction of the range.
	 *   The special range `0` creates standalone annotations that do not target any code.
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

export type AnnotatedCode = {
	codeLines: string[]
	annotationComments: AnnotationComment[]
}
