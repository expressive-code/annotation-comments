export type AnnotationComment = {
	tag: AnnotationTag
	contents: string[]
	commentRange: CodeRange
	contentRanges: CodeRange[]
	targetRanges: CodeRange[]
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
	 * The tag's location within the parsed code.
	 */
	location: CodeRange
}

export type CodeRange = {
	/** Zero-based index of the range's starting line. */
	startLineIndex: number
	/** Zero-based index of the range's ending line. */
	endLineIndex: number
	/**
	 * Zero-based index of the range's starting column.
	 * If not provided, the range covers the full starting line.
	 */
	startColIndex?: number | undefined
	/**
	 * Zero-based index of the range's ending column.
	 * If not provided, the range covers the full ending line.
	 */
	endColIndex?: number | undefined
}
